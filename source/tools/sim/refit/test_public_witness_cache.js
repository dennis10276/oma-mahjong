'use strict';
const assert = require('assert/strict'), Layouts = require('../../../www/layouts.js');
const { cachedSearch, keyOf } = require('./public_witness_cache.js');
const { search, PARAMETERS } = require('./public_witness_search.js');
const tiles = [0, 1, 2, 3].map(index => ({ x: index * 8, y: 0, z: 0 }));
const game = { tiles, nb: Layouts.neighbors(tiles), clock: null, rules: null };
Object.defineProperty(game, 'faces', { enumerable: true, get() { throw new Error('Private picture cache key'); } });
Object.defineProperty(tiles[0], 'face', { enumerable: true, get() { throw new Error('Private nested tile picture cache key'); } });
Object.defineProperty(game.nb, 'private', { enumerable: true, get() { throw new Error('Private extra neighborhood metadata'); } });
const state = { alive: [1, 1, 1, 1], pictures: [1, 1, 2, 2], down: [0, 0, 0, 0], tray: [], moves: 0,
  openPeek: -1, relieved: false, arriving: [] };
const actions = state.alive.map((value, index) => ({ index, inspect: false }));
const memoized = cachedSearch(2), expected = search(game, state, actions);
assert.deepEqual(memoized(game, state, actions), expected);
const first = memoized(game, state, actions); first.path.push(99); first.provedDeadRoots.push(99);
assert.deepEqual(memoized(game, state, actions), expected);
assert.equal(memoized.stats().hits, 2);
const baseKey = keyOf(game, state, actions, PARAMETERS);
for (const changes of [{ pictures: [1, 2, 1, 2] }, { down: [1, 0, 0, 0] }, { tray: [1] }, { moves: 1 },
  { openPeek: 0, down: [1, 0, 0, 0] }, { relieved: true }, { arriving: [101] }]) {
  const changed = { ...state, ...changes };
  assert.notEqual(keyOf(game, changed, actions, PARAMETERS), baseKey);
}
assert.notEqual(keyOf(game, state, actions.slice(1), PARAMETERS), baseKey);
assert.notEqual(keyOf(game, state, actions, { ...PARAMETERS, nodes: 1 }), baseKey);
const locks = { tiles: game.tiles, nb: game.nb, clock: null, rules: { locks: new Set([0]), keys: [1, 2], ice: {}, iceNb: tiles.map(() => []) } };
const locked = keyOf(locks, state, actions, PARAMETERS); locks.rules.locks.add(3);
assert.notEqual(keyOf(locks, state, actions, PARAMETERS), locked);
assert.throws(() => memoized(game, { ...state, pictures: [NaN, 1, 2, 2] }, actions));
assert.deepEqual(memoized(game, state, actions, { nodes: 1 }), search(game, state, actions, { nodes: 1 }));
assert.deepEqual(memoized(game, state, actions, { nodes: 2 }), search(game, state, actions, { nodes: 2 }));
assert.equal(memoized.stats().entries, 2); assert.equal(memoized.stats().evictions, 1);
for (const setting of ['diverseBeam', 'diverseWitness', 'knownPairMacros', 'goalRecovery', 'alternativeGoalRoutes', 'passiveInformation']) {
  assert.notEqual(keyOf(game, state, actions, { ...PARAMETERS, [setting]: true }), baseKey);
}
const uncached = cachedSearch(4);
assert(uncached(game, state, actions).knownWin);
const expired = uncached(game, state, actions, { deadline: Date.now() - 1 });
assert(!expired.knownWin && !expired.knownDead && expired.boundary);
const callbackGame = { tiles, nb: game.nb, rules: null, clock: null, publicExposure: () => [2] };
uncached(callbackGame, state, actions); callbackGame.publicExposure = () => [];
assert.deepEqual(uncached(callbackGame, state, actions), expected);
assert.throws(() => keyOf(callbackGame, state, actions, PARAMETERS));
const frontierGame = { tiles, nb: game.nb, rules: null, clock: null,
  publicFrontier: position => ({ free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [] }) };
assert.deepEqual(uncached(frontierGame, state, actions), expected);
assert.equal(uncached.stats().hits, 0); assert.equal(uncached.stats().bypasses, 4); assert.equal(uncached.stats().entries, 1);
assert.throws(() => keyOf(game, state, actions, { decisionMs: 1 }));
console.log('PASS witness memoization keys all public settings, preserves immutable reports and bypasses live deadlines or opaque observation callbacks instead of reusing stale plans');
