'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), pictures: [1, 1, 2, 2, null, null], down: [0, 0, 0, 0, 1, 1],
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const options = { ...REFERENCE_PARAMETERS, taps: 6, nodes: 128, beam: 16, pruneDead: false,
    goalRecovery: true, goalRecoveryMin: 1, riskFirstRecovery: true, alternativeRecoveryRoutes: true,
    knownPairMacros: true, cachePublicAnalysis: true };
  const roots = tiles.map((tile, index) => ({ index }));
  const original = search(game, state, roots, options);
  const shorter = search(game, state, roots, { ...options, shortInformation: true });
  assert(original.information && original.path.length > 1);
  assert(shorter.information && shorter.path.length === 1 && shorter.index >= 4);
  assert(!shorter.knownWin && !shorter.knownDead);
  assert.deepEqual(search(game, state, roots, { ...options, shortInformation: false }), original);
  const known = { ...state, pictures: [1, 1, 2, 2, 3, 3], down: tiles.map(() => 0) };
  assert(search(game, known, roots, { ...options, shortInformation: true }).knownWin);
  const clocked = { ...game, clock: { i: 0, n: 3 } };
  for (const field of ['index', 'path', 'goal', 'safeClockExit', 'knownWin', 'knownDead']) {
    assert.deepEqual(search(clocked, state, roots, { ...options, shortInformation: true })[field],
      search(clocked, state, roots, options)[field]);
  }
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 32, tapMs: 1000 };
  for (const hidden of [...Array(36).keys(), 101]) {
    const actual = { tiles, nb: game.nb, faces: [1, 1, 2, 2, hidden, hidden], down: state.down, rules: null, clock: null };
    const session = factory(actual, settings), after = session.tap(shorter.index);
    assert.equal(after.state.moves, 0);
    assert.equal(after.state.openPeek, shorter.index);
    assert.deepEqual(after.state.tray, []);
    assert.equal(verifyAttempt(encodeGame(actual), shorter.path, settings, session.audit()), 1);
  }
  factory.verifySource();
  assert.throws(() => search(game, state, roots, { ...options, shortInformation: 'yes' }));
  console.log('PASS short safe information ordering prefers an earlier observation over bulk known-pair progress, preserves wins and clock ordering, and independently replays all37 unseen identities without sampling them');
}

if (require.main === module) test();
module.exports = test;
