'use strict';
const assert = require('assert/strict');
const L = require('../../../www/layouts.js');
const { computePublicOpeningFeatures } = require('./personal_causal_factor_sim.js');

const tiles = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 4, y: 0, z: 0 },
  { x: 8, y: 0, z: 0 },
  { x: 12, y: 0, z: 0 },
  { x: 16, y: 0, z: 0 },
];
const nb = L.neighbors(tiles);
const down = [0, 0, 1, 1, 0, 0];
const first = computePublicOpeningFeatures({ tiles, nb, faces: [10, 1, 20, 30, 1, 2], down, rules: null, clock: { i: 0, n: 4 } });
const swappedHidden = computePublicOpeningFeatures({ tiles, nb, faces: [30, 1, 10, 20, 1, 2], down, rules: null, clock: { i: 0, n: 4 } });
assert.deepEqual(first, swappedHidden);
assert.equal(first.takeableWithTakeableMate, 2);
console.log('PASS public opening causal features ignore face-down and covered pictures while measuring visible mate depth and clock slack');
