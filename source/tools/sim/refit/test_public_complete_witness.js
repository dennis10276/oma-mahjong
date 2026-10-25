'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { completeWitness } = require('./public_complete_witness.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index === 0 ? 0 : 2 + (index - 1) * 4, y: 0, z: 0 }));
  const initial = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 4, 4], down: tiles.map(() => 0), rules: null, clock: null };
  const cases = [initial, { ...initial, down: [1, 0, 1, 0, 1, 0, 1, 0] },
    { ...initial, clock: { i: 0, n: 2 } },
    { ...initial, clock: { i: 1, n: 4 }, rules: { ice: { 0: 1 }, iceNb: Layouts.iceNeighbors(tiles), keys: [2, 3], locks: new Set([1]) } }];
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 512, tapMs: 1000 };
  for (const actual of cases) {
    const game = { tiles, nb: actual.nb, rules: actual.rules, clock: actual.clock };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Read hidden ' + field); } });
    const session = factory(actual, settings), state = { ...session.view().state, pictures: actual.faces.slice() };
    const snapshot = structuredClone(state), roots = session.view().legalTiles.map(index => ({ index }));
    const result = completeWitness(game, state, roots, { deadline: Date.now() + 1000, nodes: 2000 });
    assert(result.path?.length);
    assert.equal(result.reason, 'complete_known_win');
    assert.deepEqual(state, snapshot);
    for (const index of result.path) { assert(session.view().legalTiles.includes(index)); session.tap(index); }
    assert(session.view().win);
    assert.equal(verifyAttempt(encodeGame(actual), result.path, settings, session.audit()), result.path.length);
    const expired = completeWitness(game, state, roots, { deadline: 0 });
    assert.equal(expired.path, null); assert(expired.boundary);
    const shallow = completeWitness(game, state, roots, { taps: 1 });
    assert.equal(shallow.path, null); assert(shallow.boundary);
    const partial = { ...state, pictures: state.pictures.map((picture, index) => index === 0 ? null : picture) };
    assert.equal(completeWitness(game, partial, roots).reason, 'incomplete_public_memory');
    assert(!('knownDead' in shallow));
  }
  factory.verifySource();
  console.log('PASS complete public-memory witnesses independently clear production pairs, backs, clocks, keys and ice; no private fields read, inputs preserved, and incomplete/capped/deadline results never claim impossibility');
}
if (require.main === module) test();
module.exports = test;
