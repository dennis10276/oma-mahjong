'use strict';
const assert = require('assert/strict');
const L = require('../../../www/layouts.js');
const { preFinalState } = require('./personal_failure_stage_audit.js');
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 0 }];
const game = { tiles, nb: L.neighbors(tiles), down: [0, 0, 1], clock: { i: 0, n: 2 } };
const frames = [{ index: 2, kind: 'flip', alive: [1, 1, 1], moves: 0, tray: [], openPeek: 2 },
  { index: 1, kind: 'take', alive: [1, 0, 1], moves: 1, tray: [0], openPeek: 2 },
  { index: 0, kind: 'take', alive: [0, 0, 1], moves: 2, tray: [], openPeek: 2 }];
const beforeFirstTake = preFinalState(game, frames.slice(0, 2));
assert.equal(beforeFirstTake.remaining, 3);
assert.equal(beforeFirstTake.knownRemaining, 2);
assert.equal(beforeFirstTake.clockBudget, 2);
const beforeFinalTake = preFinalState(game, frames);
assert.equal(beforeFinalTake.remaining, 2);
assert.equal(beforeFinalTake.knownRemaining, 2);
assert.equal(beforeFinalTake.clockBudget, 1);
assert.equal(beforeFinalTake.tray, 1);
assert.deepEqual(preFinalState({ ...game, faces: [8, 9, 10] }, frames), beforeFinalTake);
assert.throws(() => preFinalState(game, []), /AssertionError/);
console.log('PASS failure stage observes prior real taps only, never the final reveal');
