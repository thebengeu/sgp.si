'use strict';

module.exports = function (grunt) {
  grunt.registerTask('assemblePrepare', function () {
    var path = require('path');

    var done = this.async();
    var config = grunt.config(this.name);

    require('node-phantom-simple').create(function (err, ph) {
      ph.createPage(function (err, page) {
        page.onCallback = function (data) {
          var assemble = grunt.config('assemble');
          assemble.options.mediaQueries = data;
          grunt.config('assemble', assemble);
          ph.exit();
          done();
        };
        page.open('file://' + path.resolve(config.src));
      });
    });
  });
};
