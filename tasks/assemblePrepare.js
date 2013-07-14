'use strict';

module.exports = function (grunt) {
  grunt.registerTask('assemblePrepare', function () {
    var path = require('path');

    var done = this.async();
    var config = grunt.config(this.name);

    require('phantom').create(function (ph) {
      ph.createPage(function (page) {
        page.open('file://' + path.resolve(config.src), function () {
          setTimeout(function () {
            page.evaluate(function () {
              return document.getElementsByTagName('style')[0].textContent;
            }, function (result) {
              var assemble = grunt.config('assemble');
              assemble.options.mediaQueries = result;
              grunt.config('assemble', assemble);
              ph.exit();
              done();
            });
          }, 1000);
        });
      });
    });
  });
};
