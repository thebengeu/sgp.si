'use strict';

var clean = require('gulp-clean');
var consolidate = require('gulp-consolidate');
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
  data.psi = JSON.parse(fs.readFileSync('app/psi.json'));
  return gulp.src('*.hbs')
    .pipe(consolidate('handlebars', data, {useContents: true}))
    .pipe(rename({extname: '.html'}))
};

gulp.task('templates', function () {
  return renderTemplates({}).pipe(gulp.dest('app'));
});

gulp.task('phantom', ['templates'], function (cb) {
  require('phantom').create(function (ph) {
    ph.createPage(function (page) {
      page.open('file://' + path.resolve('app/index.html'), function () {
        setTimeout(function () {
          page.evaluate(function () {
            return document.getElementsByTagName('style')[0].textContent;
          }, function (result) {
            ph.exit();
            renderTemplates({mediaQueries: result, production: true})
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
              .pipe(gulp.dest('dist'));
            cb();
          });
        }, 1000);
      });
    });
  });
});

gulp.task('rev', function () {
  return gulp.src('app/*.{css,eot,png,svg,ttf}')
    .pipe(rev())
    .pipe(gulp.dest('dist'));
});

var replaceRev = function (srcGlob, revGlob) {
  var src = gulp.src(srcGlob);
  glob.sync(revGlob).forEach(function (filePath) {
    var revName = path.basename(filePath);
    var revOrigName = revName.replace(/-[0-9a-f]{8}\./, '.');
    src = src.pipe(replace(revOrigName, revName));
  });
  return src.pipe(gulp.dest('dist'));
};

gulp.task('replaceRevCss', ['rev'], function () {
  return replaceRev('dist/*.css', 'dist/*.{eot,svg,ttf}');
});

gulp.task('replaceRevHtml', ['phantom', 'rev'], function () {
  return replaceRev('dist/*.html', 'dist/*.{css,png}');
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

gulp.task('default', ['clean'], function () {
  gulp.start('replaceRevCss', 'replaceRevHtml');
});
