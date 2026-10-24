'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { preferKnownRecovery, openTwinRecovery } = require('./public_recovery_priority.js');
const { createHumanController, playHumanCampaign, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: [1, 1, 1, 1, 1, 1], pictures: [1, 1, 2, 2, null, null], down: [0, 0, 0, 0, 1, 1],
    tray: [], openPeek: -1, moves: 0, relieved: false, arriving: [] };
  const plan = path => ({ path, knownWin: false, safeClockExit: false, knownProgress: 999 });
  const before = structuredClone(state);
  assert(preferKnownRecovery(game, state, plan([0, 1, 4])));
  assert(!preferKnownRecovery(game, state, plan([0, 4])));
  assert(!preferKnownRecovery(game, state, plan([4])));
  assert(!preferKnownRecovery(game, state, plan([4, 0, 1])));
  assert(preferKnownRecovery(game, state, plan([0, 1, 4, 5])), 'A safe recovery checkpoint needs no hypothetical future reveal');
  assert(!preferKnownRecovery(game, { ...state, tray: [3] }, plan([0, 1, 4])));
  assert(preferKnownRecovery(game, { ...state, tray: [1] }, plan([0, 4])));
  assert(!preferKnownRecovery(game, { ...state, tray: [7, 8, 9] }, plan([0, 1, 4])));
  assert(preferKnownRecovery(game, { ...state, tray: [7], down: [1, 0, 0, 0, 1, 1], openPeek: 0 }, plan([1, 4])),
    'Complete a known open twin without adding a carrier before overwriting its inspection');
  assert.deepEqual(state, before);
  for (const tray of [[7], [1]]) {
    const controller = createHumanController(tiles, { inspectBeforeCommit: 'recovery', inspectionTrayLimit: 1 });
    controller.beginAttempt();
    controller.observe({ ...state, tray, physicalTaps: 0 }, { pictures: state.pictures, down: state.down, roles: tiles.map(() => 'none'), clock: null });
    const selected = controller.decide();
    if (tray[0] === 7) assert.equal(state.pictures[selected.plan.index], null);
    else assert(preferKnownRecovery(game, { ...state, tray }, selected.plan));
    controller.acknowledge(selected.plan.index, true);
  }
  for (const inspection of [true, 'recovery']) {
    const controller = createHumanController(tiles, { inspectBeforeCommit: inspection, inspectionTrayLimit: 1 });
    controller.beginAttempt();
    controller.observe({ ...state, physicalTaps: 0 }, { pictures: state.pictures, down: state.down, roles: tiles.map(() => 'none'), clock: null });
    const selected = controller.decide();
    assert.equal(selected.plan.goal === 'closedTileDiscovery', inspection === true);
    if (inspection === 'recovery') assert(preferKnownRecovery(game, state, selected.plan));
    controller.acknowledge(selected.plan.index, true);
  }
  assert.throws(() => createHumanController(tiles, { inspectBeforeCommit: 'sometimes' }));
  const actual = { tiles, nb: game.nb, faces: [1, 1, 2, 2, 3, 3], down: state.down, rules: null, clock: null };
  const replayed = playHumanCampaign(actual, { planning: { inspectBeforeCommit: 'recovery', inspectionTrayLimit: 1 } });
  assert.equal(replayed.wonOn, 1);
  assert.equal(replayed.verifiedTaps, replayed.attempts[0].taps);
  const opened = { ...actual, down: [1, 0, 0, 0, 1, 1] };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 32 };
  const session = factory(opened, settings);
  session.tap(0);
  const frame = session.view().state;
  const observed = observeBoard(tiles, frame, null, { picture: index => opened.faces[index], role: () => 'none' });
  const plainController = createHumanController(tiles, { inspectBeforeCommit: true });
  plainController.beginAttempt(); plainController.observe(frame, observed);
  assert.equal(plainController.decide().plan.goal, 'closedTileDiscovery');
  const protectedController = createHumanController(tiles, { inspectBeforeCommit: true, protectOpenTwin: true });
  protectedController.beginAttempt(); protectedController.observe(frame, observed);
  const protectedChoice = protectedController.decide();
  assert.equal(protectedChoice.plan.goal, 'knownOpenTwin');
  assert.equal(protectedChoice.plan.index, 1);
  const after = session.tap(protectedChoice.plan.index);
  for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(after.state[field], protectedChoice.predicted.state[field]);
  assert.equal(verifyAttempt(encodeGame(opened), [0, 1], settings, session.audit()), 2);
  const publicState = { ...frame, pictures: observed.pictures };
  assert(openTwinRecovery(game, publicState));
  assert.equal(openTwinRecovery(game, { ...publicState, pictures: [1, null, 2, 2, null, null] }), null);
  const uncertainTwin = { ...game, publicFrontier: () => ({ free: [0, 1, 2, 3, 4, 5], uncertain: [0] }) };
  assert.equal(openTwinRecovery(uncertainTwin, publicState), null);
  assert.equal(openTwinRecovery({ ...game, clock: { i: 4, n: 1 } }, publicState), null);
  assert.throws(() => createHumanController(tiles, { protectOpenTwin: 'yes' }));
  console.log('PASS planner-led inspection preserves real known neutral/reducing prefixes, not stale progress, hidden outcomes, unknown mechanics or unresolved-carrier neutral detours');
}

if (require.main === module) test();
module.exports = test;
