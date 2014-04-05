(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.aqi = factory();
  }
}(this, function () {
  'use strict';

  return {
    breakpoints: {
      // Reference: http://www.epa.gov/airnow/aqi-technical-assistance-document-dec2013.pdf
      aqi_epa: {
        o3_8h: [
          [0.000, 0.059],
          [0.060, 0.075],
          [0.076, 0.095],
          [0.096, 0.115],
          [0.116, 0.374],
          [null, null],
          [null, null]
        ],
        pm10_24h: [
          [0, 54],
          [55, 154],
          [155, 254],
          [255, 354],
          [355, 424],
          [425, 504],
          [505, 604]
        ],
        pm2_5_24h: [
          [0.0, 12.0],
          [12.1, 35.4],
          [35.5, 55.4],
          [55.5, 150.4],
          [150.5, 250.4],
          [250.5, 350.4],
          [350.5, 500.4]
        ],
        co_8h: [
          [0.0, 4.4],
          [4.5, 9.4],
          [9.5, 12.4],
          [12.5, 15.4],
          [15.5, 30.4],
          [30.5, 40.4],
          [40.5, 50.4]
        ],
        so2_1h: [
          [0, 35],
          [36, 75],
          [75, 185],
          [186, 304],
          [305, 604],
          [605, 804],
          [805, 1004]
        ],
        no2_1h: [
          [0, 53],
          [54, 100],
          [101, 360],
          [361, 649],
          [650, 1249],
          [1250, 1649],
          [1650, 2049]
        ],
        index: [
          [0, 50],
          [51, 100],
          [101, 150],
          [151, 200],
          [201, 300],
          [301, 400],
          [401, 500]
        ]
      },
      // Reference: http://www.haze.gov.sg/Faq/Files/Computation%20of%20the%20Pollutant%20Standards%20Index%20(PSI).pdf
      psi_nea: {
        index: [
          [0, 50],
          [51, 100],
          [101, 200],
          [201, 300],
          [301, 400],
          [401, 500]
        ],
        pm2_5_24h: [
          [0, 12],
          [13, 55],
          [56, 150],
          [151, 250],
          [251, 350],
          [351, 500]
        ],
        pm10_24h: [
          [0, 50],
          [51, 150],
          [151, 350],
          [351, 420],
          [421, 500],
          [501, 600]
        ],
        so2_24h: [
          [0, 80],
          [81, 365],
          [366, 800],
          [801, 1600],
          [1601, 2100],
          [2101, 2620]
        ],
        co_8h: [
          [0, 5],
          [5.1, 10],
          [10.1, 17],
          [17.1, 34],
          [34.1, 46],
          [46.1, 57.5]
        ],
        o3_8h: [
          [0, 118],
          [119, 157],
          [158, 235],
          [236, 785],
          [786, 980],
          [981, 1180]
        ],
        no2_1h: [
          [null, null],
          [null, null],
          [null, null],
          [1131, 2260],
          [2261, 3000],
          [3001, 3750]
        ]
      }
    },
    decimalPlaces: {
      aqi_epa: {
        o3_8h: 3,
        pm10_24h: 0,
        pm2_5_24h: 1,
        co_8h: 1,
        so2_1h: 0,
        no2_1h: 0
      },
      psi_nea: {
        pm2_5_24h: 0,
        pm10_24h: 0,
        so2_24h: 0,
        co_8h: 1,
        o3_8h: 0,
        no2_1h: 0
      }
    },
    truncateDecimalPlaces: function (number, places) {
      var multiplier = Math.pow(10, places);
      return Math.floor(number * multiplier) / multiplier;
    },
    findBreakpoints: function (pollutant, concentration, standard) {
      var pollutant_breakpoints = this.breakpoints[standard][pollutant];
      if (!pollutant_breakpoints) {
        return null;
      }
      concentration = this.truncateDecimalPlaces(concentration, this.decimalPlaces[standard][pollutant]);
      for (var i = 0; i < pollutant_breakpoints.length; i++) {
        if (concentration >= pollutant_breakpoints[i][0] && concentration <= pollutant_breakpoints[i][1]) {
          return {
            bp_lo: pollutant_breakpoints[i][0],
            bp_hi: pollutant_breakpoints[i][1],
            i_lo: this.breakpoints[standard].index[i][0],
            i_hi: this.breakpoints[standard].index[i][1]
          };
        }
      }
    },
    calculateSubIndex: function (pollutant, concentration, standard) {
      var bps = this.findBreakpoints(pollutant, concentration, standard);
      return bps ? Math.round((bps.i_hi - bps.i_lo) / (bps.bp_hi - bps.bp_lo) *
        (concentration - bps.bp_lo) + bps.i_lo) : null;
    },
    calculateIndex: function (concentrations, standard) {
      var index = -1;
      for (var pollutant in concentrations) {
        var subIndex = this.calculateSubIndex(pollutant, concentrations[pollutant], standard);
        index = Math.max(subIndex, index);
      }
      return index;
    },
    mgPerCubicMeterToPpm: function (concentration, molecularWeight) {
      return concentration * 24.45 / molecularWeight;
    },
    convertNeaToEpaConcentrations: function (concentrations) {
      return {
        o3_8h: this.mgPerCubicMeterToPpm(concentrations.o3_8h / 1e3, 48),
        pm10_24h: concentrations.pm10_24h,
        pm2_5_24h: concentrations.pm2_5_24h,
        co_8h: this.mgPerCubicMeterToPpm(concentrations.co_8h, 28.01),
        so2_1h: this.mgPerCubicMeterToPpm(concentrations.so2_24h / 1e3, 64.066) * 1e3,
        no2_1h: this.mgPerCubicMeterToPpm(concentrations.no2_1h / 1e3, 46.0055) * 1e3
      };
    }
  };
}));
