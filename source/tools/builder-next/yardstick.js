'use strict';
const path = require('path');
const M = require('../factory/meter.js');
const Y = require('../builder/loop/yardstick.js');

// Explicit experimental ruler: family/reference pins stay unchanged. B3 is
// distinguished by its full source fingerprint, including the faa0295c repair.
// Supports versioned protocol: 'standard-20-v1' (default) and 'extended-40-v1'.
function createYardstick(options = {}) {
  const pins = structuredClone(Y.loadPins());
  const protocol = options.protocol || (options.extended40 ? 'extended-40-v1' : 'standard-20-v1');
  if (protocol !== 'standard-20-v1' && protocol !== 'extended-40-v1') {
    throw Error(`Unknown protocol '${protocol}'. Supported protocols: 'standard-20-v1', 'extended-40-v1'`);
  }
  if (protocol === 'extended-40-v1') {
    pins.cap = 40;
    pins.protocol = 'extended-40-v1';
    pins.blocks.CURVE = {
      ...pins.blocks.CURVE,
      calls: pins.blocks.CURVE.calls.map(c => ({ ...c, maxAttempts: 40 }))
    };
  } else {
    pins.cap = 20;
    pins.protocol = 'standard-20-v1';
    pins.blocks.CURVE = {
      ...pins.blocks.CURVE,
      calls: pins.blocks.CURVE.calls.map(c => ({ ...c, maxAttempts: 20 }))
    };
  }
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
  ys.protocol = protocol;
  return ys;
}
module.exports = { createYardstick };
