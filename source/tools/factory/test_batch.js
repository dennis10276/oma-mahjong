'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { targetAt, validatePiles } = require('./build.js');
const { evaluate } = require('./batch_evaluate.js');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '../../analysis/factory/batch-200-225-plan.json')));

test('200-225 follows the user anchors and only 210 and 220 are big', () => {
  assert.equal(plan.levels.length, 26);
  assert.deepEqual(plan.levels.filter(s => s.big).map(s => s.level), [210, 220]);
  assert.equal(plan.levels[0].target, 7); assert.equal(plan.levels.at(-2).target, 9); assert.equal(plan.levels.at(-1).target, 10);
  for (const s of plan.levels) assert.equal(s.target, targetAt(s.level, plan.curve));
  const piles = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../analysis/factory', plan.piles)));
  validatePiles(plan.levels, piles, { bigLevels: [210, 220], levelTable: path.resolve(__dirname, '../../analysis/factory', plan.levelTable) });
});

const d = { tiles: [[0, 0, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0]], faces: [0, 0, 1, 1],
  down: [], obst: { ice: {}, locks: [], keys: [] }, clock: { i: 1, n: 3 }, solution: [0, 1, 2, 3] };
function measurement(exp) {
  return { expectedTries: exp, firstTryRate: 0, valid: true, version: 'fake',
    results: [{ attempts: [{ win: false, censored: false, why: 'clock', left: 3, decisions: [] }] }] };
}
test('candidate rating uses the full family meter and a separate fixed validation seed', () => {
  const calls = [];
  const result = evaluate({ design: d }, 'rate', { measure(board, opts) {
    calls.push(opts); return measurement(opts.seed === 4711 ? 7.2 : 8.1);
  } });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(o => [o.setting, o.runs, o.seeds, o.seed]), [['family', 20, 2, 4711], ['family', 20, 2, 18427]]);
  assert.equal(result.eligible, true); assert.equal((result.train.exp + result.validation.exp) / 2, 7.65);
});

test('a planner scouting run can reject but never qualify a board', () => {
  const calls = [];
  const result = evaluate({ design: d }, 'quality', { measure(board, opts) {
    calls.push(opts); return measurement(opts.setting === 'planner' ? 15 : 8);
  } });
  assert.equal(result.eligible, false); assert.equal(result.reason, 'plannerScreen');
  assert.equal(calls.length, 2); assert.equal(calls[1].runs, 3);
});
