'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const S = require('./task10_study.js'), M = require('../factory/meter.js');
test('Task 10 never pools an absent or invalid family campaign into a rating', () => {
  const design = { tiles: [[0, 0, 0], [4, 0, 0]], faces: [0, 0], clock: null };
  const p = S.protocol(), board = { design }, records = new Map();
  const put = (i, x) => records.set(S.keyFor(design, p.settings[i], p.bot), x);
  put(0, { valid: true, exp: 10, first: 0.1 }); put(2, { valid: true, exp: 3, first: 0.2 });
  assert.equal(S.rating(board, records, p).family, null);
  assert.equal(S.rating(board, records, p).skilled.exp, 3);
  put(1, { valid: false, exp: null }); assert.equal(S.rating(board, records, p).family, null);
  put(1, { valid: true, exp: 12, first: 0.2 }); assert.equal(S.rating(board, records, p).family.exp, 11);
  assert.notEqual(S.keyFor(design, p.settings[0], p.bot), S.keyFor(design, p.settings[1], p.bot));
});
test('Task 10 repeats stay in the same held-out cell, and a changed plan is rejected', () => {
  const cell = { story: 'deepClock', way: 14, three: 5, luck: 1, traps: 0, seed: 1 };
  assert.equal(S.heldout(cell), S.heldout({ ...cell, seed: 2 }));
  assert.notEqual(S.cellId(cell), S.cellId({ ...cell, seed: 2 }));
  const plan = { boards: [{ id: 'board', value: 1 }] }; plan.fingerprint = M.digest(plan);
  S.verifyPlan(plan); plan.boards[0].value = 2;
  assert.throws(() => S.verifyPlan(plan), /contents changed/);
});
