'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { preferKnownRecovery } = require('./public_recovery_priority.js');
const { createHumanController, playHumanCampaign } = require('./human_reference_campaign.js');

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
  assert(!preferKnownRecovery(game, state, plan([0, 1, 4, 5])));
  assert(!preferKnownRecovery(game, { ...state, tray: [3] }, plan([0, 1, 4])));
  assert(preferKnownRecovery(game, { ...state, tray: [1] }, plan([0, 4])));
  assert(!preferKnownRecovery(game, { ...state, tray: [1, 2, 3] }, plan([0, 1, 4])));
  assert.deepEqual(state, before);
  for (const tray of [[7], [1]]) {
    const controller = createHumanController(tiles, { inspectBeforeCommit: 'recovery', inspectionTrayLimit: 1 });
    controller.beginAttempt();
    controller.observe({ ...state, tray, physicalTaps: 0 }, { pictures: state.pictures, down: state.down, roles: tiles.map(() => 'none'), clock: null });
    const selected = controller.decide();
    assert.equal(selected.plan.goal === 'closedTileDiscovery', tray[0] === 7);
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
  console.log('PASS planner-led inspection preserves real known neutral/reducing prefixes, not stale progress, hidden outcomes, unknown mechanics or unresolved-carrier neutral detours');
}

if (require.main === module) test();
module.exports = test;
