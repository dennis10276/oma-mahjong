'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search } = require('./public_witness_search.js');
const { createSession } = require('./production_physical_session.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 3 }, { x: 8, y: 0, z: 2 },
    { x: 16, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 },
    { x: 8, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }, { x: 32, y: 0, z: 0 }, { x: 36, y: 0, z: 0 }];
  const privateGame = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 10, 10, 20, 30, 20, 30, 4, 4],
    down: [1, 0, 1, 0, 0, 0, 0, 0, 1, 0], rules: null, clock: null };
  const session = createSession(privateGame);
  for (const index of [0, 8, 3, 4, 5]) session.tap(index);
  const actual = session.view().state;
  const pictures = [1, 1, null, null, null, null, null, null, 4, 4];
  const state = { ...actual, pictures, down: actual.down.map((value, index) => pictures[index] === null ? 0 : value) };
  const game = { tiles, nb: privateGame.nb, rules: null, clock: null };
  Object.defineProperty(game, 'faces', { get() { throw Error('Read private faces'); } });
  const report = search(game, state, [{ index: 0 }, { index: 1 }], { taps: 1, nodes: 1, beam: 1, pruneDead: false });
  assert.equal(report.index, 0, 'Known pair preparation must remain available before a face-up fourth tile');
  assert(!report.heuristicExcludedRoots.includes(0)); assert(!report.knownDead);
  const paired = search(game, state, [{ index: 0 }], { taps: 2, nodes: 1, beam: 1, pruneDead: false, knownPairMacros: true });
  assert.deepEqual(paired.path, [0, 1]); assert.equal(paired.knownProgress, 2);
  assert.equal(paired.expandedKnownPairs, 1); assert(!paired.knownDead); assert.equal(paired.tapLimit, 2);
  session.tap(report.index); assert.equal(session.view().state.tray.length, 3);
  session.tap(1); assert.equal(session.view().state.tray.length, 3);
  assert.equal(session.view().state.alive[0], 0); assert.equal(session.view().state.alive[1], 0);
  for (const index of [2, 6, 7, 8, 9]) session.tap(index);
  assert(session.view().win);
  console.log('PASS reopening a remembered free pair remains a productive root under tight budgets and preserves three-slot tray pressure through real production instead of selecting a known losing fourth tile');
}

if (require.main === module) test();
module.exports = test;
