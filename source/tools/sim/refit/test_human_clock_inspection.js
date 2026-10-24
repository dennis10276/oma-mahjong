'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, playHumanCampaign, visibleRole, verifyAttempt, fastPrimaryOptions } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const renderer = fs.readFileSync(path.resolve(__dirname, '../../../www/js/board.js'), 'utf8');
  assert.match(renderer, /G\.peek = i; turn\(i, false\)/);
  assert.match(renderer, /function takeOff\(i\).*G\.mv\+\+; clockMove\(i\)/);
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 9, 9], down: [1, 1, 0, 0, 0, 0, 0, 0],
    rules: { iceNb: Layouts.iceNeighbors(tiles), ice: {}, keys: [0, 1], locks: new Set([6]) }, clock: { i: 6, n: 3 } };
  const planning = { inspectBeforeCommit: 'recovery', inspectDuringClock: true, inspectionTrayLimit: 1,
    clockInspectionTrayLimit: 1, exclusiveRoles: true, rememberBlockedTaps: true, knownPairMacros: true };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const observe = (controller, actual, state) => controller.observe(Object.fromEntries(
    ['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps'].map(field => [field, state[field]])),
    observeBoard(tiles, state, actual.clock, { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) }));
  const opening = actual => {
    const controller = createHumanController(tiles, planning, { boardMode: 'lab' }), session = factory(actual, settings);
    controller.beginAttempt(); observe(controller, actual, session.view().state);
    assert.equal(controller.clockFrontierAudit().observedRole, 'lock');
    assert.deepEqual(controller.clockFrontierAudit().observedKeys, []);
    const first = controller.decide();
    assert.equal(first.plan.goal, 'closedTileDiscovery'); assert.equal(first.plan.index, 0);
    assert.equal(controller.known().pictures[0], null);
    controller.acknowledge(0, true); session.tap(0); observe(controller, actual, session.view().state);
    assert.equal(session.view().state.moves, 0); assert.deepEqual(session.view().state.tray, []);
    assert.deepEqual(controller.clockFrontierAudit().observedKeys, [0]);
    assert.equal(verifyAttempt(encodeGame(actual), [0], settings, session.audit()), 1);
    return first.plan;
  };
  assert.deepEqual(opening(game), opening({ ...game, faces: [8, 8, 2, 2, 3, 3, 9, 9] }),
    'A clock-time inspection cannot depend on the concealed key pictures');
  const campaign = playHumanCampaign(game, { planning, publicContext: { boardMode: 'lab' }, maximumAttempts: 1, captureDecisions: true });
  assert.equal(campaign.wonOn, 1); assert.equal(campaign.verifiedTaps, campaign.attempts[0].taps);
  assert.equal(campaign.attempts[0].decisions[0].plan.goal, 'closedTileDiscovery');
  const automatic = { ...game, rules: null, clock: { i: 6, n: 2 } }, session = factory(automatic, settings);
  session.tap(0);
  const controller = createHumanController(tiles, { ...planning, inspectBeforeCommit: true }, { boardMode: 'lab' });
  controller.beginAttempt(); observe(controller, automatic, session.view().state);
  assert.notEqual(controller.decide().plan.goal, 'closedTileDiscovery',
    'An unknown inspection can automatically remove a pair, so two clock moves are insufficient');
  session.tap(1); assert.equal(session.view().why, 'clock');
  assert.equal(session.view().state.moves, 2); assert.deepEqual(session.view().state.tray, []);
  assert.equal(verifyAttempt(encodeGame(automatic), [0, 1], settings, session.audit()), 2);
  const fast = fastPrimaryOptions(planning, Date.now() + 1000);
  assert(fast.inspectDuringClock); assert.equal(fast.clockInspectionTrayLimit, 1);
  assert.throws(() => createHumanController(tiles, { inspectDuringClock: true }), /requires an inspection policy/);
  assert.throws(() => createHumanController(tiles, { inspectBeforeCommit: true, inspectDuringClock: 'yes' }));
  assert.throws(() => createHumanController(tiles, { clockInspectionTrayLimit: 1 }));
  assert.throws(() => createHumanController(tiles, { ...planning, clockInspectionTrayLimit: 4 }));
  factory.verifySource();
  console.log('PASS clock-time inspection learns actual concealed keys without an unmatched carrier, retains the same hypothetical policy and original-production clears, is invariant to hidden pictures, and refuses automatic-pair exposure at a two-move clock deadline');
}

if (require.main === module) test();
module.exports = test;
