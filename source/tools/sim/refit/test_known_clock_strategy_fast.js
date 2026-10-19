'use strict';
const assert = require('assert/strict');
const L = require('../../../www/layouts.js');
const reference = require('./known_tray_plan.js');
const original = require('./known_clock_strategy.js');
const fast = require('./known_clock_strategy_fast.js');
assert.deepEqual(fast.FEATURES, original.FEATURES); assert.deepEqual(fast.PARAMETERS, original.PARAMETERS);
for (let trial = 0; trial < 36; trial++) {
  const size = 4 + trial % 9, tiles = Array.from({ length: size }, (unused, index) => ({ x: index % 4 * 4, y: Math.floor(index / 4) * 4, z: 0 }));
  if (trial % 4 === 0) tiles[size - 1] = { ...tiles[0], z: 1 };
  const game = { tiles, nb: L.neighbors(tiles), clock: trial % 7 === 0 ? null : { i: trial % size, n: 1 + trial % 7 },
    rules: trial % 3 === 0 ? { ice: { 1: 1 }, iceNb: tiles.map((unused, index) => index === 1 ? [0] : []), locks: new Set([2]), keys: [0] } : null };
  const state = { alive: tiles.map(() => 1), pictures: tiles.map((unused, index) => (index + trial) % 5 === 0 ? null : index === 2 && trial % 2 ? 101 : index % 4),
    down: tiles.map((unused, index) => +(index % 2 === 0)), tray: trial % 4 === 0 ? [1, 2, 101] : trial % 3 === 0 ? [2] : [],
    moves: trial % 2, openPeek: -1, relieved: false, arriving: trial % 2 ? [101] : [] };
  const allowed = reference.legal(game, state).free;
  const peek = allowed.find(index => state.down[index] && state.pictures[index] !== null);
  if (trial % 3 === 1 && peek !== undefined) state.openPeek = peek;
  const actions = allowed.flatMap(index => [{ index, inspect: false }, ...(state.down[index] ? [{ index, inspect: true }] : [])]);
  const before = structuredClone({ game, state, actions });
  for (const parameters of [{ taps: 1, nodes: 1 }, { taps: 4, nodes: 24 }, { taps: 6, nodes: 48 }]) {
    const expected = original.featuresOf(game, state, actions, parameters);
    assert.deepEqual(fast.featuresOf(game, state, actions, parameters), expected, 'Clock feature/search-budget mismatch at trial' + trial);
    assert.deepEqual(fast.featuresOf(game, state, actions.slice().reverse(), parameters).features, expected.features.slice().reverse());
  }
  assert.deepEqual({ game, state, actions }, before);
}
const tiles = [{ x: 0, y: 0, z: 0 }], game = { tiles, nb: L.neighbors(tiles), clock: { i: 0, n: 1 } };
const state = { alive: [1], pictures: [101], down: [0], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
assert.deepEqual(fast.featuresOf(game, state, [{ index: 0 }]), original.featuresOf(game, state, [{ index: 0 }]));
assert.throws(() => fast.featuresOf(game, state, [{ index: 4 }]));
assert.throws(() => fast.featuresOf(game, state, [{ index: 0 }], { taps: 13 }));
console.log('PASS cached clock strategy preserves exact public features, node budgets, relief, twins, Jokers, boundaries and input immutability');
