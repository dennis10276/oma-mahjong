'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { clockRetryExploration, clockExitPrefix } = require('./public_clock_retry_exploration.js');
const { createRetryRiskMemory } = require('./public_retry_risk_memory.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt, createHumanController, playHumanCampaign } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 9, 9, 7, 8],
    down: [0, 0, 0, 0, 0, 1, 0, 0], rules: null, clock: { i: 5, n: 10 } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const memory = createRetryRiskMemory(actual.clock), failed = factory(actual, settings);
  memory.beginAttempt();
  const failedActions = [5, 6, 7, 0, 2];
  for (const index of failedActions) {
    const before = failed.view().state;
    memory.observeTransition(before, index, failed.tap(index).state);
  }
  assert.equal(failed.view().why, 'tray');
  assert(failed.view().state.alive[5]);
  assert.deepEqual(memory.finish('physicalLoss'), { index: 0, penalty: 1 });
  assert.equal(verifyAttempt(encodeGame(actual), failedActions, settings, failed.audit()), failedActions.length);
  const retry = factory(actual, settings), prefix = [5, 6, 7];
  for (const index of prefix) retry.tap(index);
  const state = { ...retry.view().state, pictures: [1, 1, 2, 2, 9, 9, null, null] };
  const game = { tiles, nb: actual.nb, rules: null, clock: actual.clock,
    publicRetryCost: index => memory.cost(state, index) };
  for (const field of ['faces', 'down', 'seed', 'deck']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const actions = state.alive.flatMap((alive, index) => alive ? [{ index }] : []);
  const primary = { index: 0, path: [0], nodes: 6, knownWin: false, knownDead: false, safeClockExit: false,
    information: false, knownProgress: 1, boundary: true };
  const candidate = { ...primary, index: 1, path: [1, 0, 5, 4], nodes: 4, safeClockExit: true, knownProgress: 4 };
  const calls = [];
  const wrapper = clockRetryExploration((snapshot, position, roots, options) => {
    calls.push({ roots, options }); return calls.length === 1 ? primary : candidate;
  });
  const selected = wrapper(game, state, actions, { nodes: 32, decisionMs: 1500 });
  assert.equal(selected.index, 1);
  assert.equal(selected.nodes, 10);
  assert(selected.clockRetryExploration.adopted);
  assert(!calls[1].roots.some(action => action.index === 0));
  assert.equal(calls[1].options.nodes, 26);
  assert.equal(calls[0].options.deadline, calls[1].options.deadline);
  assert.equal(calls[1].options.decisionMs, undefined);
  for (const index of selected.path) retry.tap(index);
  assert(!retry.view().state.alive[5]);
  assert.deepEqual(retry.view().state.tray, [7, 8]);
  assert.equal(verifyAttempt(encodeGame(actual), [...prefix, ...selected.path], settings, retry.audit()), prefix.length + selected.path.length);
  assert.equal(clockExitPrefix(game, state, candidate.path, 0), null);
  assert.equal(clockExitPrefix({ ...game, clock: { i: 5, n: state.moves + 1 } }, state, candidate.path), null);
  assert.equal(clockExitPrefix(game, { ...state, pictures: state.pictures.map((picture, index) => index === 5 ? null : picture) }, candidate.path), null);
  for (const report of [{ ...primary, knownWin: true }, { ...primary, safeClockExit: true }, { ...primary, knownDead: true }]) {
    let count = 0;
    assert.equal(clockRetryExploration(() => { count++; return report; })(game, state, actions, { nodes: 32 }), report);
    assert.equal(count, 1);
  }
  for (const options of [{ nodes: 6 }, { nodes: 32, deadline: 0 }]) {
    let count = 0;
    assert.equal(clockRetryExploration(() => { count++; return primary; })(game, state, actions, options), primary);
    assert.equal(count, 1);
  }
  let falseCalls = 0;
  const unsupported = { ...candidate, path: [1, 0, 5, 4], knownWin: false };
  const unknown = { ...state, pictures: state.pictures.map((picture, index) => index === 5 ? null : picture) };
  const refused = clockRetryExploration(() => ++falseCalls === 1 ? primary : unsupported)(game, unknown, actions, { nodes: 32 });
  assert.equal(refused.index, primary.index);
  assert(!refused.clockRetryExploration.adopted);
  assert.throws(() => clockRetryExploration(() => ({ ...primary, nodes: 33 }))(game, state, actions, { nodes: 32 }), /shared node budget/);
  let overflowCalls = 0;
  assert.throws(() => clockRetryExploration(() => ++overflowCalls === 1 ? primary : { ...candidate, nodes: 27 })
    (game, state, actions, { nodes: 32 }), /remaining node budget/);
  for (const unmarked of [{ ...game, publicRetryCost: undefined }, { ...game, publicRetryCost: () => 0 }]) {
    let count = 0;
    assert.equal(clockRetryExploration(() => { count++; return primary; })(unmarked, state, actions, { nodes: 32 }), primary);
    assert.equal(count, 1);
  }
  assert.throws(() => clockRetryExploration(() => primary)({ ...game, publicRetryCost: () => -1 }, state, actions, { nodes: 32 }));
  assert.throws(() => createHumanController(tiles, { clockRetryLearning: true }), /requires actual retry learning/);
  assert.throws(() => createHumanController(tiles, { retryRiskLearning: true, clockRetryLearning: 1 }));
  const completeTiles = tiles.concat([{ x: 32, y: 0, z: 0 }, { x: 36, y: 0, z: 0 }]);
  const complete = { ...actual, tiles: completeTiles, nb: Layouts.neighbors(completeTiles),
    faces: actual.faces.concat([7, 8]), down: actual.down.concat([0, 0]) };
  const campaign = playHumanCampaign(complete, { maximumAttempts: 2,
    planning: { retryRiskLearning: true, clockRetryLearning: true } });
  assert.equal(campaign.wonOn, 1);
  assert.equal(campaign.verifiedTaps, campaign.attempts[0].taps);
  assert.deepEqual(campaign.retryRisks, []);
  assert.deepEqual(campaign.clockRetry, { decisionsAudited: 0, decisionsUsingAlternative: 0 });
  factory.verifySource();
  console.log('PASS a real active-clock loss teaches a retry risk, a lower-risk physical route is adopted only with a verified safe clock exit, unknowns and tight clocks are refused, and every search shares one node/deadline budget');
}

if (require.main === module) test();
module.exports = test;
