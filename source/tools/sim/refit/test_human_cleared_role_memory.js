'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0.28, y: 0.28 / 1.24, z: 1 },
    ...Array.from({ length: 8 }, (_, index) => ({ x: 8 + index * 4, y: 0, z: 0 }))];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 3, 4, 5, 2, 3, 4, 5],
    down: tiles.map(() => 0), clock: null,
    rules: { ice: { 0: 1 }, iceNb: Layouts.iceNeighbors(tiles), locks: null, keys: [] } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  for (const rememberClearedRoles of [false, true]) {
    const controller = createHumanController(tiles, { rememberClearedRoles, rememberAcceptedTaps: true });
    const observe = session => {
      const state = session.view().state;
      const observed = observeBoard(tiles, state, null,
        { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) });
      controller.observe(state, observed); return observed;
    };
    const failed = factory(actual, settings); controller.beginAttempt();
    assert.equal(observe(failed).roles[0], null);
    for (const index of [1, 2, 3, 4]) {
      assert(failed.view().legalTiles.includes(index));
      controller.decide(); controller.acknowledge(index, true); failed.tap(index);
      const observed = observe(failed);
      assert.equal(observed.roles[0], 'none');
    }
    assert.equal(failed.view().why, 'tray'); controller.completeAttempt('physicalLoss');
    assert.equal(controller.known().initialRoles[0], null);
    assert(!controller.acceptedEvidence().some(entry => entry.index === 0), 'The clear tile was seen but never tapped');
    assert.equal(verifyAttempt(encodeGame(actual), [1, 2, 3, 4], settings, failed.audit()), 4);
    const retried = factory(actual, settings); controller.beginAttempt();
    assert.equal(observe(retried).roles[0], null);
    assert(!retried.view().legalTiles.includes(0));
    const selected = controller.decide();
    assert.equal(selected.plan.knownWin, rememberClearedRoles);
    if (rememberClearedRoles) assert(controller.clearedRoleEvidence().some(entry => entry.index === 0
      && entry.requiredGone.length === 1 && entry.requiredGone[0] === 1));
    const actions = [];
    let decision = selected;
    while (retried.view().type !== 'productionPhysicalEnd-v1') {
      assert(actions.length < 64);
      const index = decision.plan.index, accepted = retried.view().legalTiles.includes(index);
      controller.acknowledge(index, accepted);
      if (accepted) { actions.push(index); retried.tap(index); observe(retried); }
      if (retried.view().type !== 'productionPhysicalEnd-v1') decision = controller.decide();
    }
    assert(retried.view().win);
    assert.equal(controller.known().initialRoles[0], null, 'A late clear role is never converted to an initial none');
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retried.audit()), actions.length);
  }
  assert.deepEqual(createHumanController(tiles, { rememberClearedRoles: true }).clearedRoleEvidence(), []);
  assert.throws(() => createHumanController(tiles, { rememberClearedRoles: 'yes' }));
  factory.verifySource();
  console.log('PASS a real visible thaw teaches conditional retry safety before the tile is ever tapped, supports a known winning route only after its prerequisite removal, and independently replays both attempts');
}

if (require.main === module) test();
module.exports = test;
