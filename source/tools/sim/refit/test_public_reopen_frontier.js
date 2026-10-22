'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { opensKnownFrontier } = require('./public_reopen_frontier.js');
const { createSession } = require('./production_physical_session.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
  const neighbors = Layouts.neighbors(tiles);
  const actual = { tiles, nb: neighbors, faces: [7, 7, 9, 9], down: [1, 0, 0, 0], rules: null, clock: null };
  const session = createSession(actual);
  const state = { ...session.view().state, pictures: [7, null, 9, 9], down: [1, null, 0, 0] };
  const game = { tiles, nb: neighbors, clock: null,
    publicFrontier(position) {
      const free = position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, neighbors) ? [index] : []);
      return { free, uncertain: free.includes(1) ? [1] : [] };
    } };
  for (const field of ['faces', 'rules', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const allowed = game.publicFrontier(state);
  assert(opensKnownFrontier(game, state, 0, allowed));
  assert(!opensKnownFrontier(game, state, 2, allowed));
  assert(!opensKnownFrontier(game, state, 0, { ...allowed, uncertain: [0] }));
  assert(!opensKnownFrontier(game, { ...state, tray: [1, 2, 3] }, 0, allowed));
  const actions = [0, 2, 3].map(index => ({ index }));
  const options = { ...REFERENCE_PARAMETERS, taps: 3, nodes: 32, beam: 16, pruneDead: false };
  const conservative = search(game, state, actions, options);
  assert(conservative.heuristicExcludedRoots.includes(0));
  const digging = search(game, state, actions, { ...options, progressiveReopens: true });
  assert(!digging.heuristicExcludedRoots.includes(0), 'A constructive two-tap removal that opens an information frontier is not an unproductive reopen');
  assert.equal(digging.index, 0); assert(digging.information); assert(!digging.knownWin); assert(!digging.knownDead);
  session.tap(0); assert.equal(session.view().state.moves, 0);
  session.tap(0); assert.equal(session.view().state.moves, 1);
  assert.deepEqual(session.view().state.tray, [7]); assert(session.view().legalTiles.includes(1));
  assert.throws(() => search(game, state, actions, { ...options, progressiveReopens: 'yes' }));
  console.log('PASS remembered closed-tile digging remains available only with a known non-losing removal prefix that opens a new public frontier; it never reads the newly exposed picture');
}

if (require.main === module) test();
module.exports = test;
