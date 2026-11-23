'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { measure, fit, score, decide, split } = require('../tools/builder/bank/board_check');

const simple = {
  tiles: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [2, 2, 0], [0, 4, 0], [2, 4, 0]],
  faces: [1, 1, 2, 2, 3, 3],
  clock: { i: 0, n: 6 },
  solution: [0, 1, 2, 3, 4, 5],
};

test('removable pairs alone do not count as believable wrong plans', () => {
  const row = measure(simple);
  assert.equal(row.win, 'win');
  assert.equal(row.minimumClock, 1);
  assert.equal(row.longPlans, 0);
  assert.equal(row.immediateLosses, 0);
});

test('missing stored routes fall back to an exact winning witness', () => {
  const row = measure({ ...simple, solution: [] });
  assert.equal(row.win, 'win');
  assert.equal(row.longPlans, 0);
});

test('a mirrored and picture-renamed board keeps its result', () => {
  const changed = {
    ...simple,
    tiles: simple.tiles.map(([x, y, z]) => [2 - x, y, z]),
    faces: simple.faces.map(f => 20 - f),
  };
  const a = measure(simple);
  const b = measure(changed);
  for (const key of ['win', 'longPlans', 'minimumClock', 'immediateLosses']) {
    assert.equal(a[key], b[key], key);
  }
});

test('reference families stay together across the holdout and each class is represented', () => {
  const labels = ['easy', 'good', 'too-hard'];
  const examples = labels.flatMap(label => [0, 1, 2, 3].map(i =>
    ({ id: label + i, family: label + Math.floor(i / 2), class: label })));
  const { training, heldOut } = split(examples);
  assert.deepEqual(new Set(heldOut.map(r => r.class)), new Set(labels));
  assert.deepEqual(new Set(training.map(r => r.class)), new Set(labels));
  assert(training.every(x => !heldOut.some(y => x.family === y.family)));
  assert.deepEqual(split(examples.slice().reverse()).heldOut, heldOut);
});

test('calibration has a distinct too-hard verdict and a failed holdout closes the lab gate', () => {
  const sample = (label, longPlans) => ({ class: label, win: 'win', longPlans });
  const rows = [sample('easy', 0), sample('easy', 1), sample('good', 3), sample('too-hard', 9)];
  const model = fit(rows);
  assert.equal(score(rows, model).correct, 4);
  assert.equal(decide(rows[1], { model, qualified: true }).status, 'not-ready');
  assert.equal(decide(rows[2], { model, qualified: true }).status, 'lab-ready');
  assert.equal(decide(rows[3], { model, qualified: true }).status, 'too-hard');
  assert.equal(decide(rows[2], { model, qualified: false }).status, 'not-ready');
  assert.equal(decide({ win: 'unknown', longPlans: 8 }, { model, qualified: true }).status, 'not-ready');
});


test('an authored plan proves the commitment, five purposeful moves and clock consequence', () => {
  const { auditPlan } = require('../tools/builder/bank/board_check');
  const tower = Array.from({ length: 6 }, (_, z) => [0, 0, z]);
  const separate = Array.from({ length: 6 }, (_, i) => [4 * i, 6, 0]);
  const design = {
    tiles: tower.concat(separate),
    faces: [1, 2, 2, 3, 3, 4, 4, 1, 5, 5, 4, 4],
    clock: { i: 0, n: 6 },
    obst: { locks: [7], keys: [6, 11] },
  };
  const clock = { kind: 'clock', tile: 0 };
  const plan = {
    prefix: [],
    commit: { goal: { kind: 'key', tile: 6 }, take: 6 },
    steps: [5, 4, 3, 2, 1].map(take => ({ goal: clock, take })),
  };
  const report = auditPlan(design, plan);
  assert.equal(report.result, 'proved');
  assert.equal(report.followOnMoves, 5);
  assert.equal(report.endsBy, 'clock');
  assert.equal(report.twoMoreClockMoves, 'win');
  const unrelated = { ...plan, steps: [{ goal: clock, take: 8 }, ...plan.steps.slice(1)] };
  assert.equal(auditPlan(design, unrelated).result, 'unrelated-move');
  const truncated = { ...plan, steps: plan.steps.slice(0, 4) };
  assert.equal(auditPlan(design, truncated).result, 'too-short');
});
