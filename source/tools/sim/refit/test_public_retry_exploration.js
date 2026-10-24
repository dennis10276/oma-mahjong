'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { retryExploration } = require('./public_retry_exploration.js');
const { createRetryRiskMemory } = require('./public_retry_risk_memory.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 8, 7, 7, 8],
    down: [0, 0, 0, 0, 1, 1, 0, 0], rules: null, clock: null };
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 32 }, factory = createSessionFactory();
  const failed = factory(actual, settings), memory = createRetryRiskMemory();
  memory.beginAttempt();
  for (const index of [6, 7, 0, 2]) {
    const before = failed.view().state;
    memory.observeTransition(before, index, failed.tap(index).state);
  }
  assert.equal(failed.view().why, 'tray');
  assert.deepEqual(memory.finish('physicalLoss'), { index: 0, penalty: 1 });
  assert.equal(verifyAttempt(encodeGame(actual), [6, 7, 0, 2], settings, failed.audit()), 4);
  const replay = factory(actual, settings); replay.tap(6); replay.tap(7);
  const state = { ...replay.view().state, pictures: [1, 1, 2, 2, null, null, null, null] };
  const game = { tiles, nb: actual.nb, rules: null, clock: null, publicRetryCost: index => memory.cost(state, index) };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const actions = [0, 1, 2, 3, 4, 5].map(index => ({ index }));
  const primary = { index: 0, path: [0, 4], goal: 'information', knownWin: false, knownDead: false,
    safeClockExit: false, information: true, knownProgress: 1, nodes: 6, boundary: true };
  const alternative = { ...primary, index: 2, path: [2, 3, 4], knownProgress: 2, nodes: 4 };
  const calls = [];
  const wrapper = retryExploration((snapshot, position, roots, options) => {
    assert.equal(snapshot, game); assert.equal(position, state);
    calls.push({ roots: roots.map(root => root.index), options });
    return roots.some(root => root.index === 0) ? primary : alternative;
  });
  const selected = wrapper(game, state, actions, { nodes: 32, decisionMs: 1500 });
  assert.equal(selected.index, 2); assert(selected.retryExploration.adopted);
  assert.equal(selected.nodes, 10);
  assert(!calls[1].roots.includes(0)); assert.equal(calls[1].options.nodes, 26);
  assert.equal(calls[0].options.deadline, calls[1].options.deadline);
  assert.equal(calls[1].options.decisionMs, undefined);
  assert.equal(selected.retryExploration.safety.finalTray, 2);
  const actionsPlayed = [6, 7, ...selected.path, 0, 1, 5];
  for (const index of actionsPlayed.slice(2)) replay.tap(index);
  assert(replay.view().win);
  assert.equal(verifyAttempt(encodeGame(actual), actionsPlayed, settings, replay.audit()), actionsPlayed.length);
  const crowded = retryExploration((snapshot, position, roots) => roots.some(root => root.index === 0)
    ? primary : { ...alternative, path: [2, 4] });
  const rejected = crowded(game, state, actions, { nodes: 32 });
  assert.equal(rejected.index, primary.index); assert(!rejected.retryExploration.adopted);
  const uncertain = { ...game, publicFrontier: position => ({
    free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [2].filter(index => position.alive[index]),
  }) };
  const stopsAtUnknown = retryExploration((snapshot, position, roots) => roots.some(root => root.index === 0) ? primary : alternative);
  assert(!stopsAtUnknown(uncertain, state, actions, { nodes: 32 }).retryExploration.adopted,
    'An unknown role cannot be crossed to invent a later safe suffix');
  const untouched = retryExploration(() => primary)({ ...game, publicRetryCost: () => 0 }, state, actions, {});
  assert.equal(untouched, primary);
  let boundedCalls = 0;
  const bounded = retryExploration(() => { boundedCalls++; return { ...primary, nodes: 32 }; });
  assert.equal(bounded(game, state, actions, { nodes: 32 }).nodes, 32);
  assert.equal(boundedCalls, 1);
  let urgentCalls = 0;
  const urgent = retryExploration(() => { urgentCalls++; return primary; });
  urgent({ ...game, clock: { i: 3, n: 6 } }, state, actions, { nodes: 32 });
  assert.equal(urgentCalls, 1);
  let expiredCalls = 0;
  retryExploration(() => { expiredCalls++; return primary; })(game, state, actions, { nodes: 32, deadline: 0 });
  assert.equal(expiredCalls, 1);
  const known = { ...state, pictures: [1, 1, 2, 2, 8, 7, null, null] };
  const winning = retryExploration(search)(game, known, actions, { ...REFERENCE_PARAMETERS, decisionMs: 1500 });
  assert(winning.knownWin && !winning.retryExploration);
  assert.throws(() => wrapper({ ...game, publicRetryCost: () => -1 }, state, actions, { nodes: 32 }));
  assert.throws(() => retryExploration(() => ({ ...primary, nodes: 33 }))(game, state, actions, { nodes: 32 }), /shared node budget/);
  factory.verifySource();
  console.log('PASS retry exploration uses a real earlier failed risk, replays an alternative production clear, rejects crowded prefixes, protects clocks/known wins and shares one node/deadline budget without fabricating loss proofs');
}

if (require.main === module) test();
module.exports = test;
