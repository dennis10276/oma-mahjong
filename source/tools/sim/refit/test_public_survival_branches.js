'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { survivalBranchSearch } = require('./public_survival_branches.js');
const { knownRecovery } = require('./public_known_recovery.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');
const { createHumanController, verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
    { x: 20.28, y: .28 / 1.24, z: 1 }, { x: 20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 },
    { x: 20, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, { x: 48, y: 0, z: 0 }];
  const model = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  model.publicFrontier = position => ({ free: tiles.flatMap((tile, index) => position.alive[index]
    && Layouts.isFree(index, position.alive, model.nb) ? [index] : []), uncertain: [], relieved: !!position.relieved });
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(model, field, { get() { throw Error('Private branch policy ' + field); } });
  const actual = { ...model, faces: [1, 2, 3, 4, 1, 2, 3, 4, 5, 5], down: tiles.map((tile, index) => +[3, 4, 5, 6, 8].includes(index)) };
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const pictures = tiles.map(() => null), down = tiles.map(() => null);
  const observe = session => {
    const frame = session.view(), packet = observeBoard(tiles, frame.state, null, { picture: index => actual.faces[index], role: () => 'none' });
    packet.pictures.forEach((picture, index) => { if (picture !== null) pictures[index] = picture; });
    packet.down.forEach((value, index) => { if (value !== null) down[index] = value; });
    return { ...frame.state, pictures: pictures.map((picture, index) => frame.state.alive[index] ? picture : null),
      down: down.map((value, index) => frame.state.alive[index] ? value : 0) };
  };
  const primary = { index: 3, path: [3], knownDead: true, knownWin: false, safeClockExit: false, nodes: 0 };
  const policy = survivalBranchSearch(() => primary, { nodes: 512, milliseconds: 100 });
  let replayedTaps = 0;
  for (const lose of [true, false]) {
    policy.beginAttempt(); const session = factory(actual, settings), route = []; let state = observe(session);
    const tap = index => { assert(session.view().legalTiles.includes(index)); policy.acknowledge(index, true); session.tap(index); route.push(index); state = observe(session); };
    for (const index of [3, 0, 1, 2]) tap(index);
    assert.deepEqual(state.tray, [1, 2, 3]); assert.equal(state.openPeek, 3); assert.equal(state.pictures[4], null);
    const actions = session.view().legalTiles.map(index => ({ index }));
    const recovery = knownRecovery(model, state, 2, Infinity, [7]);
    assert.deepEqual(recovery.path, [7]); assert.equal(recovery.removed, 2,
      'Limiting planning roots must not remove the open mate from physical legality');
    const proposal = policy.search(model, state, actions);
    assert.equal(proposal.index, 7); assert(!proposal.knownDead && !proposal.knownWin);
    assert.equal(proposal.knownProgress, 2); assert(proposal.survivalBranches.active.includes(7));
    assert(proposal.survivalBranches.active.includes(8)); assert(proposal.survivalBranches.discarded.includes(3));
    assert(!proposal.survivalBranches.necessaryIfSolvable, 'A remaining information branch must not be called impossible');
    if (lose) { tap(3); assert.equal(session.view().why, 'tray'); policy.finish('physicalLoss'); }
    else {
      for (const index of [...proposal.path, 4, 5, 6, 8, 9]) tap(index);
      assert(session.view().win); policy.finish('cleared');
    }
    replayedTaps += verifyAttempt(encodeGame(actual), route, settings, session.audit());
  }
  assert.equal(policy.outcomes()[0].rulesOutWholeOpening, false);
  assert.deepEqual(policy.outcomes().map(entry => entry.status), ['physicalLoss', 'cleared']);
  assert(policy.stats().agenda.retainedWorkingSets > 0);
  const flatTiles = [0, 8, 16, 24].map(position => ({ x: position, y: 0, z: 0 }));
  const flat = { tiles: flatTiles, nb: Layouts.neighbors(flatTiles), rules: null, clock: null };
  const flatActual = { ...flat, faces: [1, 1, 2, 2], down: [0, 0, 0, 0] };
  const flatState = { ...factory(flatActual, settings).view().state, pictures: flatActual.faces.slice() };
  const roots = flatTiles.map((tile, index) => ({ index }));
  for (const report of [{ index: 0, path: [0, 1, 2, 3], knownWin: true }, { index: 0, path: [0], safeClockExit: true }]) {
    const protectedSearch = survivalBranchSearch(() => report);
    assert.equal(protectedSearch.search(flat, flatState, roots), report); assert.equal(protectedSearch.stats().calls, 0);
  }
  const bounded = survivalBranchSearch(() => ({ index: 0, path: [0] }));
  assert.equal(bounded.search(flat, flatState, roots, { deadline: Date.now() - 1 }).index, 0); assert.equal(bounded.stats().calls, 0);
  const controller = createHumanController(tiles, { survivalBranches: true, survivalNodes: 256, survivalMs: 50, nodes: 128, decisionMs: 50 });
  const controlled = factory(actual, settings); controller.beginAttempt();
  const feed = () => {
    const frame = controlled.view(), available = new Set(frame.legalTiles);
    controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
      .map(field => [field, frame.state[field]])), observeBoard(tiles, frame.state, null,
    { picture: index => actual.faces[index], role: () => 'none', takeable: index => available.has(index) }));
  };
  feed();
  for (const index of [3, 0, 1, 2, 3]) { controller.decide(); controller.acknowledge(index, true); controlled.tap(index); feed(); }
  controller.completeAttempt('physicalLoss'); assert(controller.survivalBranchStats().calls > 0);
  assert.equal(controller.survivalBranchStats().agenda.observedFailedPlays, 1);
  replayedTaps += verifyAttempt(encodeGame(actual), [3, 0, 1, 2, 3], settings, controlled.audit());
  factory.verifySource();
  console.log('PASS playable survival branches veto a proved loss, preserve an open-twin continuation with partial information and multiple possible branches, retain a valid shared opening after a failed play, wire real outcomes through controller resets, protect wins/clock exits/deadlines and replay ' + replayedTaps + ' production taps');
}

if (require.main === module) test();
module.exports = test;
