'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { aliveSignature } = require('./public_alive_signature.js');

function test() {
  const mutable = [1, 0, 1], frozen = Object.freeze([1, 0, 1]);
  assert.equal(aliveSignature(frozen), '101'); assert.equal(aliveSignature(frozen), '101');
  assert.equal(aliveSignature(mutable), '101'); mutable[1] = 1;
  assert.equal(aliveSignature(mutable), '111', 'Mutable positions must never receive stale identity-cache hits');
  let metricsHits = 0, proofHits = 0;
  for (const pictures of [[1, 1, 2, 2, 3, 3, 4, 4], [1, 1, 2, 2, 3, 3, null, null]]) {
    const tiles = pictures.map((picture, index) => ({ x: index * 4, y: 0, z: 0 }));
    const game = { tiles, nb: Layouts.neighbors(tiles), clock: null, rules: null };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
    for (const tray of [[], [7, 8]]) for (const proofNodes of [1, 128]) {
      const state = { alive: pictures.map(() => 1), pictures, down: pictures.map(picture => +(picture === null)),
        tray, moves: 0, openPeek: -1, relieved: false, arriving: [] };
      const actions = tiles.map((tile, index) => ({ index }));
      const options = { ...REFERENCE_PARAMETERS, taps: 6, nodes: 512, beam: 32, finishKnown: false,
        goalRecovery: true, goalRecoveryMin: 1, proofNodes };
      const original = search(game, state, actions, options);
      const cached = search(game, state, actions, { ...options, cachePublicAnalysis: true });
      for (const field of ['index', 'path', 'goal', 'knownWin', 'knownDead', 'safeClockExit', 'knownProgress', 'matchedTiles',
        'information', 'boundary', 'unknownTransitions', 'unsupportedTransitions', 'prunedDeadSuccessors']) assert.deepEqual(cached[field], original[field], field);
      assert(cached.continuationProof.nodes <= original.continuationProof.nodes);
      metricsHits += cached.analysisCache.metricsHits; proofHits += cached.analysisCache.proofHits;
    }
  }
  assert(metricsHits > 0); assert(proofHits > 0);
  let routeHits = 0;
  for (const clocked of [false, true]) {
    const pictures = [1, 1, 2, 2, 3, 3], tiles = pictures.map((picture, index) => ({ x: index * 4, y: 0, z: 0 }));
    const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: clocked ? { i: 0, n: 3 } : null };
    for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
    const state = { alive: tiles.map(() => 1), pictures, down: tiles.map(() => 1),
      tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
    const actions = tiles.map((tile, index) => ({ index }));
    const options = { ...REFERENCE_PARAMETERS, taps: 4, nodes: 128, beam: 16, progress: 4, finishKnown: false, pruneDead: false,
      goalRecovery: true, goalRecoveryMin: 1, alternativeGoalRoutes: true, alternativeRecoveryRoutes: true,
      riskFirstRecovery: true, knownPairMacros: true };
    const original = search(game, state, actions, options), cached = search(game, state, actions, { ...options, cachePublicAnalysis: true });
    for (const field of ['index', 'path', 'goal', 'knownWin', 'knownDead', 'safeClockExit', 'knownProgress', 'matchedTiles',
      'information', 'boundary', 'nodes', 'unknownTransitions', 'unsupportedTransitions']) assert.deepEqual(cached[field], original[field], field);
    routeHits += cached.analysisCache.routeHits;
  }
  assert(routeHits > 0);
  console.log('PASS per-search public-state analysis caching preserves fixed-budget paths and conclusions while reusing ' + metricsHits + ' metric, ' + proofHits + ' proof and ' + routeHits + ' dependency calculations without private-deck access; cached bounds remain unresolved');
}

if (require.main === module) test();
module.exports = test;
