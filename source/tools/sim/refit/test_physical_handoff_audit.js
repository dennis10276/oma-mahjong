'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { handoffOf, matchesState } = require('./physical_handoff_audit.js');
const tiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
const recorded = { g: { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1, 2, 2], down: [0, 1, 0, 0, 1, 1] },
  take: [0, 1, -5], actions: [
    { index: 0, kind: 'take', moves: 1, followEnd: 1, alive: [0, 1, 1, 1, 1, 1], tray: [0], openPeek: -1 },
    { index: 1, kind: 'take', moves: 2, followEnd: 2, alive: [0, 0, 1, 1, 1, 1], tray: [], openPeek: -1 },
    { index: 4, kind: 'flip', moves: 2, followEnd: 3, alive: [0, 0, 1, 1, 1, 1], tray: [], openPeek: 4 }] };
const actor = { ...Hard.P, physicalFlips: true, peek: 0, end: 0, plan: 0 };
for (let count = 0; count <= recorded.actions.length; count++) {
  const game = handoffOf(recorded, count);
  const result = Hard.play({ ...game, follow: [] }, actor, 1);
  assert(matchesState(game, result, recorded.actions[count - 1]));
  assert(game.peekedAtStart.every(index => recorded.actions.slice(0, count).some(action => action.index === index)));
}
assert.throws(() => handoffOf(recorded, -1));
assert.throws(() => handoffOf(recorded, 4));
const corrupted = { ...recorded.actions[2], moves: 99 };
const game = handoffOf(recorded, 3);
assert.equal(matchesState(game, Hard.play({ ...game, follow: [] }, actor, 1), corrupted), false);
console.log('PASS handoff diagnostics preserve physical observed state and never add future inspections');
