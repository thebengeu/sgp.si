'use strict';

var classes = ['good', 'moderate', 'unhealthy', 'very-unhealthy', 'hazardous'];
var valueToClassFunc = function (thresholds) {
  return function (value) {
    value = typeof value === 'string' ? +value.split('-').pop() : value;
    for (var i = 0; i < 4; i++) {
      if (value <= thresholds[i]) {
        break;
      }
    }
    return classes[i];
  };
};

module.exports = {
  encodeURIComponent: function(options) {
    return encodeURIComponent(options.fn(this));
  },
  moment: function (date, format) {
    return require('moment')(date).format(format).toUpperCase();
  },
  psiclass: valueToClassFunc([50, 100, 200, 300]),
  pm25class: valueToClassFunc([15, 40, 65, 150]),
  addSpacesToDash: function (string) {
    return string.replace('-', ' - ');
  }
};
