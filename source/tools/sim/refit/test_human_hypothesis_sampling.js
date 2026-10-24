'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt, playHumanCampaign } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const planning = { exclusiveRoles: true, usePlacementContract: true, hypothesisSampling: true,
    hypothesisMaximumWorlds: 4, hypothesisNodesPerAction: 64 };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, decisions = [];
  for (const actionMs of [undefined, 100]) for (const swapped of [false, true]) {
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [0, 1, swapped ? 1 : 0, swapped ? 0 : 1, 2, 2, 3, 3],
      down: [0, 0, 1, 1, 0, 0, 0, 0], rules: null, clock: null };
    const controller = createHumanController(tiles, { ...planning,
      ...(actionMs === undefined ? {} : { hypothesisActionMs: actionMs }) }, { boardMode: 'standard' });
    controller.beginAttempt(); const session = factory(actual, settings), actions = [];
    const observe = () => {
      const state = session.view().state;
      controller.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
        relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps },
      observeBoard(tiles, state, actual.clock, { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) }));
    };
    observe();
    for (const index of [0, 1]) {
      controller.decide(); controller.acknowledge(index, true); session.tap(index); actions.push(index); observe();
    }
    const memory = controller.known(), before = JSON.stringify(memory), started = performance.now(), chosen = controller.decide();
    assert(performance.now() - started < 2000);
    assert.equal(memory.pictures[2], null); assert.equal(memory.pictures[3], null);
    assert.equal(JSON.stringify(controller.known()), before, 'Hypotheses cannot become picture/orientation/role memories');
    assert(chosen.plan.hypothesisAudit); assert(chosen.plan.hypothesisAudit.preferredWorlds > 0);
    assert(chosen.plan.hypothesisAudit.verifiedHypotheticalClears > 0);
    assert.equal(chosen.plan.hypothesisAudit.knownWin, false); assert.equal(chosen.plan.hypothesisAudit.knownDead, false);
    assert.equal(chosen.plan.hypothesisAudit.exactLossShares, false);
    if (actionMs !== undefined) {
      assert(chosen.plan.hypothesisAudit.preparationCalls > 0);
      assert(chosen.plan.hypothesisAudit.budgetedActions > 0);
      assert.equal(chosen.plan.hypothesisAudit.incompleteWorlds, 0);
    }
    decisions.push({ index: chosen.plan.index, preferredWorlds: chosen.plan.hypothesisAudit.preferredWorlds,
      totals: chosen.plan.hypothesisAudit.totals, memory: controller.known() });
    let selected = chosen;
    while (session.view().type !== 'productionPhysicalEnd-v1') {
      assert(actions.length < 64);
      const index = selected.plan.index, accepted = session.view().legalTiles.includes(index);
      controller.acknowledge(index, accepted);
      if (accepted) { session.tap(index); actions.push(index); observe(); }
      if (session.view().type !== 'productionPhysicalEnd-v1') selected = controller.decide();
    }
    assert(session.view().win); assert(controller.hypothesisStats().decisions > 0);
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, session.audit()), actions.length);
  }
  assert.deepEqual(decisions[0], decisions[1], 'Private hidden-picture swaps cannot change the same public-state decision or memory');
  assert.deepEqual(decisions[2], decisions[3], 'Candidate budgets preserve the same hidden-picture invariance');
  const clocked = { tiles, nb: Layouts.neighbors(tiles), faces: [0, 1, 0, 1, 2, 2, 3, 3],
    down: [0, 0, 1, 1, 0, 0, 0, 0], rules: null, clock: { i: 4, n: 4 } };
  const clockController = createHumanController(tiles, planning, { boardMode: 'standard' });
  clockController.beginAttempt(); const clockSession = factory(clocked, settings);
  const observeClock = () => {
    const state = clockSession.view().state;
    clockController.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
      relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps },
    observeBoard(tiles, state, clocked.clock, { picture: index => clocked.faces[index], role: () => 'none' }));
  };
  observeClock();
  for (const index of [0, 1]) { clockController.decide(); clockController.acknowledge(index, true); clockSession.tap(index); observeClock(); }
  const exit = clockController.decide(); assert(exit.plan.safeClockExit); assert.equal(clockController.hypothesisStats().decisions, 0);
  const fullKnown = { ...clocked, down: tiles.map(() => 0), clock: null };
  const won = playHumanCampaign(fullKnown, { planning, publicContext: { boardMode: 'standard' }, maximumAttempts: 1 });
  assert.equal(won.wonOn, 1); assert.equal(won.hypothesis.decisions, 0, 'A real winning witness is protected');
  const capped = playHumanCampaign(clocked, { planning: { ...planning, hypothesisMaximumWorlds: 1, hypothesisNodesPerAction: 1 },
    publicContext: { boardMode: 'standard' }, maximumAttempts: 1, choiceLimit: 1 });
  assert.equal(capped.status, 'unresolvedBudget'); assert.equal(capped.attempts.length, 1);
  assert.throws(() => createHumanController(tiles, { hypothesisSampling: true }, { boardMode: 'standard' }), /contracts/);
  assert.throws(() => createHumanController(tiles, planning), /contracts/);
  assert.throws(() => createHumanController(tiles, { ...planning, hypothesisMaximumWorlds: 0 }, { boardMode: 'standard' }));
  assert.throws(() => createHumanController(tiles, { ...planning, hypothesisActionMs: 0 }, { boardMode: 'standard' }));
  assert.throws(() => createHumanController(tiles, { ...planning, hypothesisActionMs: 1501 }, { boardMode: 'standard' }));
  assert.throws(() => createHumanController(tiles, { ...planning, hypothesisSampling: false, hypothesisActionMs: 100 }, { boardMode: 'standard' }));
  const unpaired = { ...fullKnown, faces: [0, 1, 0, 1, 2, 2, 3, 4] };
  assert.throws(() => playHumanCampaign(unpaired, { planning, publicContext: { boardMode: 'standard' } }), /paired initial/);
  factory.verifySource();
  console.log('PASS the human actor uses only public-consistent physical hypotheses within a shared deadline, retains no guessed pictures/roles, is invariant to concealed swaps, protects real wins/clock exits, preserves caps and independently replays actual clears');
}

if (require.main === module) test();
module.exports = test;
