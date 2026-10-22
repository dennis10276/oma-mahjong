'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { roomOf, recoveryOf, search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
  const game = { tiles, nb: Layouts.neighbors(tiles), clock: null,
    publicFrontier(state) { return { free: state.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: state.alive[0] ? [0] : [] }; } };
  for (const field of ['faces', 'seed', 'deck', 'rules']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: [1, 1], down: [0, 0], pictures: [7, 8], tray: [7, 9, 10],
    moves: 0, openPeek: -1, relieved: false, arriving: [] };
  assert.equal(roomOf(game, state).safe, false, 'A remembered picture with unknown mechanical availability is not an immediate escape');
  assert.equal(roomOf(game, state).pressure, 1);
  assert.deepEqual(recoveryOf(game, state), { immediate: 0, stranded: 3 });
  const knownMatch = { ...state, pictures: [7, 7] };
  assert.equal(roomOf(game, knownMatch).safe, true); assert.equal(recoveryOf(game, knownMatch).immediate, 1);
  game.clock = { i: 1, n: 2 };
  const clockState = { ...state, tray: [7, 9], pictures: [7, 2] };
  const report = search(game, clockState, [{ index: 1 }], { ...REFERENCE_PARAMETERS, pruneDead: false });
  assert.equal(report.index, 1); assert.equal(report.safeClockExit, false);
  assert(!report.knownWin); assert(!report.knownDead);
  assert(roomOf(game, clockState).allowed.free.includes(0), 'Uncertain taps remain information candidates, not guaranteed removals');
  console.log('PASS tray safety and clock-exit witnesses require mechanically guaranteed matches; remembered pictures behind uncertain roles remain information frontiers');
}

if (require.main === module) test();
module.exports = test;
