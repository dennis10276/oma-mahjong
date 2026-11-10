'use strict';
const path = require('path');
const M = require('../factory/meter.js');
const Y = require('../builder/loop/yardstick.js');

// Explicit experimental ruler: family/reference pins stay unchanged. B3 is
// distinguished by its full source fingerprint, including the faa0295c repair.
function createYardstick(options = {}) {
  const pins = structuredClone(Y.loadPins());
  const cacheDir = options.cacheDir ?? path.resolve(__dirname, '../../build/factory-cache');
  const planner = M.createMeter({ cacheDir, bot: path.resolve(__dirname,
    '../../analysis/skilled-bot-b3/candidate_bot.js') });
  pins.planner = { ...pins.planner, botVersion: 'skilled-b3-faa0295c', fingerprint: planner.fingerprint };
  const meters = {
    family: M.createMeter({ cacheDir, botVersion: pins.family.botVersion }),
    reference: M.createMeter({ cacheDir, ...(pins.reference.fast === false ? { fast: false } : {}) }),
    planner,
  };
  const ys = Y.createYardstick({ pins, meters, cacheDir, ledgerFile: false });
  return ys;
}
module.exports = { createYardstick };
