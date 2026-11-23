'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const E = require('../tools/builder/engine');
const { expert } = require('../tools/builder/bank/feel');

test('finish pressure starts after a required face-down pair on the way to the clock', () => {
  const design = {
    tiles: Array.from({ length: 8 }, (_, i) => [i * 4, 0, 0]),
    faces: [0, 1, 2, 3, 3, 0, 1, 2],
    down: [4],
    clock: { i: 5, n: 6 },
    solution: [0, 1, 2, 3, 4, 5, 6, 7],
  };
  assert.deepEqual(E.replay(design, design.solution), { ok: true, pairs: 1 });
  const finish = expert(design, { playouts: 2 });
  assert.equal(finish.games, 2);
  assert.deepEqual(finish.parkAt, [0, 0, 0]);
});
