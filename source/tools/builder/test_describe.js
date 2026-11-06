/* Tests for describe.js (node --test source/tools/builder/test_describe.js). */
'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { describe, peel, gameOf } = require('./describe.js');

test('a row of four: clock way, spare, peel rounds and the tray along the way', () => {
  const d = { tiles: [[0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0]], faces: [0, 0, 1, 1], down: [], gold: [],
    obst: { ice: {}, locks: [], keys: [] }, clock: { i: 2, n: 3 }, solution: [3, 2, 0, 1] };
  const r = describe(d, { room: false });
  assert.equal(r.valid, true);
  assert.equal(r.frame.k, 2);
  assert.equal(r.frame.spare, 1);
  assert.equal(r.frame.depth, 0);
  assert.equal(r.frame.clockPeel, 2);
  assert.equal(r.order.peelRounds, 2);
  assert.equal(r.pressure.exactWay.max, 1);
  assert.equal(r.pressure.exactWay.moves, 2);
  assert.equal(r.where.clockAt, 0.5);
  assert.equal(r.traps, null);
  assert.equal(r.flat['frame.k'], 2);
});

test('a lock in front of the clock: the keys are on the way and add a peel round', () => {
  const d = { tiles: [0, 4, 8, 12, 16, 20].map(x => [x, 0, 0]), faces: [0, 0, 1, 1, 2, 2], down: [], gold: [],
    obst: { ice: {}, locks: [5], keys: [0, 1] }, clock: { i: 5, n: 3 }, solution: [0, 1, 5, 4, 2, 3] };
  const r = describe(d, { room: false });
  assert.equal(r.valid, true);
  assert.equal(r.frame.k, 3);
  assert.equal(r.frame.spare, 0);
  assert.equal(r.frame.locked, true);
  assert.equal(r.frame.clockPeel, 2);
  assert.equal(r.frame.clockPeelPlain, 1);
  assert.equal(r.order.specialsOnWay.keys, 2);
  assert.equal(r.order.keysBeforeClock, true);
  // in sight at the start: three face-up pairs; the clock goes to the tray and waits one move
  assert.equal(r.stage.pairsAtStart, 2);           // the locked tile is not takeable, so pair 2 is not usable yet
  assert.equal(r.pressure.exactWay.max, 1);
  const g = gameOf(d);
  assert.deepEqual([...peel(g, true).round], [1, 1, 1, 1, 1, 2]);
});

test('face-up pairs and peek pairs are counted apart; a peek pair takes no tray slot', () => {
  // T sits on A and B; A is face-down. T + D are a face-up pair; A (face-down) + B are a peek pair.
  const d = { tiles: [[0, 0, 0], [2, 0, 0], [1, 0, 1], [6, 0, 0]], faces: [1, 1, 0, 0], down: [0], gold: [],
    obst: { ice: {}, locks: [], keys: [] }, clock: null, solution: [2, 3, 0, 1] };
  const r = describe(d, { room: false });
  assert.equal(r.valid, true);
  const f = r.pressure.full;
  assert.equal(f.max, 1);                 // T waits one move for D; A + B never touch the tray
  assert.equal(f.peekTaken, 2);
  assert.equal(f.peekSteps, 2);           // once T is gone (before D, before A) a peek pair is available
  assert.equal(f.pairsMin, 0);
  assert.equal(r.hidden.nDown, 1);
  assert.equal(r.flat['frame.k'], null);  // no clock: no frame numbers
});

test('a real qualified board: the exact way is no longer than the stored one and at least the bound', () => {
  const file = path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'qualified-200-225.jsonl');
  const row = JSON.parse(fs.readFileSync(file, 'utf8').split('\n')[0]);
  const r = describe(row.design, { shape: row.shape });
  assert.equal(r.valid, true);
  assert.equal(r.frame.kResolved, true);
  assert.ok(r.frame.k <= r.frame.witnessK);
  assert.ok(r.frame.k >= r.frame.bound);
  assert.ok(r.frame.spare >= 0);
  assert.equal(r.stage.tiles, row.design.tiles.length);
  assert.ok(r.pressure.full.max <= 3);
  assert.ok(r.hidden.luck && r.hidden.luck.ok !== false);
  for (const v of Object.values(r.flat)) assert.ok(v === null || Number.isFinite(v));
});
