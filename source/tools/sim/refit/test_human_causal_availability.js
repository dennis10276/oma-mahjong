'use strict';
const assert = require('assert/strict');
const vm = require('vm');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt, playHumanCampaign } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
    { x: 20, y: 0, z: 0 }, { x: 28, y: 0, z: 0 }, { x: 32, y: 0, z: 0 }];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [2, 3, 4, 9, 9, 3, 4, 2, 10, 10],
    down: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0], clock: null,
    rules: { iceNb: Layouts.iceNeighbors(tiles), ice: { 0: 2 }, keys: [3, 4], locks: null } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  for (const causalAvailabilityMemory of [false, true]) {
    const controller = createHumanController(tiles, { exclusiveRoles: true, rememberAcceptedTaps: true,
      causalAvailabilityMemory }, { boardMode: 'lab' });
    const observe = session => {
      const state = session.view().state;
      const observed = observeBoard(tiles, state, null,
        { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) });
      controller.observe(state, observed); return observed;
    };
    const perform = (session, index) => {
      assert(session.view().legalTiles.includes(index));
      controller.decide(); controller.acknowledge(index, true); session.tap(index); return observe(session);
    };
    controller.beginAttempt(); const failed = factory(actual, settings);
    assert.equal(observe(failed).roles[3], 'key');
    const failedActions = [6, 1, 0, 8, 3, 7];
    for (const index of failedActions) perform(failed, index);
    assert.equal(failed.view().why, 'tray');
    assert.equal(controller.known().initialRoles[0], null);
    assert.equal(controller.known().pictures[0], 2);
    assert.equal(verifyAttempt(encodeGame(actual), failedActions, settings, failed.audit()), failedActions.length);
    controller.beginAttempt(); const retry = factory(actual, settings);
    assert.equal(observe(retry).roles[0], null);
    perform(retry, 6); perform(retry, 2);
    assert(retry.view().state.alive[1], 'This retry restores the earlier witness neighbor and removes a different one');
    const audit = controller.explainInformation([0]);
    if (causalAvailabilityMemory) {
      assert.equal(audit.boundary, null);
      assert(controller.causalAvailabilityStats().provedTransfers > 0);
    } else assert.equal(audit.boundary.reason, 'unobservedObstacleRole');
    assert.equal(controller.known().initialRoles[0], null, 'Causal takeability never becomes a fictitious observed starting role');
    assert(retry.view().legalTiles.includes(0));
    const remaining = [0, 7, 1, 5, 9, 8, 3, 4];
    for (const index of remaining) perform(retry, index);
    assert(retry.view().win);
    const actions = [6, 2, ...remaining];
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retry.audit()), actions.length);
  }
  assert.throws(() => createHumanController(tiles, { causalAvailabilityMemory: true }), /requires declared production bounds/);
  const planning = { exclusiveRoles: true, rememberAcceptedTaps: true, causalAvailabilityMemory: true };
  const wrongNeighborhood = actual.rules.iceNb.map(row => row.slice()); wrongNeighborhood[0] = [];
  assert.throws(() => playHumanCampaign({ ...actual, rules: { ...actual.rules, iceNb: wrongNeighborhood } },
    { planning, maximumAttempts: 1 }), /public geometric ice neighborhood/);
  const encodedElsewhere = vm.runInNewContext('JSON.parse(encoded)', { encoded: JSON.stringify(encodeGame(actual)) });
  assert.notEqual(Object.getPrototypeOf(encodedElsewhere.rules.iceNb), Array.prototype);
  const reconstructed = playHumanCampaign(decodeGame(encodedElsewhere), { planning, maximumAttempts: 1 });
  assert.equal(reconstructed.wonOn, 1, 'Equivalent sandbox-generated neighbor arrays are accepted while real graph mismatches remain rejected');
  factory.verifySource();
  console.log('PASS actual observed keys and a real earlier safe tap support a different thawing route on retry, preserve the unknown initial ice role and all original-rule witnesses, and independently replay the loss and both retry controls');
}

if (require.main === module) test();
module.exports = test;
