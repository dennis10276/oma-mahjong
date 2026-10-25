'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { createAcceptedTapMemory } = require('./public_accepted_tap_memory.js');
const { createClearedRoleMemory } = require('./public_cleared_role_memory.js');
const { createMeasurer } = require('./human_level_measure.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 1.8, y: 0, z: 0 }, { x: -1.8, y: 0, z: 0 },
    { x: 0, y: 1.8, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 9.8, y: 0, z: 0 },
    { x: 16, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [2, 1, 4, 1, 2, 3, 3, 4],
    down: tiles.map(() => 0), clock: null,
    rules: { iceNb: Layouts.iceNeighbors(tiles), ice: { 0: 2, 5: 1 }, keys: [4, 5, 6], locks: new Set([7]) } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  let verifiedTaps = 0;
  for (const observedSafetyTransfer of [false, true]) {
    const controller = createHumanController(tiles, { exclusiveRoles: false, rememberAcceptedTaps: true,
      rememberClearedRoles: true, rememberKeyIdentities: true, keyPlanningSlackAbove: 40,
      observedSafetyTransfer, nodes: 64, beam: 8, taps: 4, decisionMs: 30 });
    const observe = session => {
      const view = session.view(), legal = new Set(view.legalTiles ?? []);
      const board = observeBoard(tiles, view.state, null, { picture: index => actual.faces[index],
        role: index => visibleRole(actual, view.state, index), takeable: index => legal.has(index) });
      controller.observe(view.state, board); return board;
    };
    const perform = (session, index) => {
      assert(session.view().legalTiles.includes(index)); controller.decide(); controller.acknowledge(index, true);
      session.tap(index); observe(session);
    };
    controller.beginAttempt(); const failed = factory(actual, settings);
    assert.equal(observe(failed).roles[6], 'key');
    const loss = [1, 2, 0, 6];
    for (const index of loss) perform(failed, index);
    assert.equal(failed.view().why, 'tray');
    verifiedTaps += verifyAttempt(encodeGame(actual), loss, settings, failed.audit());
    controller.completeAttempt('physicalLoss');
    assert.equal(controller.known().initialRoles[0], 'ice2');
    controller.beginAttempt(); const retry = factory(actual, settings); observe(retry); perform(retry, 2);
    assert(retry.view().state.alive[1]);
    const audit = controller.explainInformation([3, 0]);
    if (observedSafetyTransfer) {
      assert.equal(audit.boundary, null);
      assert(controller.causalAvailabilityStats().provedTransfers > 0);
      assert(controller.acceptedEvidence().every(proof => proof.alternateProof === 'observedKeyAndNeighborCount'));
    } else assert.equal(audit.boundary.reason, 'unobservedObstacleRole');
    assert.equal(controller.known().initialRoles[0], 'ice2', 'Availability proof does not invent a different starting role');
    for (const index of [3, 0, 4, 1, 5, 6, 7]) perform(retry, index);
    assert(retry.view().win);
    const route = [2, 3, 0, 4, 1, 5, 6, 7];
    verifiedTaps += verifyAttempt(encodeGame(actual), route, settings, retry.audit());
    controller.completeAttempt('cleared');
  }
  const transfer = () => { throw Error('No original-rule witness exists under relief'); };
  const accepted = createAcceptedTapMemory(tiles.length, { transferProof: transfer, transferProofLabel: 'observedKeyAndNeighborCount' });
  const cleared = createClearedRoleMemory(tiles, { transferProof: transfer, transferProofLabel: 'observedKeyAndNeighborCount' });
  assert.equal(accepted.observeAvailable(tiles.map(() => true), { alive: tiles.map(() => 1), relieved: true }), 0);
  assert.equal(cleared.observe({ alive: tiles.map(() => 1), relieved: true, physicalTaps: 0 }, tiles.map(() => 'none')), 0);
  assert.deepEqual(accepted.entries(), []); assert.deepEqual(cleared.entries(), []);
  assert.throws(() => createHumanController(tiles, { observedSafetyTransfer: 'yes' }));
  assert.throws(() => createHumanController(tiles, { observedSafetyTransfer: true }));
  assert.throws(() => createHumanController(tiles, { observedSafetyTransfer: true, rememberKeyIdentities: true }));
  const fresh = createHumanController(tiles, { observedSafetyTransfer: true, rememberAcceptedTaps: true, rememberKeyIdentities: true });
  fresh.beginAttempt(); const freshSession = factory(actual, settings), freshView = freshSession.view();
  fresh.observe(freshView.state, observeBoard(tiles, freshView.state, null, { picture: index => actual.faces[index],
    role: index => visibleRole(actual, freshView.state, index), takeable: index => freshView.legalTiles.includes(index) }));
  assert.equal(fresh.explainInformation([2, 3, 0]).boundary.reason, 'unobservedObstacleRole', 'A separate board/salt controller has no earlier proof');
  for (const field of ['level', 'dennis', 'wonOn']) Object.defineProperty(actual, field,
    { get() { throw Error('Private outcome label ' + field); } });
  const measure = createMeasurer({ ...require('./human_level_measure_profile.json'), observedSafetyTransfer: true });
  const result = measure(actual, { salts: [1], maxTries: 2 });
  assert(result.valid); assert(result.runs[0].observedSafetyTransfer);
  factory.verifySource();
  console.log('PASS observed-key safety transfers across actual failed retries with composite roles and three keys, supports a different thaw route without a private contract, rejects relief and fresh-controller proof leakage, exposes label-free API counters and independently replays ' + verifiedTaps + ' physical taps');
}

if (require.main === module) test();
module.exports = test;
