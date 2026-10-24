'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, playHumanCampaign, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 9, 9],
    down: [0, 0, 0, 0, 0, 0, 1, 1], rules: null, clock: { i: 6, n: 8 } };
  const planning = { probeUnknownClock: true, rememberBlockedTaps: true, exclusiveRoles: true, usePlacementContract: true };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const observe = (controller, actual, state, hideClockRole = false) => {
    const board = observeBoard(tiles, state, actual.clock,
      { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) });
    if (hideClockRole) board.roles[actual.clock.i] = null;
    controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
      .map(field => [field, state[field]])), board);
  };
  const opening = actual => {
    const controller = createHumanController(tiles, planning, { boardMode: 'standard' }), session = factory(actual, settings);
    controller.beginAttempt(); observe(controller, actual, session.view().state);
    assert.equal(controller.known().pictures[6], null);
    const selected = controller.decide();
    assert.equal(selected.plan.index, 6); assert.equal(selected.plan.goal, 'publicClockProbe');
    assert(selected.predicted.uncertain);
    controller.acknowledge(6, true); session.tap(6); observe(controller, actual, session.view().state);
    assert.equal(session.view().state.moves, 0); assert.equal(session.view().state.tray.length, 0);
    assert.equal(controller.known().pictures[6], actual.faces[6]);
    assert.equal(verifyAttempt(encodeGame(actual), [6], settings, session.audit()), 1);
    return selected.plan;
  };
  assert.deepEqual(opening(game), opening({ ...game, faces: [1, 1, 2, 2, 3, 3, 10, 10] }),
    'The first probe cannot depend on either concealed clock-pair picture');
  const clear = playHumanCampaign(game, { planning, maximumAttempts: 1, captureDecisions: true });
  assert.equal(clear.wonOn, 1); assert.equal(clear.verifiedTaps, clear.attempts[0].taps);
  assert.equal(clear.attempts[0].decisions[0].plan.goal, 'publicClockProbe');
  const locked = { ...game, rules: { iceNb: Layouts.iceNeighbors(tiles), ice: {}, keys: [0, 1], locks: new Set([6]) } };
  const blockedController = createHumanController(tiles, planning, { boardMode: 'lab' }), blockedSession = factory(locked, settings);
  blockedController.beginAttempt(); observe(blockedController, locked, blockedSession.view().state);
  assert.equal(blockedController.decide().plan.goal, 'publicClockProbe');
  assert(!blockedSession.view().legalTiles.includes(6));
  blockedController.acknowledge(6, false);
  assert.equal(blockedSession.view().state.physicalTaps, 0);
  assert.equal(blockedController.known().initialRoles[6], null, 'A rejected clock probe does not identify ice versus lock');
  assert.notEqual(blockedController.decide().plan.index, 6, 'An unchanged blocked clock cannot be probed repeatedly');
  const unlocked = playHumanCampaign(locked, { planning, publicContext: { boardMode: 'lab' }, maximumAttempts: 1 });
  assert.equal(unlocked.wonOn, 1); assert(unlocked.rejected >= 1);
  assert.equal(unlocked.verifiedTaps, unlocked.attempts[0].taps);
  const pressured = { ...game, faces: [1, 2, 9, 3, 1, 2, 9, 3], down: tiles.map(() => 0) };
  for (const limit of [1, 2]) {
    const controller = createHumanController(tiles, { ...planning, clockProbeTrayLimit: limit }, { boardMode: 'lab' });
    const session = factory(pressured, settings);
    for (const index of [0, 1]) session.tap(index);
    controller.beginAttempt(); observe(controller, pressured, session.view().state, true);
    assert.equal(controller.decide().plan.goal === 'publicClockProbe', limit === 2,
      'A face-up unknown-role probe must respect its configured tray buffer');
  }
  const matching = createHumanController(tiles, planning, { boardMode: 'lab' }), matchingSession = factory(pressured, settings);
  for (const index of [0, 1, 2]) matchingSession.tap(index);
  matching.beginAttempt(); observe(matching, pressured, matchingSession.view().state, true);
  assert.equal(matching.decide().plan.goal, 'publicClockProbe');
  matching.acknowledge(6, true); matchingSession.tap(6);
  assert.equal(matchingSession.view().state.tray.length, 2); assert(!matchingSession.view().state.alive[6]);
  assert.equal(verifyAttempt(encodeGame(pressured), [0, 1, 2, 6], settings, matchingSession.audit()), 4);
  assert.throws(() => createHumanController(tiles, { probeUnknownClock: 'yes' }));
  assert.throws(() => createHumanController(tiles, { clockProbeTrayLimit: 1 }));
  assert.throws(() => createHumanController(tiles, { probeUnknownClock: true, clockProbeTrayLimit: 3 }));
  factory.verifySource();
  console.log('PASS uncertain public clocks receive buffered information probes without concealed-picture access; free peeks, tray matches, rejected-role ambiguity, blocked retry avoidance, production clears and original-engine replay remain intact');
}

if (require.main === module) test();
module.exports = test;
