'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createFailedRouteMemory } = require('./public_retry_risk_memory.js');
const { retryExploration } = require('./public_retry_exploration.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 3, 4, 1, 2, 3, 4],
    down: tiles.map(() => 0), rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const memory = createFailedRouteMemory(), knowledge = 'observed-pictures-roles-orientations-v1';
  let verifiedTaps = 0;
  const run = (actions, status, endingKnowledge = knowledge, choiceLimit = 64) => {
    const session = factory(actual, { ...settings, choiceLimit }), before = [];
    memory.beginAttempt(knowledge);
    for (const index of actions) {
      const prior = session.view().state;
      const after = session.tap(index).state;
      memory.observeTransition(prior, index, after); before.push(prior);
    }
    verifiedTaps += verifyAttempt(encodeGame(actual), actions, { ...settings, choiceLimit }, session.audit());
    return { learned: memory.finish(status, endingKnowledge), before, frame: session.view() };
  };
  const failed = run([0, 1, 2, 3], 'physicalLoss');
  assert.equal(failed.frame.why, 'tray'); assert.equal(failed.learned, 4);
  assert.equal(memory.cost(failed.before[0], 0, knowledge), 1);
  assert.equal(memory.cost(failed.before[0], 1, knowledge), 0);
  assert.equal(memory.cost(failed.before[0], 0, knowledge + '-new-picture'), 0);
  assert.equal(memory.cost({ ...failed.before[0], moves: 100 }, 0, knowledge), 1);
  assert.equal(memory.cost({ ...failed.before[0], openPeek: 6 }, 0, knowledge), 0);
  const saved = JSON.stringify(memory.entries());
  assert.equal(run([0, 1, 2, 3], 'physicalLoss', knowledge + '-new-role').learned, 0);
  assert.equal(run([0, 1], 'unresolvedBudget', knowledge, 2).learned, 0);
  assert.equal(run([0, 4, 1, 5, 2, 6, 3, 7], 'cleared').frame.win, true);
  assert.equal(JSON.stringify(memory.entries()), saved);
  assert.equal(memory.finish('physicalLoss', knowledge), 0);
  for (let repeat = 0; repeat < 4; repeat++) run([0, 1, 2, 3], 'physicalLoss');
  assert.equal(memory.cost(failed.before[0], 0, knowledge), 3);
  assert(memory.entries().every(entry => entry.kind === 'failedRoutePreference' && entry.provedLoss === false));
  assert.equal(createFailedRouteMemory().cost(failed.before[0], 0, knowledge), 0);
  const state = { ...failed.before[0], pictures: [1, 2, 3, 4, null, null, null, null] };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(state, field,
    { get() { throw Error('Private failed-route state ' + field); } });
  const game = { tiles, nb: actual.nb, rules: null, clock: null,
    publicRetryCost: index => memory.cost(state, index, knowledge) };
  const primary = { index: 0, path: [0, 4], nodes: 1, knownWin: false, knownDead: false,
    safeClockExit: false, information: true, knownProgress: 1, boundary: true };
  const wrapper = retryExploration((snapshot, position, roots) => roots.some(root => root.index === 0)
    ? primary : { ...primary, index: 1, path: [1, 5] });
  const alternative = wrapper(game, state, [0, 1, 2, 3].map(index => ({ index })), { nodes: 8 });
  assert.equal(alternative.index, 1); assert(alternative.retryExploration.adopted);
  assert.equal(alternative.knownDead, false);
  for (const protectedReport of [{ ...primary, knownWin: true }, { ...primary, safeClockExit: true }]) {
    assert.strictEqual(retryExploration(() => protectedReport)(game, state,
      [{ index: 0 }, { index: 1 }], { nodes: 8 }), protectedReport);
  }
  const controller = createHumanController(tiles, { retryRiskLearning: true, retryFailedRouteLearning: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    controller.beginAttempt(); const session = factory(actual, settings);
    const observe = () => {
      const frame = session.view(), physical = frame.state, takeable = new Set(frame.legalTiles ?? []);
      const seen = observeBoard(tiles, physical, null, { picture: index => actual.faces[index],
        role: index => visibleRole(actual, physical, index), takeable: index => takeable.has(index) });
      controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
        .map(field => [field, physical[field]])), seen);
    };
    observe();
    for (const index of [0, 1, 2, 3]) {
      controller.decide(); controller.acknowledge(index, true); session.tap(index); observe();
    }
    controller.completeAttempt('physicalLoss');
    verifiedTaps += verifyAttempt(encodeGame(actual), [0, 1, 2, 3], settings, session.audit());
    assert.equal(controller.retryEvidence().filter(entry => entry.kind === 'failedRoutePreference').length, attempt ? 4 : 0);
  }
  assert.throws(() => createHumanController(tiles, { retryFailedRouteLearning: true }));
  assert.throws(() => createHumanController(tiles, { retryRiskLearning: true, retryFailedRouteLearning: 'yes' }));
  factory.verifySource();
  console.log('PASS failed-route preferences learn earlier actual choices only after a physical loss with unchanged tracked public knowledge, expire when that knowledge changes, protect wins/clock exits, remain separate from loss proofs, and independently replay ' + verifiedTaps + ' production taps. Supplied alternative-search reports are unit inputs, not a campaign improvement.');
}

if (require.main === module) test();
module.exports = test;
