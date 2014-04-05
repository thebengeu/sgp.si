'use strict';

var _ = require('lodash');
var clean = require('gulp-clean');
var consolidate = require('gulp-consolidate');
var csso = require('gulp-csso');
var fs = require('fs');
var glob = require('glob');
var gulp = require('gulp');
var htmlmin = require('gulp-htmlmin');
var path = require('path');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var rev = require('gulp-rev');

var renderTemplates = function (data) {
  data.helpers = require('./helpers');
  data.psi = require('./app/psi.json');
  return gulp.src('*.hbs')
    .pipe(consolidate('handlebars', data, {useContents: true}))
    .pipe(rename({extname: '.html'}));
};

gulp.task('templates', ['scrapePSI'], function () {
  return renderTemplates({}).pipe(gulp.dest('app'));
});

gulp.task('rev', function () {
  return gulp.src('app/*.{eot,png,svg,ttf}')
    .pipe(rev())
    .pipe(gulp.dest('dist'));
});

var replaceRev = function (src, revGlob) {
  glob.sync(revGlob).forEach(function (filePath) {
    var revName = path.basename(filePath);
    var revOrigName = revName.replace(/-[0-9a-f]{8}\./, '.');
    src = src.pipe(replace(revOrigName, revName));
  });
  return src;
};

gulp.task('css', ['rev'], function () {
  return replaceRev(gulp.src('app/*.css'), 'dist/*.{eot,svg,ttf}')
    .pipe(csso())
    .pipe(rev())
    .pipe(gulp.dest('dist'));
});

gulp.task('html', ['templates'], function (cb) {
  require('node-phantom-simple').create(function (err, ph) {
    ph.createPage(function (err, page) {
      page.onCallback = function (data) {
        var src = renderTemplates({mediaQueries: data, production: true});
        replaceRev(src, 'dist/*.{css,png}')
          .pipe(htmlmin({
            removeComments: true,
            removeCommentsFromCDATA: true,
            collapseWhitespace: true,
            collapseBooleanAttributes: true,
            removeAttributeQuotes: true,
            removeRedundantAttributes: true,
            useShortDoctype: true,
            removeEmptyAttributes: true,
            removeOptionalTags: true,
            minifyJS: true,
            minifyCSS: true
          }))
          .pipe(gulp.dest('dist'))
          .on('end', cb);
        ph.exit();
      };
      page.open('file://' + path.resolve('app/index.html'));
    });
  });
});

gulp.task('scrapePSI', function (cb) {
  var aqi = require('./aqi');
  require('request')('http://app2.nea.gov.sg/anti-pollution-radiation-protection/air-pollution-control/psi/pollutant-concentrations/type/PM25-1Hr',
    function (err, response, body) {
      if (err || response.statusCode !== 200) {
        return cb(err || response.statusCode);
      }

      var $ = require('cheerio').load(body);
      var dates = $('.c1 h1:not(.title)').map(function () {
        return $(this).text().trim().match(/\d{1,2} \w{3} \d{4}/);
      }).get();
      var hour = $('#ContentPlaceHolderTitle_C001_DDLTime').val().match(/(\d\d)\d\d/)[1];
      var pollutantTime = Date.parse(dates[0] + ' ' + hour + ':00 +0800');
      var readings = {time: new Date(pollutantTime)};

      var tables = $('.c1 table').map(function() {
        var rows = {};
        $(this).children('tr').each(function () {
          var cells = $(this).children();
          var label = cells.first().text().trim().toLowerCase();
          if (label !== 'time') {
            rows[label] = rows[label] || [];
            cells.slice(1).each(function () {
              var cellText = $(this).text().trim();
              if (cellText !== '-') {
                rows[label].push(cellText);
              }
            });
          }
        });
        return rows;
      }).get();

      var pollutantKeys = ['so2_24h', 'pm10_24h', 'no2_1h', 'o3_8h', 'co_8h', 'pm2_5_24h'];
      _.each(tables[0], function (row, region) {
        readings[region] = {psiSubIndex: {}};
        pollutantKeys.forEach(function (key, index) {
          var match = row[index].match(/([\d\.]+)\((\d+|-)\)/);
          readings[region][key] = +match[1];

          var psiSubIndex = +match[2];
          if (!isNaN(psiSubIndex)) {
            readings[region].psiSubIndex[key] = psiSubIndex;
          }
        });
        readings[region].psi_24h = _.max(_.values(readings[region].psiSubIndex));
        readings[region].aqi = aqi.calculateIndex(aqi.convertNeaToEpaConcentrations(readings[region]), 'aqi_epa');
      });

      var getLatestReading = function (tableIndex, label) {
        var row = tables[tableIndex][label];
        var time = Date.parse(dates[tableIndex] + ' 00:00 +0800') + row.length * 36e5;
        if (time !== pollutantTime) {
          throw 'Readings for latest hour are incomplete.';
        }
        return +row[row.length - 1];
      };

      try {
        for (var region in tables[1]) {
          readings[region].pm2_5_1h = getLatestReading(1, region);
        }

        var pm2_5_1h = _.pluck(readings, 'pm2_5_1h');
        var psi_24h = _.pluck(readings, 'psi_24h');
        readings.overall = {
          pm2_5_1h: _.min(pm2_5_1h) + '-' + _.max(pm2_5_1h),
          psi_24h: _.min(psi_24h) + '-' + _.max(psi_24h),
          psi_3h: getLatestReading(2, '3-hr psi')
        };
      } catch (err) {
        cb(err);
      }

      require('fs').writeFile('app/psi.json', JSON.stringify(readings, null, '\t'), cb);
    });
});

gulp.task('tweetPSI', ['scrapePSI'], function (cb) {
  var moment = require('moment');
  var Twit = require('twit');

  var psi = require('./app/psi.json');
  var status = '3-hour PSI is ' + psi.overall.psi_3h +
    '. 24-hour PSI is ' + psi.overall.psi_24h +
    '. 1-hour PM2.5 is ' + psi.overall.pm2_5_1h +
    ' µg/m³. Issued ' + moment(psi.time).format('ha');

  var T = new Twit(require('./twitter_credentials.json'));
  T.get('statuses/user_timeline', {
    count: 1,
    trim_user: 1
  }, function (err, reply) {
    if (err || (reply.length && reply[0].text.indexOf(status) !== -1)) {
      return cb(err);
    }
    T.post('statuses/update', {
      status: status + '. http://sgp.si #sghaze',
      trim_user: 1
    }, function (err) {
      cb(err);
    });
  });
});

gulp.task('clean', function () {
  return gulp.src('dist', {read: false})
    .pipe(clean());
});

gulp.task('copy', ['scrapePSI'], function () {
  return gulp.src('app/{.htaccess,*.json}')
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['clean'], function () {
  gulp.start('copy', 'css', 'html');
});
