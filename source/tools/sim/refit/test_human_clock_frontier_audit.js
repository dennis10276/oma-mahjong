'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 9, 9], down: tiles.map(() => 0),
    rules: { iceNb: Layouts.iceNeighbors(tiles), ice: {}, keys: [0, 1], locks: new Set([6]) }, clock: { i: 6, n: 8 } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, session = factory(game, settings);
  const options = { exclusiveRoles: true, rememberBlockedTaps: true };
  const observe = (controller, hideRole = false) => {
    const state = session.view().state;
    const board = observeBoard(tiles, state, game.clock,
      { picture: index => game.faces[index], role: index => visibleRole(game, state, index) });
    if (hideRole) board.roles[6] = null;
    controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
      .map(field => [field, state[field]])), board);
  };
  const controller = createHumanController(tiles, options, { boardMode: 'lab' });
  assert.equal(controller.clockFrontierAudit(), null); controller.beginAttempt(); observe(controller);
  const blocked = controller.clockFrontierAudit();
  assert.equal(blocked.available, false); assert.equal(blocked.observedRole, 'lock'); assert.equal(blocked.initialRole, 'lock');
  assert.equal(blocked.blockedByRejectedTap, false);
  assert.deepEqual(blocked.observedKeys, [0, 1]); assert.deepEqual(blocked.aliveObservedKeys, [0, 1]);
  assert.equal(blocked.information.boundary.reason, 'blockedKnownSuffix');
  const before = controller.known(); blocked.observedRole = 'key';
  assert.equal(controller.clockFrontierAudit().observedRole, 'lock'); assert.deepEqual(controller.known(), before);
  const unknown = createHumanController(tiles, options, { boardMode: 'lab' });
  unknown.beginAttempt(); observe(unknown, true);
  assert.equal(unknown.clockFrontierAudit().observedRole, null); assert.equal(unknown.clockFrontierAudit().initialRole, null);
  assert(unknown.clockFrontierAudit().available && unknown.clockFrontierAudit().uncertain);
  for (const index of [0, 1]) session.tap(index);
  observe(controller);
  assert(controller.clockFrontierAudit().available); assert.equal(controller.clockFrontierAudit().observedRole, 'none');
  assert.equal(controller.clockFrontierAudit().initialRole, 'lock');
  assert.deepEqual(controller.clockFrontierAudit().aliveObservedKeys, []);
  assert.equal(verifyAttempt(encodeGame(game), [0, 1], settings, session.audit()), 2);
  factory.verifySource();
  console.log('PASS public clock frontier audit distinguishes a visible known lock from an uncertain role, reports only actual public facts, preserves starting-role memory after key removals and cannot mutate policy knowledge');
}

if (require.main === module) test();
module.exports = test;
