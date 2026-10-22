'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSession } = require('./production_physical_session.js');

function test() {
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const actualGame = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 9, 9],
    down: [0, 0, 0, 1], rules: null, clock: null };
  const session = createSession(actualGame);
  session.tap(2);
  const initial = session.view().state;
  const state = { ...initial, pictures: [1, 1, null, null] };
  const game = { tiles, nb: actualGame.nb, rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const options = { ...REFERENCE_PARAMETERS, taps: 2, nodes: 1, beam: 1, pruneDead: false };
  const unexpanded = search(game, state, [{ index: 0 }], options);
  assert.equal(unexpanded.knownProgress, 1);
  const paired = search(game, state, [{ index: 0 }], { ...options, knownPairMacros: true });
  assert.deepEqual(paired.path, [0, 1], 'A face-up pair must be completed before pruning its intermediate unmatched carry');
  assert.equal(paired.knownProgress, 2);
  assert.equal(paired.expandedKnownPairs, 1);
  assert.equal(paired.tapLimit, 2); assert(!paired.knownDead); assert(!paired.knownWin);
  for (const index of paired.path) session.tap(index);
  const after = session.view().state;
  assert.deepEqual(after.tray, [9]);
  assert.deepEqual(after.alive, [0, 0, 0, 1]);
  const limited = search(game, state, [{ index: 0 }], { ...options, taps: 1, knownPairMacros: true });
  assert.equal(limited.knownProgress, 1); assert.equal(limited.path.length, 1);
  console.log('PASS known face-up pairs survive one-node pruning through two actual physical taps without changing carry pressure or exceeding the tap budget');
}

if (require.main === module) test();
module.exports = test;
