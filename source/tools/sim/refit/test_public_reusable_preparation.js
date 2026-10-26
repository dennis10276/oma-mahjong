'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { retryInformationSearch } = require('./public_retry_information.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');
const { createHumanController, verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: .28, y: .28 / 1.24, z: 1 }, { x: 1, y: 0, z: 1 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 },
    { x: 12.28, y: .28 / 1.24, z: 1 }, { x: 20, y: 0, z: 0 },
    { x: 24, y: 0, z: 0 }, { x: 28, y: 0, z: 0 }];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [10, 7, 9, 7, 11, 9, 2, 2, 10, 11],
    down: tiles.map(() => 0), rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const physical = factory(actual, settings); physical.tap(8); physical.tap(9);
  const frame = physical.view(), packet = observeBoard(tiles, frame.state, null,
    { picture: index => actual.faces[index], role: () => 'none' });
  const state = { ...frame.state, pictures: packet.pictures, down: packet.down };
  assert.equal(state.tray.length, 2); assert.equal(state.pictures[0], null); assert.equal(state.pictures[4], null);
  const memory = { pictures: packet.pictures, down: packet.down, initialRoles: packet.roles };
  const model = { tiles, nb: actual.nb, rules: null, clock: null };
  for (const field of ['faces', 'seed', 'deck']) Object.defineProperty(model, field, { get() { throw Error('Private ' + field); } });
  const actions = frame.legalTiles.map(index => ({ index }));
  let primary = { index: 2, path: [2], nodes: 0, knownWin: false, knownDead: false, safeClockExit: false };
  const configured = { reusablePlanning: true, contextVersion: () => 'observed', continueAfterInformation: true,
    nodes: 10000, milliseconds: 100, choices: 64 };
  const legacy = retryInformationSearch(() => primary, configured); legacy.beginAttempt(memory);
  assert.equal(legacy.search(model, state, actions), primary); assert.equal(legacy.stats().considered, 0);
  const early = retryInformationSearch(() => primary, { ...configured, prepareCrowded: true }); early.beginAttempt(memory);
  const original = structuredClone(state), result = early.search(model, state, actions);
  assert.equal(result.goal, 'retryInformationWitness'); assert(result.retryInformationWitness.proactive);
  assert.equal(result.retryInformationWitness.kind, 'newPublicExposure');
  assert.equal(early.stats().firstAttemptPreparations, 1); assert.deepEqual(state, original);
  const replay = factory(actual, settings), route = [8, 9, ...result.path];
  for (const index of route) { assert(replay.view().legalTiles.includes(index)); replay.tap(index); }
  assert(!replay.view().lost);
  const after = observeBoard(tiles, replay.view().state, null, { picture: index => actual.faces[index], role: () => 'none' });
  assert(result.retryInformationWitness.newlyExposed.some(index => after.down[index] !== null));
  let replayedTaps = verifyAttempt(encodeGame(actual), route, settings, replay.audit());
  const before = early.stats().considered;
  assert.equal(early.search(model, { ...state, tray: state.tray.slice(0, 1) }, actions), primary);
  assert.equal(early.stats().considered, before);
  const clocked = { ...model, clock: { i: 5, n: state.moves + 9 } };
  assert.equal(early.search(clocked, state, actions), primary); assert.equal(early.stats().considered, before);
  early.search({ ...clocked, clock: { i: 5, n: state.moves + 10 } }, state, actions);
  assert.equal(early.stats().considered, before + 1);
  for (const protection of ['knownWin', 'safeClockExit']) {
    primary = { ...primary, [protection]: true };
    assert.equal(early.search(model, state, actions), primary); primary = { ...primary, [protection]: false };
  }
  assert.equal(early.stats().considered, before + 1);
  assert.throws(() => retryInformationSearch(() => primary, { prepareCrowded: true }));
  assert.throws(() => createHumanController(tiles, { reusablePrepareCrowded: true }));
  const bounded = retryInformationSearch(() => primary, { ...configured, prepareCrowded: true, preparationClockRange: [20, 40] });
  bounded.beginAttempt(memory);
  for (const clockMoves of [null, 19, 20, 40, 41]) {
    const prior = bounded.stats().considered;
    const game = { ...model, clock: clockMoves === null ? null : { i: 5, n: state.moves + clockMoves } };
    const report = bounded.search(game, state, actions);
    assert.equal(bounded.stats().considered, prior + +(clockMoves !== null && clockMoves >= 20 && clockMoves <= 40));
    if (report.retryInformationWitness?.proactive) {
      assert.equal(report.retryInformationWitness.preparationStartedAtClockRemaining, clockMoves);
      assert.equal(report.retryInformationWitness.preparationStartedAtTrayCount, 2);
    }
  }
  for (const range of [[40, 20], [20], [20, Infinity]])
    assert.throws(() => retryInformationSearch(() => primary, { ...configured, prepareCrowded: true, preparationClockRange: range }));
  assert.throws(() => createHumanController(tiles, { reusablePreparationClockRange: [20, 40] }));
  const controller = createHumanController(tiles, { retryInformationWitness: true, deadEndInformation: true,
    reusablePublicPlanning: true, reusableContinueAfterInformation: true, reusablePrepareCrowded: true,
    nodes: 128, decisionMs: 50, retryInformationNodes: 10000 });
  const controlled = factory(actual, settings);
  const observe = () => {
    const current = controlled.view(), position = current.state, takeable = new Set(current.legalTiles);
    controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
      .map(field => [field, position[field]])), observeBoard(tiles, position, null,
    { picture: index => actual.faces[index], role: () => 'none', takeable: index => takeable.has(index) }));
  };
  controller.beginAttempt(); observe();
  for (const index of [8, 9]) { controller.decide(); controller.acknowledge(index, true); controlled.tap(index); observe(); }
  controller.decide(); assert(controller.retryInformationStats().firstAttemptPreparations > 0);
  replayedTaps += verifyAttempt(encodeGame(actual), [8, 9], settings, controlled.audit());
  factory.verifySource();
  console.log('PASS early reusable preparation starts on first attempts only at tray >=2 and clock >=10 or absent, preserves wins/clock exits, retains public memory and independently replays ' + replayedTaps + ' safe exposure taps');
}

if (require.main === module) test();
module.exports = test;
