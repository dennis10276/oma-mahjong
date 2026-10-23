'use strict';
const assert = require('assert/strict');
const layouts = require('../../../www/layouts.js');
const { keyRecoveryPath } = require('./public_key_recovery.js');
const { advance } = require('./known_tray_plan.js');
const { createSession } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function fixture(down) {
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const actual = { tiles, nb: layouts.neighbors(tiles), faces: [1, 2, 1, 2], down,
    rules: { iceNb: layouts.iceNeighbors(tiles), ice: {}, keys: [0, 1], locks: new Set([2, 3]) }, clock: null };
  const game = { tiles, nb: actual.nb, rules: actual.rules, clock: null };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  return { actual, game, state: { alive: [1, 1, 1, 1], down: down.slice(), pictures: [1, 2, 1, 2],
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] } };
}

function test() {
  for (const down of [[0, 0, 0, 0], [1, 1, 0, 0]]) {
    const { actual, game, state } = fixture(down), snapshot = JSON.stringify(state), taps = down[0] ? 6 : 4;
    const recovered = keyRecoveryPath(game, state, 0, taps);
    assert(recovered && recovered.knownKeysRemoved && recovered.removed === 4 && recovered.path.length === taps);
    assert(!recovered.state.alive.some(Boolean) && recovered.state.tray.length === 0);
    const settings = { seed: 1, choiceLimit: 32, tapMs: 1000 }, session = createSession(actual, settings);
    let position = state;
    for (const index of recovered.path) {
      const moved = advance(game, position, index); assert(!moved.uncertain && !moved.lost);
      const frame = session.tap(index);
      for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(frame.state[field], moved.state[field]);
      position = moved.state;
    }
    assert(session.view().win);
    assert.equal(verifyAttempt(encodeGame(actual), recovered.path, settings, session.audit()), recovered.path.length);
    assert.equal(JSON.stringify(state), snapshot);
    assert.equal(keyRecoveryPath(game, state, 0, taps - 1), null);
    assert.equal(keyRecoveryPath(game, state, 0, taps, Date.now() - 1), null);
    assert.equal(keyRecoveryPath(game, state, 2, taps), null);
    assert.equal(keyRecoveryPath(game, { ...state, pictures: [null, 2, 1, 2] }, 0, taps), null);
    assert.equal(keyRecoveryPath(game, { ...state, pictures: [101, 2, 1, 2] }, 0, taps), null);
    assert.equal(keyRecoveryPath(game, { ...state, tray: [7, 8, 9] }, 0, taps), null);
    const uncertain = { ...game, publicFrontier(position) {
      return { free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [2, 3] };
    } };
    assert.equal(keyRecoveryPath(uncertain, state, 0, taps), null, 'Unknown lock legality must not be silently treated as an unlocked match');
    assert.equal(keyRecoveryPath({ ...game, clock: { i: 3, n: 2 } }, state, 0, taps), null);
    const options = { ...REFERENCE_PARAMETERS, nodes: 1, taps, beam: 1, pruneDead: false, finishKnown: false };
    const roots = [{ index: 0 }, { index: 1 }];
    const bounded = search(game, state, roots, options);
    assert(!bounded.knownWin && !bounded.knownDead && bounded.boundary);
    const expanded = search(game, state, roots, { ...options, keyRecoveryMacros: true });
    assert(expanded.knownWin && !expanded.knownDead && expanded.expandedKeyRecoveries === 1);
    assert.equal(expanded.path.length, taps);
    assert.equal(expanded.nodes, 1);
    const expandedSession = createSession(actual, settings);
    for (const index of expanded.path) expandedSession.tap(index);
    assert(expandedSession.view().win);
    assert.equal(verifyAttempt(encodeGame(actual), expanded.path, settings, expandedSession.audit()), taps);
    const short = search(game, state, roots, { ...options, keyRecoveryMacros: true, taps: taps - 1 });
    assert(!short.knownWin && !short.knownDead && short.boundary);
    const blocked = search(uncertain, state, roots, { ...options, keyRecoveryMacros: true });
    assert(!blocked.knownWin && blocked.expandedKeyRecoveries === 0);
    const expired = search(game, state, roots, { ...options, keyRecoveryMacros: true, deadline: Date.now() - 1 });
    assert(!expired.knownWin && !expired.knownDead && expired.boundary && expired.expandedKeyRecoveries === 0);
    assert.equal(expired.nodes, 0);
    assert.throws(() => search(game, state, roots, { ...options, keyRecoveryMacros: 'yes' }));
  }
  const { game, state } = fixture([0, 0, 0, 0]);
  const { actual } = fixture([0, 0, 0, 0]), settings = { seed: 1, choiceLimit: 32, tapMs: 1000 };
  const partial = createSession(actual, settings); partial.tap(0);
  const partialState = { ...partial.view().state, pictures: [1, 2, 1, 2] };
  const lastKey = keyRecoveryPath(game, partialState, 1, 3);
  assert(lastKey && lastKey.path.length === 3 && lastKey.state.tray.length === 0);
  for (const index of lastKey.path) partial.tap(index);
  assert(partial.view().win);
  assert.equal(verifyAttempt(encodeGame(actual), [0, ...lastKey.path], settings, partial.audit()), 4);
  const clockFirst = keyRecoveryPath({ ...game, clock: { i: 0, n: 1 } }, state, 0, 4);
  assert(clockFirst && !clockFirst.state.alive[0] && !clockFirst.state.alive.some(Boolean));
  const clockActual = { ...actual, clock: { i: 0, n: 1 } }, clockSession = createSession(clockActual, settings);
  for (const index of clockFirst.path) clockSession.tap(index);
  assert(clockSession.view().win);
  assert.equal(verifyAttempt(encodeGame(clockActual), clockFirst.path, settings, clockSession.audit()), 4);
  assert.equal(keyRecoveryPath({ ...game, rules: { ...game.rules, keys: [0] } }, state, 0, 4), null);
  assert.equal(keyRecoveryPath({ ...game, rules: { ...game.rules, keys: [0, 0] } }, state, 0, 4), null);
  assert.throws(() => keyRecoveryPath(game, state, 0, 4, NaN));
  console.log('PASS bounded observed-key recovery and integrated one-node macros construct physical unlock/match wins missed by primitive edges, independently replay in production and refuse unknown roles, crowded trays, clock loss or exhausted tap/deadline budgets');
}

if (require.main === module) test();
module.exports = test;
