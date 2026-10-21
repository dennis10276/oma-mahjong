'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const Layouts = require('../../../www/layouts.js');
const { replayPrior } = require('./personal_pixel_reference_verify.js');
const prior = replayPrior();
assert.equal(prior.length, 256);
assert.equal(prior.filter(value => value > 0).length, 37);
assert(Math.abs(prior.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
for (let picture = 0; picture < 256; picture++) assert.equal(prior[picture], picture < 36 || picture === 101 ? 1 / 37 : 0);
const game = { tiles: [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }], faces: [2, 2], down: [0, 0],
  rules: null, clock: null, follow: [0, 1], physicalLog: [], log: [] };
game.nb = Layouts.neighbors(game.tiles);
const result = Hard.play(game, { ...Hard.P, physicalFlips: true, allMoves: true, flips: true,
  forceMatches: false, peek: 0, end: 0, plan: 0, physicalPlan: 0, physicalSafety: false,
  publicPicturePrior: prior, kindModel: { weights: {} } }, 1);
assert.equal(result.win, true);
assert.deepEqual(game.physicalLog.map(action => action.index), [0, 1]);
const malformed = { ...game, follow: [0, 1], physicalLog: [] };
assert.throws(() => Hard.play(malformed, { ...Hard.P, physicalFlips: true, publicPicturePrior: prior.slice(0, 102) }), /Invalid public picture prior/);
console.log('PASS independent screenshot replay uses the production256-entry uniform public prior, preserves the37-symbol support and rejects the former truncated prior');
