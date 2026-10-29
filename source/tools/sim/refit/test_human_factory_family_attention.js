'use strict';
const assert = require('assert/strict');
const { createFactoryController, PROFILES } = require('./human_factory_controller.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }];
  const observedHorizons = new Set();
  for (let seed = 1; seed <= 50; seed++) {
    const c = createFactoryController(tiles, PROFILES.family, seed);
    c.beginAttempt();
    const attention = c.planningAttention();
    assert([2, 3].includes(attention.clockHorizon), 'Family clock horizon must stay bounded within 2 or 3 steps');
    observedHorizons.add(attention.clockHorizon);
  }
  assert.equal(observedHorizons.size, 2, 'Default family profile must exhibit natural per-attempt clock attention variability (horizons 2 and 3)');
  console.log('PASS default family profile exhibits natural clock attention variability between 2 and 3 steps');
}

if (require.main === module) test();
module.exports = test;
