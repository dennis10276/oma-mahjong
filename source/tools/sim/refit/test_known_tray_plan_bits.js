'use strict';
const assert = require('assert/strict');
const L = require('../../../www/layouts.js');
const reference = require('./known_tray_plan.js'), optimized = require('./known_tray_plan_bits.js');
const random = L.rng(20261018);
for (let sample = 0; sample < 240; sample++) {
  const size = 4 + Math.floor(random() * 7), tiles = Array.from({ length: size }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  if (sample % 3 === 0) for (let index = 1; index < size; index += 3) tiles[index] = { ...tiles[index - 1], z: 1 };
  const game = { tiles, nb: L.neighbors(tiles), rules: sample % 4 === 0
    ? { ice: { 1: 1 }, iceNb: tiles.map((tile, index) => index === 1 ? [0] : []), locks: new Set([size - 1]), keys: [0, 2] } : null,
  clock: sample % 17 === 0 ? { i: size - 1, n: 4 } : null };
  const pictures = tiles.map(() => random() < 0.2 ? null : Math.floor(random() * 3));
  if (sample % 19 === 0) pictures[size - 1] = 101;
  const state = { alive: tiles.map(() => random() < 0.2 ? 0 : 1), pictures, down: tiles.map(() => random() < 0.3 ? 1 : 0),
    tray: Array.from({ length: sample % 4 }, (_, index) => index), moves: Math.floor(random() * 8), openPeek: -1,
    relieved: sample % 7 === 0, arriving: sample % 5 === 0 ? [101] : [] };
  const allowed = reference.legal(game, state);
  const peek = allowed.free.find(index => state.pictures[index] !== null && state.down[index]);
  if (peek !== undefined && sample % 2 === 0) state.openPeek = peek;
  const actions = allowed.free.map(index => ({ index, inspect: !!state.down[index] && index !== state.openPeek }));
  const before = JSON.stringify(state);
  for (const options of [{}, { taps: 3, nodes: 17, progress: 2 }]) {
    assert.deepEqual(optimized.featuresOf(game, state, actions, options), reference.featuresOf(game, state, actions, options), 'sample ' + sample);
  }
  assert.equal(JSON.stringify(state), before);
}
const tiles = [{ x: 0, y: 0, z: 0 }], game = { tiles, nb: L.neighbors(tiles) };
const state = { alive: [1], pictures: [101], down: [0], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
assert.deepEqual(optimized.featuresOf(game, state, [{ index: 0 }]), reference.featuresOf(game, state, [{ index: 0 }]));
console.log('PASS optimized planning preserves all features, node counts and boundaries across randomized public states, ice/locks, peeks and Joker finale');


for (const size of [31, 32, 33, 63, 64, 65, 84, 96, 97, 128]) {
  const tiles = Array.from({ length: size }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: L.neighbors(tiles) };
  const pictures = tiles.map(() => null);
  for (const index of [0, 1, size - 2, size - 1]) pictures[index] = index % 2;
  const state = { alive: tiles.map(() => 1), pictures, down: tiles.map(() => 0), tray: [], moves: 0,
    openPeek: -1, relieved: false, arriving: [] };
  const actions = [0, 1, size - 2, size - 1].map(index => ({ index }));
  assert.deepEqual(optimized.featuresOf(game, state, actions), reference.featuresOf(game, state, actions), 'bit lane size ' + size);
}
console.log('PASS bitset planning preserves unsigned lanes beyond 32/64/96 tiles');
