'use strict';

module.exports = function (grunt) {
  grunt.registerTask('tweetPSI', function () {
    var Twit = require('twit');

    var done = this.async();
    var config = grunt.config(this.name);

    var psi = grunt.file.readJSON(config.src);
    var status = '3-hour PSI is ' + psi.psi3 +
        '. 24-hour PSI is ' + psi.psi24.replace(/ /g, '') +
        '. 24-hour PM2.5 is ' + psi.pm25.replace(/ /g, '') +
        ' µg/m³. Issued ' + require('moment')(psi.date).format('hA') +
        '. http://sgp.si #sghaze';

    var T = new Twit(config.twitter_credentials);
    T.post('statuses/update', {
      status: status,
      trim_user: 1
    }, function (err, reply) {
      if (err) {
        grunt.log.error(err);
        return done(false);
      }
      done();
    });
  });
};
