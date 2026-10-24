'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { keyAccessPath } = require('./public_key_access.js');
const { keyRecoveryPath } = require('./public_key_recovery.js');
const { advance } = require('./known_tray_plan.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
    { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }];
  const rules = { ice: {}, iceNb: Layouts.iceNeighbors(tiles), keys: [0, 1], locks: new Set([4, 5]) };
  const game = { tiles, nb: Layouts.neighbors(tiles), rules, clock: null };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), pictures: [7, 7, 8, 8, 9, 9], down: tiles.map(() => 0),
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const snapshot = structuredClone(state);
  assert.equal(keyRecoveryPath(game, state, 1, 6), null);
  for (const root of [1, 2, 3]) {
    const plan = keyAccessPath(game, state, root, 6);
    assert(plan.path && plan.path[0] === root);
    assert(plan.nodes > 0 && plan.nodes <= 64);
    assert(!plan.state.alive[0] && !plan.state.alive[1]);
    assert.equal(plan.state.tray.length, 0);
    let position = state;
    for (const index of plan.path) {
      const moved = advance(game, position, index);
      assert(!moved.uncertain && !moved.lost); position = moved.state;
    }
    const actual = { tiles, nb: game.nb, rules, clock: null, faces: state.pictures, down: state.down };
    const settings = { seed: 1, tapMs: 1000, choiceLimit: 32 }, session = createSessionFactory()(actual, settings);
    for (const index of plan.path) session.tap(index);
    for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(session.view().state[field], position[field]);
    assert.equal(verifyAttempt(encodeGame(actual), plan.path, settings, session.audit()), plan.path.length);
  }
  const remembered = { ...state, down: [1, 1, 1, 1, 0, 0] };
  const rememberedPlan = keyAccessPath(game, remembered, 1, 8);
  assert(rememberedPlan.path);
  const rememberedGame = { tiles, nb: game.nb, rules, clock: null, faces: state.pictures, down: remembered.down };
  const rememberedSettings = { seed: 1, tapMs: 1000, choiceLimit: 32 };
  const rememberedSession = createSessionFactory()(rememberedGame, rememberedSettings);
  for (const index of rememberedPlan.path) rememberedSession.tap(index);
  for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(rememberedSession.view().state[field], rememberedPlan.state[field]);
  assert.equal(verifyAttempt(encodeGame(rememberedGame), rememberedPlan.path, rememberedSettings, rememberedSession.audit()), rememberedPlan.path.length);
  assert.equal(keyAccessPath(game, { ...state, pictures: [7, 7, null, 8, 9, 9] }, 1, 6).path, null);
  const uncertain = { ...game, publicFrontier: position => {
    const free = position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, game.nb)
      && (!rules.locks.has(index) || !rules.keys.some(key => position.alive[key])) ? [index] : []);
    return { free, uncertain: position.alive[2] ? [2] : [] };
  } };
  assert.equal(keyAccessPath(uncertain, state, 1, 6).path, null);
  assert.equal(keyAccessPath(game, state, 1, 6, 1).boundary, true);
  assert.equal(keyAccessPath(game, state, 1, 6, 64, 0).path, null);
  assert.equal(keyAccessPath({ ...game, clock: { i: 4, n: 2 } }, state, 1, 6).path, null);
  assert.throws(() => keyAccessPath(game, state, 1, 6, 0));
  assert.deepEqual(state, snapshot);
  const roots = [1, 2, 3].map(index => ({ index }));
  const planned = search(game, state, roots, { ...REFERENCE_PARAMETERS, keyAccessMacros: true, nodes: 64, beam: 2, taps: 6 });
  assert(planned.expandedKeyAccesses > 0);
  assert(planned.keyAccessNodes > 0 && planned.keyAccessNodes <= planned.nodes && planned.nodes <= 64);
  const clocked = { ...game, clock: { i: 4, n: 6 } };
  const clockPlan = search(clocked, state, roots, { ...REFERENCE_PARAMETERS, keyAccessMacros: true, nodes: 64, beam: 2, taps: 6 });
  assert(clockPlan.knownWin);
  const clockGame = { tiles, nb: game.nb, rules, clock: clocked.clock, faces: state.pictures, down: state.down };
  const clockSettings = { seed: 1, tapMs: 1000, choiceLimit: 32 }, clockSession = createSessionFactory()(clockGame, clockSettings);
  for (const index of clockPlan.path) clockSession.tap(index);
  assert(clockSession.view().win);
  assert.equal(verifyAttempt(encodeGame(clockGame), clockPlan.path, clockSettings, clockSession.audit()), clockPlan.path.length);
  const limited = search(game, state, roots, { ...REFERENCE_PARAMETERS, keyAccessMacros: true, nodes: 2, beam: 2, taps: 6 });
  assert(limited.nodes <= 2 && limited.boundary && !limited.knownDead);
  assert.throws(() => search(game, state, roots, { ...REFERENCE_PARAMETERS, keyAccessMacros: 'yes' }));
  console.log('PASS bounded public key-access planning prepares obstructed keys through observed matching pairs, handles remembered closed taps, independently replays every witness and preserves unknown/deadline/node boundaries');
}

if (require.main === module) test();
module.exports = test;
