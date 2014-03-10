'use strict';

module.exports = function (grunt) {
  // load all grunt tasks
  require('matchdep').filter('grunt-*').forEach(grunt.loadNpmTasks);

  // configurable paths
  var yeomanConfig = {
    app: 'app',
    dist: 'dist'
  };

  grunt.initConfig({
    yeoman: yeomanConfig,
    clean: {
      dist: {
        files: [
          {
            dot: true,
            src: [
              '.tmp',
              '<%= yeoman.dist %>/*',
              '!<%= yeoman.dist %>/.git*'
            ]
          }
        ]
      }
    },
    rev: {
      dist: {
        files: {
          src: [
            '<%= yeoman.dist %>/*.css',
            '<%= yeoman.dist %>/*-webfont.*'
          ]
        }
      }
    },
    useminPrepare: {
      options: {
        dest: '<%= yeoman.dist %>'
      },
      html: '<%= yeoman.app %>/index.html'
    },
    usemin: {
      options: {
        dirs: ['<%= yeoman.dist %>']
      },
      html: ['<%= yeoman.dist %>/{,*/}*.html'],
      css: ['<%= yeoman.dist %>/{,*/}*.css']
    },
    htmlmin: {
      dist: {
        options: {
          removeCommentsFromCDATA: true,
          // https://github.com/yeoman/grunt-usemin/issues/44
          collapseWhitespace: true,
          collapseBooleanAttributes: true,
          removeAttributeQuotes: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeOptionalTags: true
        },
        files: [
          {
            expand: true,
            cwd: '<%= yeoman.dist %>',
            src: '*.html',
            dest: '<%= yeoman.dist %>'
          }
        ]
      }
    },
    // Put files not handled in other tasks here
    copy: {
      dist: {
        files: [
          {
            expand: true,
            dot: true,
            cwd: '<%= yeoman.app %>',
            dest: '<%= yeoman.dist %>',
            src: [
              '*'
            ]
          }
        ]
      }
    },
    scrapePSI: {
      dest: '<%= yeoman.app %>/psi.json',
      jquery: 'jquery.min.js'
    },
    tweetPSI: {
      src: '<%= yeoman.app %>/psi.json',
      twitter_credentials: grunt.file.readJSON('twitter_credentials.json')
    },
    assemblePrepare: {
      src: '<%= yeoman.app %>/index.html',
      dest: '<%= yeoman.app %>/css.json'
    },
    assemble: {
      options: {
        data: '<%= yeoman.app %>/*.json',
        helpers: 'helpers.js'
      },
      development: {
        files: {
          '<%= yeoman.app %>/index.html': 'index.html.hbs'
        }
      },
      production: {
        options: {
          production: true
        },
        files: {
          '<%= yeoman.app %>/index.html': 'index.html.hbs'
        }
      }
    }
  });

  grunt.loadNpmTasks('assemble');
  grunt.loadTasks('tasks');

  grunt.registerTask('build', [
    'clean:dist',
    'useminPrepare',
    'copy:dist',
    'cssmin',
    'rev',
    'usemin',
    'htmlmin'
  ]);

  grunt.registerTask('default', [
    'scrapePSI',
    'tweetPSI',
    'assemble:development',
    'assemblePrepare',
    'assemble:production',
    'build'
  ]);
};
