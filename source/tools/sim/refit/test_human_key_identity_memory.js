'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { retryInformationSearch } = require('./public_retry_information.js');
const { createMeasurer } = require('./human_level_measure.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0.28, y: 0.28 / 1.24, z: 1 },
    ...Array.from({ length: 8 }, (unused, index) => ({ x: 8 + index * 4, y: 0, z: 0 }))];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 3, 4, 5, 2, 3, 4, 5],
    down: tiles.map(() => 0), clock: null,
    rules: { ice: { 0: 1 }, iceNb: Layouts.iceNeighbors(tiles), locks: null, keys: [0, 9] } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const firstPlans = [];
  for (const rememberKeyIdentities of [false, true]) {
    const controller = createHumanController(tiles, { rememberKeyIdentities, rememberAcceptedTaps: false,
      rememberClearedRoles: true, keyAccessMacros: true, keyRecoveryMacros: true, retryInformationWitness: true });
    const observe = session => {
      const view = session.view(), state = view.state, legal = new Set(view.legalTiles ?? []);
      const observed = observeBoard(tiles, state, null, { picture: index => actual.faces[index],
        role: index => visibleRole(actual, state, index), takeable: index => legal.has(index) });
      controller.observe(state, observed); return observed;
    };
    const failed = factory(actual, settings); controller.beginAttempt();
    assert.equal(observe(failed).roles[0], null);
    const first = controller.decide().plan;
    firstPlans.push({ index: first.index, path: first.path, knownWin: first.knownWin });
    for (const index of [1, 2, 3, 4]) {
      assert(failed.view().legalTiles.includes(index));
      controller.decide(); controller.acknowledge(index, true); failed.tap(index);
      assert.equal(observe(failed).roles[0], 'key');
    }
    assert.equal(failed.view().why, 'tray'); controller.completeAttempt('physicalLoss');
    assert.equal(verifyAttempt(encodeGame(actual), [1, 2, 3, 4], settings, failed.audit()), 4);
    assert.equal(controller.known().initialRoles[0], null, 'A late key glyph does not prove its starting ice state');
    const identities = controller.keyIdentityEvidence();
    assert.deepEqual(identities.map(fact => fact.index), rememberKeyIdentities ? [0, 9] : []);
    if (rememberKeyIdentities) {
      assert.equal(identities.find(fact => fact.index === 0).attempt, 1);
      assert.equal(identities.find(fact => fact.index === 0).physicalTaps, 1);
    }
    const retried = factory(actual, settings); controller.beginAttempt();
    assert.equal(observe(retried).roles[0], null);
    assert(!retried.view().legalTiles.includes(0));
    assert.deepEqual(controller.keyIdentityEvidence(), identities);
    assert.deepEqual(Object.keys(controller.known()).sort(), ['down', 'initialRoles', 'pictures']);
    const actions = [];
    let decision = controller.decide();
    assert(!decision.plan.knownWin, 'Remembered key membership alone cannot prove unobserved initial ice absent');
    while (retried.view().type !== 'productionPhysicalEnd-v1') {
      assert(actions.length < 64);
      const index = decision.plan.index;
      assert(retried.view().legalTiles.includes(index));
      actions.push(index); controller.acknowledge(index, true); retried.tap(index); observe(retried);
      if (retried.view().type !== 'productionPhysicalEnd-v1') decision = controller.decide();
    }
    assert(retried.view().win); controller.completeAttempt('cleared');
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retried.audit()), actions.length);
    assert.equal(controller.known().initialRoles[0], null);
    assert.deepEqual(controller.keyIdentityEvidence(), identities, 'Later plain glyphs and removals retain static identity provenance');
  }
  assert.deepEqual(firstPlans[0], firstPlans[1]);
  assert.deepEqual(createHumanController(tiles, { rememberKeyIdentities: true }).keyIdentityEvidence(), []);
  assert.throws(() => createHumanController(tiles, { rememberKeyIdentities: 'yes' }));
  assert.throws(() => createHumanController(tiles, { rememberKeyIdentities: true, hypothesisSampling: true }));

  const memory = { pictures: [null, null], down: [null, null], initialRoles: [null, null], keyIdentities: [] };
  const retry = retryInformationSearch(() => ({ knownWin: false, safeClockExit: false }));
  retry.beginAttempt(memory); retry.finish('physicalLoss', memory);
  assert.equal(retry.stats().consecutiveStalls, 1); retry.beginAttempt(memory);
  const learned = { ...memory, keyIdentities: [1] }; retry.observe(learned);
  assert.equal(retry.stats().consecutiveStalls, 0); assert.equal(retry.stats().stallsEndedByInformation, 1);
  retry.finish('physicalLoss', learned); assert.equal(retry.stats().stalledAttempts, 1);
  for (const keyIdentities of [[1, 1], [1, 0], [-1], [2], [null]]) {
    assert.throws(() => retryInformationSearch(() => ({})).beginAttempt({ ...memory, keyIdentities }));
  }
  const flatTiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const flatBoard = { tiles: flatTiles, nb: Layouts.neighbors(flatTiles), faces: [1, 1, 2, 2, 3, 3, 4, 4],
    down: flatTiles.map(() => 0), clock: null,
    rules: { ice: {}, iceNb: Layouts.iceNeighbors(flatTiles), locks: null, keys: [0, 1] } };
  const measured = createMeasurer({ rememberKeyIdentities: true })(flatBoard, { salts: [1, 2, 3], maxTries: 1 });
  assert(measured.valid); assert.deepEqual(measured.triesPerSalt, [1, 1, 1]);
  for (const run of measured.runs) {
    assert.deepEqual(run.keyIdentityEvidence.map(fact => fact.index), [0, 1]);
    assert(run.keyIdentityEvidence.every(fact => fact.attempt === 1 && fact.physicalTaps === 0));
  }
  assert.notEqual(measured.runs[0].keyIdentityEvidence, measured.runs[1].keyIdentityEvidence);
  factory.verifySource();
  console.log('PASS actual late key glyphs retain typed retry identity and provenance without inferring absent ice, both failed and winning attempts independently replay, fresh controllers isolate facts, and new typed facts end no-learning stalls');
}

if (require.main === module) test();
module.exports = test;
