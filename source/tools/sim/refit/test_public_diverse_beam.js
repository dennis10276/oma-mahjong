'use strict';
const assert = require('assert/strict');
const { selectBeam } = require('./public_diverse_beam.js');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { legal, advance } = require('./known_tray_plan.js');
const { createSession } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const ranked = [0, 0, 0, 1, 1, 2, 3].map((root, offset) => Object.freeze({ path: Object.freeze([root, offset]), rank: [9 - offset] }));
  Object.freeze(ranked);
  assert.deepEqual(selectBeam(ranked, 3), [ranked[0], ranked[3], ranked[5]], 'Keep a best-ranked representative of each available root before filling extra slots');
  assert.deepEqual(selectBeam(ranked, 5), [ranked[0], ranked[1], ranked[3], ranked[5], ranked[6]], 'Fill spare slots by global rank and retain global expansion order');
  assert.deepEqual(selectBeam(ranked, 1), [ranked[0]]);
  assert.equal(selectBeam(ranked, 8), ranked);
  assert.deepEqual(selectBeam([], 2), []);
  assert.throws(() => selectBeam(ranked, 0));
  const tiles = Array.from({ length: 16 }, (value, index) => ({ x: Math.floor(index / 4) * 8, y: 0, z: index % 4 }));
  const pictures = [7, 1, 0, 5, 0, 3, 5, 7, 4, 2, 3, 6, 1, 6, 2, 4];
  const down = [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0];
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), pictures, down, tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const frozenState = JSON.stringify(state), actions = legal(game, state).free.map(index => ({ index }));
  const options = { ...REFERENCE_PARAMETERS, nodes: 256, beam: 4, pruneDead: false, knownPairMacros: true };
  const narrow = search(game, state, actions, options);
  assert(!narrow.knownWin && !narrow.knownDead && narrow.boundary);
  const diverse = search(game, state, actions, { ...options, diverseBeam: true });
  assert(diverse.knownWin && diverse.nodes <= options.nodes);
  assert.equal(diverse.tapLimit, narrow.tapLimit);
  const actualGame = { ...game, faces: pictures, down }, settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const session = createSession(actualGame, settings);
  let position = state;
  for (const index of diverse.path) {
    const moved = advance(game, position, index);
    assert(!moved.lost && !moved.uncertain);
    const actual = session.tap(index);
    for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(actual.state[field], moved.state[field]);
    position = moved.state;
  }
  assert(session.view().win);
  assert.equal(verifyAttempt(encodeGame(actualGame), diverse.path, settings, session.audit()), diverse.path.length);
  assert.equal(JSON.stringify(state), frozenState);
  const limited = search(game, state, actions, { ...options, diverseBeam: true, nodes: 1 });
  assert(limited.boundary && !limited.knownDead && limited.nodes <= 1);
  const expired = search(game, state, actions, { ...options, diverseBeam: true, deadline: Date.now() - 1 });
  assert(expired.boundary && !expired.knownDead && expired.nodes === 0);
  assert.throws(() => search(game, state, actions, { ...options, diverseBeam: 'yes' }));
  console.log('PASS diverse public-root beams retain bounded alternatives and find a missed winning setup, with every tap independently replayed through original production; caps remain unresolved');
}

if (require.main === module) test();
module.exports = test;
