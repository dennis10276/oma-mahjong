'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSession } = require('./production_physical_session.js');

function test() {
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2], down: [0, 0, 1, 1],
    rules: null, clock: { i: 0, n: 1 } };
  const session = createSession(actual);
  const state = { ...session.view().state, pictures: [1, 1, null, null] };
  const game = { tiles, nb: actual.nb, rules: null, clock: actual.clock };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const planned = search(game, state, [{ index: 0 }], { ...REFERENCE_PARAMETERS,
    nodes: 16, beam: 8, taps: 2, pruneDead: false });
  assert.deepEqual(planned.path, [0, 1], 'After removing the clock, an outside-cone match that clears the tray must outrank stopping with a carried tile');
  assert(planned.safeClockExit); assert.equal(planned.clockRoom, 4);
  assert(!planned.knownWin); assert(!planned.knownDead);
  session.tap(0); assert.equal(session.view().state.alive[0], 0);
  session.tap(1); assert.deepEqual(session.view().state.tray, []);
  assert.equal(session.view().state.moves, 2);
  console.log('PASS clock-exit ordering evaluates post-clock recovery by actual tray room, not obsolete clock-cone membership, and replays the outside-cone match beyond the removed deadline');
}

if (require.main === module) test();
module.exports = test;
