'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { createHumanController, playHumanCampaign, verifyAttempt } = require('./human_reference_campaign.js');
const { search } = require('./public_witness_search.js');
const { survivalBranchSearch } = require('./public_survival_branches.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: .28, y: .28 / 1.24, z: 1 }, { x: 1, y: 0, z: 1 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 },
    { x: 12.28, y: .28 / 1.24, z: 1 }, { x: 20, y: 0, z: 0 },
    { x: 24.28, y: .28 / 1.24, z: 1 }, { x: 24, y: 0, z: 0 },
    { x: 28, y: 0, z: 0 }, { x: 32, y: 0, z: 0 }];
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const permutations = [[11, 17, 1], [11, 1, 17], [17, 11, 1], [17, 1, 11], [1, 11, 17], [1, 17, 11]];
  const options = { taps: 8, nodes: 512, beam: 24, pruneDead: false, knownPairMacros: true,
    clockInformationBeforeRisk: true, passiveInformation: 'shortRoles' };
  let canonical = null, canonicalPlan = null, replayedTaps = 0, controls = 0;
  const execute = (actual, route) => {
    const session = factory(actual, settings);
    for (const index of route) { assert(session.view().legalTiles.includes(index)); session.tap(index); }
    replayedTaps += verifyAttempt(encodeGame(actual), route, settings, session.audit());
    return session.view();
  };
  for (const hidden of permutations) for (const hiddenDown of [0, 1]) {
    const actual = { tiles, nb: Layouts.neighbors(tiles),
      faces: [hidden[0], 7, 9, 7, hidden[1], 9, 2, 17, 2, hidden[2], 11, 1],
      down: tiles.map((tile, index) => [0, 4, 9].includes(index) ? hiddenDown : 0),
      rules: null, clock: { i: 7, n: 21 } };
    const session = factory(actual, settings); session.tap(10);
    const frame = session.view(), takeable = new Set(frame.legalTiles);
    const packet = observeBoard(tiles, frame.state, actual.clock, { picture: index => actual.faces[index],
      role: () => 'none', takeable: index => takeable.has(index) });
    for (const index of [0, 4, 9]) { assert.equal(packet.pictures[index], null); assert.equal(packet.down[index], null); }
    const state = { ...frame.state, pictures: packet.pictures, down: packet.down };
    const game = { tiles, nb: actual.nb, rules: null, clock: packet.clock,
      publicFrontier: position => ({ free: position.alive.flatMap((alive, index) => alive
        && Layouts.isFree(index, position.alive, actual.nb) ? [index] : []), uncertain: [] }),
      publicExposure: createExposureFrontier(tiles, { ...state, roles: packet.roles }, 'roles') };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
    if (canonical === null) canonical = structuredClone(state); else assert.deepEqual(state, canonical);
    const before = structuredClone(state), actions = frame.legalTiles.map(index => ({ index }));
    const baseline = search(game, state, actions, options);
    const prepared = search(game, state, actions, { ...options, clockOrphanPreparation: true });
    const combinedSearch = survivalBranchSearch((publicGame, position, roots) => search(publicGame, position, roots,
      { ...options, clockOrphanPreparation: true }), { backtracking: true, earlyForks: true, nodes: 512, milliseconds: 100 });
    combinedSearch.beginAttempt();
    const combined = combinedSearch.search(game, state, actions);
    assert.equal(baseline.index, 7); assert(baseline.safeClockExit);
    assert.notEqual(prepared.index, 7); assert(prepared.information);
    assert(!prepared.knownWin && !prepared.knownDead && !prepared.safeClockExit);
    assert(prepared.orphanClockPreparation.consideredExits > 0);
    assert.deepEqual(combined.path, prepared.path, 'Active-clock preparation must not be replaced by a retry exploration request');
    assert.equal(combinedSearch.stats().agenda?.requestsScheduled ?? 0, 0);
    assert.deepEqual(state, before, 'Ranking must not promote hypothetical pictures to memory');
    if (canonicalPlan === null) canonicalPlan = prepared; else assert.deepEqual(prepared, canonicalPlan);
    const exited = execute(actual, [10, ...baseline.path]); assert.equal(exited.state.alive[7], 0);
    const discovered = execute(actual, [10, ...prepared.path]);
    const combinedDiscovery = execute(actual, [10, ...combined.path]);
    assert(combinedDiscovery.state.alive[7] && !combinedDiscovery.win
      && combinedDiscovery.why !== 'tray' && combinedDiscovery.why !== 'clock');
    assert(discovered.state.alive[7]); assert(!discovered.win && discovered.why !== 'tray' && discovered.why !== 'clock');
    const hiddenIndex = picture => [0, 4, 9][hidden.indexOf(picture)];
    assert(execute(actual, [10, 1, 3, 2, 5, 6, 8, hiddenIndex(11), 7, hiddenIndex(17), 11, hiddenIndex(1)]).win);
    const urgentGame = { ...game, clock: { i: 7, n: state.moves + 9 } };
    const urgentBaseline = search(urgentGame, state, actions, options);
    const urgent = search(urgentGame, state, actions, { ...options, clockOrphanPreparation: true });
    assert.deepEqual(urgent.path, urgentBaseline.path); assert.equal(urgent.orphanClockPreparation.consideredExits, 0);
    const partneredGame = { ...game, clock: { i: 1, n: 21 } };
    const partneredBaseline = search(partneredGame, state, actions, options);
    const partnered = search(partneredGame, state, actions, { ...options, clockOrphanPreparation: true });
    assert.deepEqual(partnered.path, partneredBaseline.path); assert(partnered.safeClockExit);
    assert(!partnered.orphanClockPreparation.selectedDeferredExit);
    assert.throws(() => search(game, state, actions, { ...options, clockOrphanPreparation: 'yes' }));
    assert.throws(() => search(game, state, actions, { ...options, clockOrphanPreparation: true, clockInformationBeforeRisk: false }));
    controls++;
  }
  assert.throws(() => createHumanController(tiles, { clockOrphanPreparation: true }));
  assert.throws(() => createHumanController(tiles, { clockOrphanPreparation: 'yes', clockInformationBeforeRisk: true }));
  const visibleTiles = [0, 8, 16, 24].map(position => ({ x: position, y: 0, z: 0 }));
  const visibleGame = { tiles: visibleTiles, nb: Layouts.neighbors(visibleTiles), faces: [7, 7, 9, 9],
    down: [0, 0, 0, 0], rules: null, clock: { i: 1, n: 10 } };
  const winning = playHumanCampaign(visibleGame, { planning: { clockOrphanPreparation: true,
    clockInformationBeforeRisk: true, finishKnown: true, survivalBranches: true,
    survivalBacktracking: true, survivalEarlyForks: true }, captureDecisions: true });
  assert.equal(winning.wonOn, 1); assert.equal(winning.verifiedTaps, 4);
  assert(winning.attempts[0].decisions.every(decision => decision.plan.goal === 'win'));
  replayedTaps += winning.verifiedTaps;
  factory.verifySource();
  console.log('PASS ' + controls + ' concealed winnable boards choose public preparation over a surplus-time two-orphan clock exit, preserve urgent/partnered exits, leave memory unchanged, and independently replay ' + replayedTaps + ' physical witness taps; test-only complete routes never enter the actor');
}

if (require.main === module) test();
module.exports = test;
