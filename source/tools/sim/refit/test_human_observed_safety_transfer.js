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
  for (const { observedSafetyTransfer, observedSafetyClockOnly, maximumSlack, expectedPlanning, clock } of [
    { observedSafetyTransfer: false, observedSafetyClockOnly: false, clock: null, expectedPlanning: false },
    { observedSafetyTransfer: true, observedSafetyClockOnly: false, clock: null, expectedPlanning: true },
    { observedSafetyTransfer: true, observedSafetyClockOnly: true, clock: null, expectedPlanning: false },
    { observedSafetyTransfer: true, observedSafetyClockOnly: true, clock: { i: 4, n: 50 }, expectedPlanning: true },
    { observedSafetyTransfer: true, observedSafetyClockOnly: true, clock: { i: 4, n: 50 }, maximumSlack: 47, expectedPlanning: false },
    { observedSafetyTransfer: true, observedSafetyClockOnly: true, clock: { i: 4, n: 50 }, maximumSlack: 48, expectedPlanning: true },
  ]) {
    const game = { ...actual, clock };
    const controller = createHumanController(tiles, { exclusiveRoles: false, rememberAcceptedTaps: true,
      rememberClearedRoles: true, rememberKeyIdentities: true, keyPlanningSlackAbove: 40,
      observedSafetyTransfer, observedSafetyClockOnly, observedSafetyMaxClockSlack: maximumSlack,
      nodes: 64, beam: 8, taps: 4, decisionMs: 30 });
    const observe = session => {
      const view = session.view(), legal = new Set(view.legalTiles ?? []);
      const board = observeBoard(tiles, view.state, game.clock, { picture: index => game.faces[index],
        role: index => visibleRole(game, view.state, index), takeable: index => legal.has(index) });
      controller.observe(view.state, board); return board;
    };
    const perform = (session, index) => {
      assert(session.view().legalTiles.includes(index)); controller.decide(); controller.acknowledge(index, true);
      session.tap(index); observe(session);
    };
    controller.beginAttempt(); const failed = factory(game, settings);
    assert.equal(observe(failed).roles[6], 'key');
    const loss = [1, 2, 0, 6];
    for (const index of loss) perform(failed, index);
    assert.equal(failed.view().why, 'tray');
    verifiedTaps += verifyAttempt(encodeGame(game), loss, settings, failed.audit());
    assert.equal(controller.causalAvailabilityStats().provedTransfers, 0, 'A first monotone attempt has no cross-retry safety transfer');
    controller.completeAttempt('physicalLoss');
    assert.equal(controller.known().initialRoles[0], 'ice2');
    controller.beginAttempt(); const retry = factory(game, settings); observe(retry); perform(retry, 2);
    assert(retry.view().state.alive[1]);
    const audit = controller.explainInformation([3, 0]);
    if (expectedPlanning) {
      assert.equal(audit.boundary, null);
      assert(controller.causalAvailabilityStats().provedTransfers > 0);
      assert(controller.acceptedEvidence().every(proof => proof.alternateProof === 'observedKeyAndNeighborCount'));
    } else {
      assert.equal(audit.boundary.reason, 'unobservedObstacleRole');
      if (observedSafetyClockOnly) assert(controller.causalAvailabilityStats().clockGateSkips > 0);
    }
    assert.equal(controller.known().initialRoles[0], 'ice2', 'Availability proof does not invent a different starting role');
    for (const index of [3, 0, 4, 1, 5, 6, 7]) perform(retry, index);
    assert(retry.view().win);
    const route = [2, 3, 0, 4, 1, 5, 6, 7];
    verifiedTaps += verifyAttempt(encodeGame(game), route, settings, retry.audit());
    controller.completeAttempt('cleared');
  }
  const transfer = () => { throw Error('No original-rule witness exists under relief'); };
  const accepted = createAcceptedTapMemory(tiles.length, { transferProof: transfer, transferProofLabel: 'observedKeyAndNeighborCount' });
  const cleared = createClearedRoleMemory(tiles, { transferProof: transfer, transferProofLabel: 'observedKeyAndNeighborCount' });
  assert.equal(accepted.observeAvailable(tiles.map(() => true), { alive: tiles.map(() => 1), relieved: true }), 0);
  assert.equal(cleared.observe({ alive: tiles.map(() => 1), relieved: true, physicalTaps: 0 }, tiles.map(() => 'none')), 0);
  assert.deepEqual(accepted.entries(), []); assert.deepEqual(cleared.entries(), []);
  assert.throws(() => createHumanController(tiles, { observedSafetyClockOnly: 'yes' }));
  assert.throws(() => createHumanController(tiles, { observedSafetyClockOnly: true }));
  assert.throws(() => createHumanController(tiles, { observedSafetyMaxClockSlack: 30 }));
  assert.throws(() => createHumanController(tiles, { observedSafetyTransfer: true, observedSafetyClockOnly: true,
    observedSafetyMaxClockSlack: -1, rememberAcceptedTaps: true, rememberKeyIdentities: true }));
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
