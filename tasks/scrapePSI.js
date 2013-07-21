'use strict';

module.exports = function (grunt) {
  grunt.registerTask('scrapePSI', function () {
    var jsdom = require('jsdom');

    var done = this.async();
    var config = grunt.config(this.name);
    var jquery = grunt.file.read(config.jquery);

    // It appears that the psi-lite pages tend to be updated before the full 24 hour page:
    // http://app2.nea.gov.sg/anti-pollution-radiation-protection/air-pollution/psi/psi-readings-over-the-last-24-hours
    grunt.util.async.map([
      'http://app2.nea.gov.sg/home-lite/psi-lite/3-hour-psi',
      'http://app2.nea.gov.sg/home-lite/psi-lite/24-hour-psi'
    ], function (url, callback) {
      jsdom.env({
        url: url,
        src: jquery,
        done: function (err, window) {
          if (err) {
            return callback(err);
          }

          var $ = window.$;
          callback(null, {
            date: $('.content h1').last().text().match(/\d{1,2} \w{3} \d{4}/)[0],
            readings: $('.content td:not(:first-child):not(:contains(AM)):not(:contains(PM))')
              .map(function () {
                return $(this).text().trim();
              })
              .filter(function () {
                return this !== '-';
              })
              .get()
          });
        }
      });
    }, function (err, results) {
      if (err) {
        console.log(err);
        return done(false);
      }

      var date = results[0].date;
      var readingsLength = results[0].readings.length;
      if (date !== results[1].date || readingsLength !== results[1].readings.length / 12) {
        return done('Readings for latest hour are incomplete.');
      }
      grunt.file.write(config.dest, JSON.stringify({
        date: Date.parse(readingsLength - 1 + ':00 ' + date),
        psi3: results[0].readings[readingsLength - 1],
        psi24: results[1].readings[readingsLength * 6 - 1].replace('-', ' - '),
        pm25: results[1].readings[readingsLength * 12 - 1].replace('-', ' - ')
      }));
      done();
    });
  });
};
