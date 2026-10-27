'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createReusableExploration } = require('./public_reusable_exploration.js');
const { retryInformationSearch } = require('./public_retry_information.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');
const { createHumanController, verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: .28, y: .28 / 1.24, z: 1 }, { x: 1, y: 0, z: 1 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 },
    { x: 12.28, y: .28 / 1.24, z: 1 }, { x: 20, y: 0, z: 0 }];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [10, 7, 9, 7, 11, 9, 2, 2],
    down: tiles.map(() => 0), rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const initial = factory(actual, settings).view().state;
  const packet = observeBoard(tiles, initial, null, { picture: index => actual.faces[index], role: () => 'none' });
  const state = { ...initial, pictures: packet.pictures, down: packet.down }, before = structuredClone(state);
  const model = { tiles, nb: actual.nb, rules: null, clock: null }, roots = [{ index: 1 }, { index: 6 }];
  const engine = createReusableExploration({ preferInvestedWork: true });
  const config = { version: 'same-public', revalidatePublicChanges: true, continueAfterInformation: true, nodes: 1000 };
  const first = engine.search(model, state, roots, { ...config, consumeInformation: false });
  const held = engine.search(model, state, roots, { ...config, consumeInformation: false });
  assert.equal(first.kind, 'newPublicExposure'); assert.deepEqual(held.path, first.path); assert.equal(held.nodes, 0);
  assert.equal(engine.stats().yieldedInformation, 1);
  const consumed = engine.search(model, state, roots, config), alternative = engine.search(model, state, roots, config);
  assert.deepEqual(consumed.path, first.path); assert.notDeepEqual(alternative.path, first.path);
  assert.equal(engine.stats().createdJobs, 1); assert.deepEqual(state, before);
  const replay = (game, route) => {
    const session = factory(game, settings);
    for (const index of route) { assert(session.view().legalTiles.includes(index)); session.tap(index); }
    assert(!session.view().lost);
    return { taps: verifyAttempt(encodeGame(game), route, settings, session.audit()), frame: session.view() };
  };
  let replayedTaps = replay(actual, consumed.path).taps + replay(actual, alternative.path).taps;
  let primary = { index: 2, path: [2], knownWin: false, knownDead: false, safeClockExit: false, nodes: 0 };
  const memory = { pictures: packet.pictures, down: packet.down, initialRoles: packet.roles };
  const options = { reusablePlanning: true, continueAfterInformation: true, retainInvestedWork: true,
    warmPlanning: true, contextVersion: () => 'same-public', nodes: 1000, milliseconds: 100 };
  const policy = retryInformationSearch(() => primary, options); policy.beginAttempt(memory);
  for (let call = 0; call < 3; call++) assert.equal(policy.search(model, state, roots), primary);
  assert.equal(policy.stats().warmSearches, 3); assert.equal(policy.stats().warmInformationHeld, 3);
  assert.equal(policy.stats().reusable.yieldedInformation, 1); assert.deepEqual(state, before);
  for (const protection of ['knownWin', 'safeClockExit']) {
    primary = { ...primary, [protection]: true }; assert.equal(policy.search(model, state, roots), primary);
    primary = { ...primary, [protection]: false };
  }
  assert.equal(policy.stats().warmSearches, 3);
  const flatTiles = [0, 8, 16, 24].map(position => ({ x: position, y: 0, z: 0 }));
  const flat = { tiles: flatTiles, nb: Layouts.neighbors(flatTiles), rules: null, clock: null };
  const complete = { ...flat, faces: [1, 1, 2, 2], down: [0, 0, 0, 0] };
  const known = { ...factory(complete, settings).view().state, pictures: complete.faces.slice() };
  const prepared = retryInformationSearch(() => primary, { ...options, nodes: 1 });
  prepared.beginAttempt({ pictures: known.pictures, down: known.down, initialRoles: flatTiles.map(() => 'none') });
  let winner = null;
  for (let call = 0; call < 100 && !winner; call++) {
    const report = prepared.search(flat, known, flatTiles.map((tile, index) => ({ index })));
    if (report.knownWin) winner = report; else assert.equal(report, primary);
  }
  assert(winner?.knownWin && winner.retryInformationWitness.warmedCompleteWin);
  assert.equal(prepared.stats().warmKnownWins, 1); assert(prepared.stats().reusable.resumedUnfinished > 0);
  const winningReplay = replay(complete, winner.path); assert(winningReplay.frame.win); replayedTaps += winningReplay.taps;
  assert.throws(() => createReusableExploration().search(flat, known, [{ index: 0 }], { version: 'public', consumeInformation: false }));
  assert.throws(() => retryInformationSearch(() => primary, { warmPlanning: true }));
  assert.throws(() => createHumanController(flatTiles, { reusableWarmPlanning: true }));
  factory.verifySource();
  console.log('PASS warm planning prepares unfinished work before stalls, holds information offers until eligibility without changing normal choices or memory, protects existing wins/clock exits, and only a complete public win overrides early; ' + replayedTaps + ' production taps independently replay');
}

if (require.main === module) test();
module.exports = test;
