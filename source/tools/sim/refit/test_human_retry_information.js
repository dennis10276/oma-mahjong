'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { createMeasurer } = require('./human_level_measure.js');

function test() {
  const tiles = Array.from({ length: 10 }, (value, index) => ({ x: index * 4, y: 0, z: 0 }));
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, firstChoices = [], retryChoices = [];
  for (const hidden of [1, 5]) for (const retryInformationWitness of [false, true]) {
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [hidden, hidden, 2, 3, 4, 6, 2, 3, 4, 6],
      down: tiles.map((tile, index) => +(index < 2)), rules: null, clock: null };
    const controller = createHumanController(tiles, { retryInformationWitness, nodes: 1, taps: 1, beam: 1,
      finishKnown: false, pruneDead: false, continuationPruning: false, inspectBeforeCommit: false, choiceLimit: 64 });
    const observe = session => {
      const view = session.view(), state = view.state, legal = new Set(view.legalTiles ?? []);
      controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
        .map(field => [field, state[field]])), observeBoard(tiles, state, null,
        { picture: index => game.faces[index], role: index => visibleRole(game, state, index), takeable: index => legal.has(index) }));
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      controller.beginAttempt(); const failed = factory(game, settings); observe(failed);
      if (attempt === 1) {
        const first = controller.decide().plan;
        firstChoices.push({ index: first.index, path: first.path, knownWin: first.knownWin, nodes: first.nodes });
      }
      for (const index of [2, 3, 4, 5]) {
        controller.decide(); controller.acknowledge(index, true); failed.tap(index); observe(failed);
      }
      assert.equal(failed.view().why, 'tray'); controller.completeAttempt('physicalLoss');
      assert.equal(verifyAttempt(encodeGame(game), [2, 3, 4, 5], settings, failed.audit()), 4);
      assert.equal(controller.known().pictures[0], null);
      assert.equal(controller.known().pictures[1], null);
      if (retryInformationWitness) assert.equal(controller.retryInformationStats().considered, 0);
    }
    controller.beginAttempt(); const retry = factory(game, settings); observe(retry);
    let decision = controller.decide();
    retryChoices.push({ index: decision.plan.index, path: decision.plan.path, knownWin: decision.plan.knownWin });
    if (retryInformationWitness) {
      assert.equal(decision.plan.goal, 'retryInformationWitness');
      assert.equal(decision.plan.retryInformationWitness.attempt, 3);
      assert.equal(decision.plan.retryInformationWitness.imaginedPicturesAdded, 0);
      assert.equal(decision.plan.knownWin, false);
    } else assert.equal(decision.plan.retryInformationWitness, undefined);
    assert.equal(controller.known().pictures[0], null);
    const actions = [];
    while (retry.view().type !== 'productionPhysicalEnd-v1') {
      const index = decision.plan.index; assert(retry.view().legalTiles.includes(index));
      actions.push(index); controller.acknowledge(index, true); retry.tap(index); observe(retry);
      if (retry.view().type !== 'productionPhysicalEnd-v1') decision = controller.decide();
      assert(actions.length <= 64);
    }
    assert(retry.view().win); controller.completeAttempt('cleared');
    assert.equal(verifyAttempt(encodeGame(game), actions, settings, retry.audit()), actions.length);
    if (retryInformationWitness) {
      const stats = controller.retryInformationStats();
      assert.equal(stats.stalledAttempts, 1); assert.equal(stats.stallsEndedByInformation, 1);
      assert.equal(stats.routes, 1); assert.equal(stats.consecutiveStalls, 0);
    }
  }
  for (const first of firstChoices) assert.deepEqual(first, firstChoices[0]);
  assert.deepEqual(retryChoices[0], retryChoices[2]); assert.deepEqual(retryChoices[1], retryChoices[3]);
  const openTiles = tiles.slice(0, 8), openBoard = { tiles: openTiles, nb: Layouts.neighbors(openTiles),
    faces: [1, 2, 3, 4, 1, 2, 3, 4], down: openTiles.map(() => 0), rules: null, clock: null };
  const planning = { nodes: 1, taps: 1, beam: 1, finishKnown: false, pruneDead: false, continuationPruning: false };
  const baseline = createMeasurer(planning)(openBoard, { salts: [1], maxTries: 3 });
  const measured = createMeasurer({ ...planning, retryInformationWitness: true })(openBoard, { salts: [1], maxTries: 3 });
  assert(baseline.valid && measured.valid); assert.deepEqual(measured.triesPerSalt, baseline.triesPerSalt);
  assert.equal(measured.runs[0].retryInformation.considered, 0); assert.deepEqual(measured.triesPerSalt, [1]);
  factory.verifySource();
  console.log('PASS actual no-learning losses activate information search, hidden-picture swaps preserve the pre-peek retry decision, actual peeking ends the intervention, and all failed/successful taps independently replay');
}

if (require.main === module) test();
module.exports = test;
