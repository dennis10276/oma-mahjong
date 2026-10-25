'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 3, 4, 1, 2, 3, 4], down: tiles.map(() => 0), rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, firstChoices = [];
  for (const retryCompleteWitness of [false, true]) {
    const controller = createHumanController(tiles, { retryCompleteWitness, nodes: 1, taps: 1, beam: 1,
      finishKnown: false, pruneDead: false, continuationPruning: false, rememberAcceptedTaps: true, choiceLimit: 64 });
    const observe = session => {
      const view = session.view(), state = view.state, legal = new Set(view.legalTiles ?? []);
      const frame = observeBoard(tiles, state, null, { picture: index => actual.faces[index],
        role: index => visibleRole(actual, state, index), takeable: index => legal.has(index) });
      controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
        .map(field => [field, state[field]])), frame);
    };
    controller.beginAttempt(); const failed = factory(actual, settings); observe(failed);
    const first = controller.decide().plan;
    firstChoices.push({ index: first.index, path: first.path, knownWin: first.knownWin, nodes: first.nodes });
    for (const index of [0, 1, 2, 3]) { controller.decide(); controller.acknowledge(index, true); failed.tap(index); observe(failed); }
    assert.equal(failed.view().why, 'tray'); controller.completeAttempt('physicalLoss');
    assert.equal(verifyAttempt(encodeGame(actual), [0, 1, 2, 3], settings, failed.audit()), 4);
    controller.beginAttempt(); const retry = factory(actual, settings); observe(retry);
    let decision = controller.decide();
    const next = decision.plan;
    assert.equal(next.knownWin, retryCompleteWitness);
    const actions = [];
    while (retry.view().type !== 'productionPhysicalEnd-v1') {
      const index = decision.plan.index;
      assert(retry.view().legalTiles.includes(index));
      actions.push(index); controller.acknowledge(index, true); retry.tap(index); observe(retry);
      if (retry.view().type !== 'productionPhysicalEnd-v1') decision = controller.decide();
    }
    assert(retry.view().win);
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retry.audit()), actions.length);
    if (retryCompleteWitness) {
      assert(controller.retryCompletionStats().wins > 0);
      assert.deepEqual(controller.retryCompletionStats().solvedAttempts, [2]);
    }
  }
  assert.deepEqual(firstChoices[0], firstChoices[1]);
  factory.verifySource();
  console.log('PASS real lost attempts preserve the first-try policy and actual memory; retry-only complete witnesses become retained physical winning routes and independently replay every failed and successful tap');
}
if (require.main === module) test();
module.exports = test;
