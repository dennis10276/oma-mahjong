'use strict';
function test() {
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');
const { safeClosedInspection } = require('./public_safe_closed_inspection.js');
const { createHumanController, visibleRole } = require('./human_reference_campaign.js');
const tiles = Array.from({ length: 10 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 32 };
let controls = 0, verifiedTaps = 0, maximumMoveIncrease = 0;
const publicPositions = new Map(), publicGroupSafety = new Map();
let provedControls = 0;
for (const clockMode of ['none', 'other', 'target', 'other2', 'other1']) for (const trayCount of [0, 1, 2, 3])
  for (const openTwin of [false, true]) for (const hidden of [...Array(36).keys(), 101]) {
    const clock = clockMode === 'none' ? null : { i: clockMode === 'target' ? 0 : 8,
      n: trayCount + (clockMode === 'target' || clockMode === 'other1' ? 1 : clockMode === 'other2' ? 2 : 3) };
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [hidden, 4, 5, 6, 7, 4, 5, 6, 7, hidden],
      down: [1, 0, 0, 0, 1, 0, 0, 0, 0, 1], rules: null, clock };
    const session = factory(actual, settings), actions = Array.from({ length: trayCount }, (unused, index) => index + 1);
    if (openTwin) actions.push(4);
    for (const index of actions) session.tap(index);
    const frame = session.view(), legal = new Set(frame.legalTiles);
    assert.equal(frame.state.tray.length, trayCount);
    const observed = observeBoard(tiles, frame.state, clock, { picture: index => actual.faces[index],
      role: () => 'none', takeable: index => legal.has(index) });
    const state = { ...frame.state, pictures: observed.pictures, down: observed.down };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(state, field,
      { get() { throw Error('Private closed-inspection proof ' + field); } });
    const group = clockMode + '/' + trayCount + '/' + openTwin;
    if (publicPositions.has(group)) assert.equal(JSON.stringify(state), publicPositions.get(group));
    else publicPositions.set(group, JSON.stringify(state));
    assert.equal(state.pictures[0], null); assert.equal(state.down[0], 1);
    const proved = safeClosedInspection(state, 0, clock, legal.has(0));
    if (['none', 'other', 'target'].includes(clockMode)) assert(proved);
    if (!publicGroupSafety.has(group)) publicGroupSafety.set(group, { proved, counterexamples: 0 });
    assert(!safeClosedInspection(state, 0, clock, false));
    assert(!safeClosedInspection({ ...state, tray: [1, 2, 3, 4] }, 0, clock, true));
    assert(!safeClosedInspection(state, 0, { i: 0, n: state.moves }, true));
    assert(!safeClosedInspection({ ...state, down: state.down.map((down, index) => index === 0 ? null : down) }, 0, clock, true));
    const before = JSON.stringify(state), after = session.tap(0);
    assert.equal(JSON.stringify(state), before);
    const lost = ['tray', 'clock', 'stuck'].includes(after.why);
    if (proved) { assert(!lost); provedControls++; }
    else publicGroupSafety.get(group).counterexamples += +lost;
    assert(after.state.tray.length <= state.tray.length);
    maximumMoveIncrease = Math.max(maximumMoveIncrease, after.state.moves - state.moves);
    assert(after.state.moves - state.moves <= 2);
    verifiedTaps += verifyAttempt(encodeGame(actual), [...actions, 0], settings, session.audit());
    controls++;
  }
const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [7, 4, 5, 6, 7, 4, 5, 6, 7, 7],
  down: [1, 0, 0, 0, 1, 0, 0, 0, 0, 1], rules: null, clock: { i: 8, n: 2 } };
const unsafe = factory(actual, settings); unsafe.tap(4);
const raw = unsafe.view(), board = observeBoard(tiles, raw.state, actual.clock,
  { picture: index => actual.faces[index], role: () => 'none' });
assert(!safeClosedInspection({ ...raw.state, pictures: board.pictures, down: board.down }, 0, actual.clock, true));
assert.equal(unsafe.tap(0).why, 'clock');
verifiedTaps += verifyAttempt(encodeGame(actual), [4, 0], settings, unsafe.audit());
for (const [group, result] of publicGroupSafety) if (!result.proved) assert(result.counterexamples > 0, group);
let controllerControls = 0, controllerReplayedTaps = 0;
for (const hidden of [...Array(36).keys(), 101]) {
  for (const remaining of [1, 3]) {
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [hidden, 4, 5, 6, 7, 4, 5, 6, 7, hidden],
      down: [1, 0, 0, 0, 1, 0, 0, 0, 0, 1], rules: null, clock: { i: 8, n: 2 + remaining } };
    const session = factory(game, settings); session.tap(1); session.tap(2);
    const frame = session.view(), allowed = new Set(frame.legalTiles);
    const observation = observeBoard(tiles, frame.state, game.clock, { picture: index => game.faces[index],
      role: index => visibleRole(game, frame.state, index), takeable: index => allowed.has(index) });
    const publicState = Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
      .map(field => [field, frame.state[field]]));
    const choose = options => {
      const controller = createHumanController(tiles, { inspectionTrayLimit: 2, ...options });
      controller.beginAttempt(); controller.observe(publicState, observation);
      return controller.decide();
    };
    const candidate = choose({ inspectBeforeCommit: true, safeClockInspection: true });
    if (remaining === 3) {
      assert.equal(candidate.plan.index, 0); assert.equal(candidate.plan.goal, 'closedTileDiscovery');
      const result = session.tap(0);
      assert(!['tray', 'clock', 'stuck'].includes(result.why));
      controllerReplayedTaps += verifyAttempt(encodeGame(game), [1, 2, 0], settings, session.audit());
    } else assert.notEqual(candidate.plan.goal, 'closedTileDiscovery');
    const defaultChoice = choose({ inspectBeforeCommit: true });
    const disabled = choose({ inspectBeforeCommit: true, safeClockInspection: false });
    assert.equal(defaultChoice.plan.index, disabled.plan.index);
    assert.notEqual(disabled.plan.goal, 'closedTileDiscovery');
    const recovery = choose({ inspectBeforeCommit: 'recovery', safeClockInspection: true });
    assert(recovery.plan.knownWin || recovery.plan.safeClockExit);
    assert.notEqual(recovery.plan.goal, 'closedTileDiscovery');
    controllerControls++;
  }
}
assert.throws(() => createHumanController(tiles, { inspectBeforeCommit: 'recovery', safeClockInspection: 'yes' }));
assert.throws(() => createHumanController(tiles, { safeClockInspection: true }));
factory.verifySource();
console.log(JSON.stringify({ passed: true, controls, provedControls, publicGroups: publicGroupSafety.size, negativeGroupsWithActualCounterexamples: [...publicGroupSafety.values()].filter(group => !group.proved).length, independentlyVerifiedTaps: verifiedTaps,
  maximumMoveIncrease, clockCounterexampleReplayed: true, controllerControls, controllerReplayedTaps,
  scope: 'Production first-tap safety only; no candidate strategy or campaign success claim.' }));

}
if (require.main === module) test();
module.exports = test;
