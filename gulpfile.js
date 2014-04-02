'use strict';

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

gulp.task('templates', function () {
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
  require('request')('http://app2.nea.gov.sg/anti-pollution-radiation-protection/air-pollution-control/psi/pollutant-concentrations/type/PM25-1Hr',
    function (err, response, body) {
      if (err || response.statusCode !== 200) {
        return cb(err || response.statusCode);
      }

      var datePattern = /(\d{1,2} \w{3} \d{4})\s*<\/h1>/g;
      var date = datePattern.exec(body)[1];
      var hour = +/selected="selected" value="(\d\d)\d\d"/.exec(body)[1];
      var pollutantTime = Date.parse(date + ' ' + hour + ':00 +0800');

      var readings = {};
      readings[pollutantTime] = {};

      var pollutantKeys = ['so2_24h', 'pm10_24h', 'no2_1h', 'o3_8h', 'co_8h', 'pm2_5_24h'];
      var pollutantPattern = /(?:FFFFFF|CAE3F0)">\s*([\w\.]+)(?:\((\d+)\))?/g;

      var min_psi_24h = Number.MAX_VALUE;
      var max_psi_24h = Number.MIN_VALUE;

      var match;
      while (match = pollutantPattern.exec(body)) {
        var region = match[1];
        readings[pollutantTime][region] = {};
        var psi_24h = Number.MIN_VALUE;

        pollutantKeys.forEach(function (key) {
          match = pollutantPattern.exec(body);

          var psiSubIndex = +match[2];
          if (psiSubIndex > psi_24h) {
            psi_24h = psiSubIndex;
          }

          readings[pollutantTime][region][key] = {
            reading: +match[1],
            psiSubIndex: psiSubIndex
          };
        });

        readings[pollutantTime][region].psi_24h = psi_24h;
        min_psi_24h = Math.min(psi_24h, min_psi_24h);
        max_psi_24h = Math.max(psi_24h, max_psi_24h);
      }

      readings[pollutantTime]['Overall Singapore'] = {};
      readings[pollutantTime]['Overall Singapore'].psi_24h = min_psi_24h + '-' + max_psi_24h;

      var rowPattern = /<tr>[\s\S]+?<strong>([^<]+)([\s\S]+?)<\/tr>/g;
      var cellPattern = />\s*(\d+)/g;
      var rows = {};
      while (match = rowPattern.exec(body)) {
        var label = match[1];
        rows[label] = rows[label] || [];
        var cell;
        while (cell = cellPattern.exec(match[2])) {
          rows[label].push(cell[1]);
        }
      }

      date = datePattern.exec(body)[1];
      var incomplete = false;
      var regions = ['North', 'South', 'East', 'West', 'Central'];
      regions.forEach(function (region) {
        var row = rows[region];
        var pm2_5_1h_time = Date.parse(date + ' 00:00 +0800') + row.length * 36e5;
        if (pm2_5_1h_time === pollutantTime) {
          readings[pm2_5_1h_time][region].pm2_5_1h = +row[row.length - 1];
        } else {
          incomplete = true;
        }
      });

      date = datePattern.exec(body)[1];
      var psiRow = rows['3-hr PSI'];
      var psiTime = Date.parse(date + ' 00:00 +0800') + psiRow.length * 36e5;
      if (psiTime === pollutantTime) {
        readings[psiTime]['Overall Singapore'].psi_3h = +psiRow[hour - 1];
      } else {
        incomplete = true;
      }

      if (incomplete) {
        cb('Readings for latest hour are incomplete.');
      } else {
        require('fs').writeFile('app/psi.json', JSON.stringify(readings, null, '\t'), cb);
      }
    });
});

gulp.task('tweetPSI', function (cb) {
  var moment = require('moment');
  var Twit = require('twit');

  var psi = require('app/psi.json');
  var status = '3-hour PSI is ' + psi.psi3 +
    '. 24-hour PSI is ' + psi.psi24.replace(/ /g, '') +
    '. 24-hour PM2.5 is ' + psi.pm25.replace(/ /g, '') +
    ' µg/m³. Issued ' + moment(psi.date).format('ha');

  var T = new Twit(require('twitter_credentials.json'));
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

gulp.task('copy', function () {
  return gulp.src('app/*.{htaccess,json}')
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['clean'], function () {
  gulp.start('css', 'html');
});
