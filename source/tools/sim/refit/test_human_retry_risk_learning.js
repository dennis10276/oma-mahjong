'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 8, 7, 7, 8],
    down: [0, 0, 0, 0, 1, 1, 0, 0], rules: null, clock: null };
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, factory = createSessionFactory();
  const choices = [];
  for (const retryRiskLearning of [false, true]) {
    const controller = createHumanController(tiles, { retryRiskLearning, inspectBeforeCommit: 'recovery', inspectionTrayLimit: 1 });
    const observe = session => {
      const state = session.view().state;
      const observed = observeBoard(tiles, state, actual.clock,
        { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) });
      controller.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
        relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps }, observed);
    };
    const start = () => { controller.beginAttempt(); const session = factory(actual, settings); observe(session); return session; };
    const force = (session, index) => {
      controller.decide(); controller.acknowledge(index, true); session.tap(index); observe(session);
    };
    const failed = start();
    for (const index of [6, 7, 0, 2]) force(failed, index);
    assert.equal(failed.view().why, 'tray');
    controller.completeAttempt('physicalLoss');
    assert.equal(controller.retryEvidence().length, +retryRiskLearning);
    assert.equal(verifyAttempt(encodeGame(actual), [6, 7, 0, 2], settings, failed.audit()), 4);
    const retried = start();
    for (const index of [6, 7]) force(retried, index);
    const selected = controller.decide(); choices.push(selected.plan.index);
    if (retryRiskLearning) {
      assert.notEqual(selected.plan.index, 0);
      assert(selected.plan.retryExploration?.adopted);
    } else assert.equal(selected.plan.index, 0);
    const actions = [6, 7];
    let decision = selected;
    while (retried.view().type !== 'productionPhysicalEnd-v1') {
      assert(actions.length < 64);
      const index = decision.plan.index;
      assert(retried.view().legalTiles.includes(index));
      controller.acknowledge(index, true); actions.push(index); retried.tap(index); observe(retried);
      if (retried.view().type !== 'productionPhysicalEnd-v1') decision = controller.decide();
    }
    assert(retried.view().win);
    controller.completeAttempt('cleared');
    if (retryRiskLearning) assert.equal(controller.retryEvidence()[0].penalty, 1);
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retried.audit()), actions.length);
  }
  assert.notEqual(choices[0], choices[1]);
  const independent = createHumanController(tiles, { retryRiskLearning: true });
  assert.deepEqual(independent.retryEvidence(), []);
  assert.throws(() => createHumanController(tiles, { retryRiskLearning: 'yes' }));
  factory.verifySource();
  console.log('PASS the human controller learns only a real earlier lost attempt, changes its subsequent choice without hidden reads or free restarts, independently replays both campaigns and keeps new-level memory separate');
}

if (require.main === module) test();
module.exports = test;
