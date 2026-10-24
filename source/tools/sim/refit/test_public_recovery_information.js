'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { knownRecovery } = require('./public_known_recovery.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');

function test() {
  const tiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), pictures: [1, 1, 2, 2, null, null], down: [0, 0, 0, 0, 1, 1],
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const options = { ...REFERENCE_PARAMETERS, taps: 6, nodes: 128, beam: 16, pruneDead: false,
    goalRecovery: true, goalRecoveryMin: 1, riskFirstRecovery: true, alternativeRecoveryRoutes: true,
    knownPairMacros: true, cachePublicAnalysis: true };
  const roots = tiles.map((tile, index) => ({ index }));
  const comparable = result => Object.fromEntries(['index', 'path', 'goal', 'knownWin', 'knownDead', 'information'].map(field => [field, result[field]]));
  const withRecovery = search(game, state, roots, { ...options, shortInformation: 'recoveryAware' });
  assert(knownRecovery(game, state));
  assert.deepEqual(comparable(withRecovery), comparable(search(game, state, roots, options)));
  assert.equal(withRecovery.informationPolicy.active, false);
  assert.equal(withRecovery.informationPolicy.recovery.kind, 'knownPair');
  const stranded = { ...state, pictures: [1, 2, 3, 4, null, null] };
  const snapshot = structuredClone(stranded);
  assert.equal(knownRecovery(game, stranded), null);
  const probing = search(game, stranded, roots, { ...options, shortInformation: 'recoveryAware' });
  assert.equal(probing.informationPolicy.active, true);
  assert.deepEqual(comparable(probing), comparable(search(game, stranded, roots, { ...options, shortInformation: true })));
  assert.deepEqual(stranded, snapshot);
  const crowdedOptions = { ...options, shortInformation: 'recoveryAware', recoveryInformationMinTray: 2 };
  for (const tray of [[], [7]]) {
    const lightlyCarried = { ...stranded, tray };
    const retained = search(game, lightlyCarried, roots, crowdedOptions);
    assert.equal(retained.informationPolicy.active, false);
    assert.equal(retained.informationPolicy.minimumTray, 2);
    assert.deepEqual(comparable(retained), comparable(search(game, lightlyCarried, roots, options)));
  }
  const crowded = { ...stranded, tray: [7, 8] };
  const seeking = search(game, crowded, roots, crowdedOptions);
  assert.equal(seeking.informationPolicy.active, true);
  assert.deepEqual(comparable(seeking), comparable(search(game, crowded, roots, { ...options, shortInformation: true })));
  const recovering = search(game, { ...crowded, pictures: [7, 2, 3, 4, null, null] }, roots, crowdedOptions);
  assert.equal(recovering.informationPolicy.active, false);
  assert.equal(recovering.informationPolicy.recovery.kind, 'trayMatch');
  assert.throws(() => search(game, state, roots, { ...crowdedOptions, recoveryInformationMinTray: -1 }));
  assert.throws(() => search(game, state, roots, { ...crowdedOptions, recoveryInformationMinTray: 4 }));
  const uncertain = { ...game, publicFrontier: () => ({ free: [0, 1, 2, 3, 4, 5], uncertain: [1] }) };
  const apparentPair = { ...stranded, pictures: [1, 1, 3, 4, null, null] };
  assert.equal(knownRecovery(uncertain, apparentPair), null);
  assert.equal(search(uncertain, apparentPair, roots, { ...options, shortInformation: 'recoveryAware' }).informationPolicy.active, true);
  const clocked = { ...game, clock: { i: 0, n: 3 } };
  assert.deepEqual(comparable(search(clocked, state, roots, { ...options, shortInformation: 'recoveryAware' })),
    comparable(search(clocked, state, roots, options)));
  const known = { ...state, pictures: [1, 1, 2, 2, 3, 3], down: tiles.map(() => 0) };
  assert(search(game, known, roots, { ...options, shortInformation: 'recoveryAware' }).knownWin);
  const expired = search(game, stranded, roots, { ...options, shortInformation: 'recoveryAware', deadline: 0 });
  assert(expired.boundary && !expired.knownDead);
  const actual = { tiles, nb: game.nb, faces: [1, 1, 2, 2, 3, 3], down: state.down, rules: null, clock: null };
  const replayed = playHumanCampaign(actual, { maximumAttempts: 1, planning: { ...options, shortInformation: 'recoveryAware' } });
  assert.equal(replayed.wonOn, 1);
  assert.equal(replayed.verifiedTaps, replayed.attempts[0].taps);
  const crowdedReplay = playHumanCampaign(actual, { maximumAttempts: 1, planning: crowdedOptions });
  assert.equal(crowdedReplay.wonOn, 1);
  assert.equal(crowdedReplay.verifiedTaps, crowdedReplay.attempts[0].taps);
  console.log('PASS adaptive information ordering preserves ordinary ranking with a constructive local recovery or below the declared tray threshold, prefers short probes in crowded states without recovery, rejects uncertain partners, retains wins/clocks and respects expired limits');
}

if (require.main === module) test();
module.exports = test;
