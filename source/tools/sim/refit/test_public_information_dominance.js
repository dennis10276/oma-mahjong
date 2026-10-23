'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt, playHumanCampaign } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

const fields = ['index', 'path', 'goal', 'knownWin', 'knownDead', 'deadCertificate', 'safeClockExit',
  'clockRoom', 'knownProgress', 'matchedTiles', 'information'];

function sameDecision(actual, expected) {
  for (const field of fields) assert.deepEqual(actual[field], expected[field], field);
}

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), pictures: [1, 1, 2, 2, 3, 3, null, null], down: [0, 0, 0, 0, 0, 0, 1, 1],
    tray: [], openPeek: -1, moves: 0, relieved: false, arriving: [] };
  const options = { ...REFERENCE_PARAMETERS, taps: 8, nodes: 128, beam: 16, pruneDead: false, finishKnown: false,
    goalRecovery: true, goalRecoveryMin: 1, alternativeRecoveryRoutes: true, riskFirstRecovery: true,
    knownPairMacros: true, cachePublicAnalysis: true, shortInformation: true };
  const roots = tiles.map((tile, index) => ({ index }));
  let savedNodes = 0;
  for (let shift = 0; shift < 36; shift++) for (const carried of [false, true]) {
    const position = { ...state, pictures: state.pictures.map(picture => picture === null ? null : (picture + shift) % 36),
      tray: carried ? [(9 + shift) % 36] : [] };
    const full = search(game, position, roots, options);
    const stopped = search(game, position, roots, { ...options, informationDominance: true });
    sameDecision(stopped, full);
    assert.equal(stopped.dominanceStop.completedLayers, 2);
    assert(stopped.nodes < full.nodes);
    assert(stopped.boundary && !stopped.knownDead && !stopped.knownWin);
    savedNodes += full.nodes - stopped.nodes;
  }
  const capped = search(game, state, roots, { ...options, nodes: 1, informationDominance: true });
  assert(!capped.dominanceStop && capped.boundary && !capped.knownDead);
  sameDecision(capped, search(game, state, roots, { ...options, nodes: 1 }));
  const crowded = { ...state, tray: [7, 8] };
  const untouched = search(game, crowded, roots, { ...options, informationDominance: true });
  assert(!untouched.dominanceStop);
  sameDecision(untouched, search(game, crowded, roots, options));
  const known = { ...state, pictures: [1, 1, 2, 2, 3, 3, 4, 4], down: tiles.map(() => 0) };
  const winning = search(game, known, roots, { ...options, informationDominance: true, taps: 12 });
  assert(winning.knownWin && !winning.dominanceStop);
  const clocked = { ...game, clock: { i: 0, n: 3 } };
  const exit = search(clocked, state, roots, { ...options, informationDominance: true });
  assert(exit.safeClockExit && !exit.dominanceStop);
  sameDecision(exit, search(clocked, state, roots, options));

  const covered = [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }];
  const projected = { tiles: covered, nb: Layouts.neighbors(covered), rules: null, clock: null };
  const projectedState = { ...state, alive: covered.map(() => 1), pictures: [7, null, null, null, 2, 2],
    down: [0, 0, 1, 1, 0, 0], tray: [7] };
  const projectedRoots = covered.flatMap((tile, index) => Layouts.isFree(index, projectedState.alive, projected.nb) ? [{ index }] : []);
  const delayed = search(projected, projectedState, projectedRoots, { ...options, informationDominance: true });
  sameDecision(delayed, search(projected, projectedState, projectedRoots, options));
  assert.equal(delayed.index, 0);
  assert.deepEqual(delayed.path, [0]);
  assert.equal(delayed.dominanceStop.completedLayers, 2, 'The second layer must consider newly readable face-up information without another physical tap');

  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 32, tapMs: 1000 };
  const selected = search(game, state, roots, { ...options, informationDominance: true });
  for (const hidden of [0, 7, 101]) {
    const actual = { tiles, nb: game.nb, faces: [1, 1, 2, 2, 3, 3, hidden, hidden], down: state.down, rules: null, clock: null };
    const session = factory(actual, settings), frame = session.tap(selected.index);
    assert.equal(frame.state.moves, 0);
    assert.equal(verifyAttempt(encodeGame(actual), selected.path, settings, session.audit()), 1);
  }
  factory.verifySource();
  assert.throws(() => search(game, state, roots, { ...options, informationDominance: 'yes' }));
  const actual = { tiles, nb: game.nb, faces: [1, 1, 2, 2, 3, 3, 4, 4], down: state.down, rules: null, clock: null };
  const campaign = playHumanCampaign(actual, { planning: { shortInformation: true, informationDominance: true } });
  assert.equal(campaign.wonOn, 1);
  assert(campaign.decisionCount > 0 && campaign.meanDecisionMs >= 0 && campaign.meanDecisionMs <= campaign.slowestMs);
  assert(campaign.dominanceStops > 0);
  console.log('PASS 72 fixed-budget information-order comparisons save ' + savedNodes + ' nodes without changing decisions; two completed layers preserve face-up reveal opportunities, while known wins, clocks, crowded trays and caps remain unshortened and production replay passes');
}

if (require.main === module) test();
module.exports = test;
