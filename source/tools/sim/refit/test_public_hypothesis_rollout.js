'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { searchHypothesisContinuation } = require('./public_hypothesis_rollout.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 40 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const pictures = tiles.map((unused, index) => Math.floor(index / 2));
  const geometry = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(geometry, field,
    { get() { throw Error('Rollout accessed private ' + field); } });
  const state = { alive: tiles.map(() => 1), pictures, down: tiles.map(() => 0), tray: [], moves: 0,
    openPeek: -1, relieved: false, arriving: [] };
  const actions = tiles.map((unused, index) => ({ index })), before = JSON.stringify(state);
  const broad = search(geometry, state, actions, { ...REFERENCE_PARAMETERS, nodes: 256, beam: 24,
    knownPairMacros: true, progressiveReopens: true, cachePublicAnalysis: true, proofNodes: 32 });
  const narrow = searchHypothesisContinuation(geometry, state, actions, { nodeLimit: 256, deadline: Date.now() + 1500 });
  assert.equal(broad.knownWin, false, 'The broad control must demonstrate the long-route node-budget failure');
  assert.equal(broad.knownDead, false, 'A missing bounded route is not an impossibility result');
  assert.equal(narrow.status, 'cleared'); assert.equal(narrow.stages[0].beam, 1);
  assert(narrow.nodes < broad.nodes && narrow.nodes <= 256);
  assert.equal(narrow.observedFact, false); assert.equal(narrow.productionVerified, false);
  assert.equal(JSON.stringify(state), before);
  const actual = { ...geometry, faces: pictures, down: state.down }, settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const factory = createSessionFactory(), session = factory(actual, settings);
  for (const index of narrow.path) { assert(session.view().legalTiles.includes(index)); session.tap(index); }
  assert.equal(session.view().win, true);
  assert.equal(verifyAttempt(encodeGame(actual), narrow.path, settings, session.audit()), narrow.path.length);
  const capped = searchHypothesisContinuation(geometry, state, actions, { nodeLimit: 1, deadline: Date.now() + 1500 });
  assert.equal(capped.status, 'unresolved'); assert.equal(capped.nodes, 1);
  const expired = searchHypothesisContinuation(geometry, state, actions, { nodeLimit: 256, deadline: 0 });
  assert.equal(expired.status, 'unresolved'); assert.equal(expired.nodes, 0); assert.deepEqual(expired.stages, []);
  assert.throws(() => searchHypothesisContinuation({ ...geometry, faces: pictures }, state, actions, { nodeLimit: 256, deadline: Date.now() + 1500 }));
  const keyTiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const keyRules = { iceNb: Layouts.iceNeighbors(keyTiles), ice: {}, keys: [0, 1], locks: new Set([2, 3]) };
  for (const clock of [null, { i: 3, n: 4 }]) {
    const keyGeometry = { tiles: keyTiles, nb: Layouts.neighbors(keyTiles), rules: keyRules, clock };
    const actualKeys = { ...keyGeometry, faces: [1, 2, 1, 2], down: [0, 0, 0, 0] };
    const keySession = factory(actualKeys, settings); keySession.tap(0);
    const position = { ...keySession.view().state, pictures: [1, 2, 1, 2] };
    const primitive = search(keyGeometry, position, [{ index: 1 }], { ...REFERENCE_PARAMETERS,
      nodes: 1, beam: 1, knownPairMacros: true, progressiveReopens: true, cachePublicAnalysis: true });
    const recovered = searchHypothesisContinuation(keyGeometry, position, [{ index: 1 }],
      { nodeLimit: 2, deadline: Date.now() + 1500 });
    assert.equal(primitive.knownWin, false); assert.equal(primitive.knownDead, false);
    assert.equal(recovered.status, 'cleared'); assert.equal(recovered.nodes, 1);
    assert.deepEqual(recovered.path, [1, 2, 3]);
    assert.equal(recovered.observedFact, false); assert.equal(recovered.productionVerified, false);
    for (const index of recovered.path) keySession.tap(index);
    assert(keySession.view().win);
    assert.equal(verifyAttempt(encodeGame(actualKeys), [0, ...recovered.path], settings, keySession.audit()), 4);
  }
  factory.verifySource();
  console.log('PASS a public synthetic40-tile route is missed by beam24 at256 nodes but found by a narrow-first hypothesis rollout in'
    + narrow.nodes + ' nodes; key/lock and exact-clock continuations now clear in one node using existing physical macros, independently replay in production and remain hypothetical; caps and deadlines stay unresolved');
}

if (require.main === module) test();
module.exports = test;
