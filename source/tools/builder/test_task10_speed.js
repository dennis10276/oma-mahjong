'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Speed = require('./task10_speed.js'), S = require('./task10_study.js');
test('screening uses exact successive seed blocks, and requires both planner styles on the same side', () => {
  const calls = [], values = [1, 1, 10, 10];
  const meter = { measure(d, o) { calls.push(o); const n = values.shift(); return { valid: true, expectedTries: n, results: Array.from({ length: 10 }, () => ({ wonOn: n })) }; } };
  const r = Speed.screen(meter, {}, 'planner', 11, { skilled: { enabled: true, margin: 1 } });
  assert.equal(r.stopped, false); assert.equal(r.campaigns, 40);
  assert.equal(calls[1].seed, (4711 + Math.imul(10, 0x9e3779b9)) | 0);
  assert.deepEqual(calls.map(x => x.plannerStyle), ['route', 'route', 'plain', 'plain']);
});
test('trap training selection never uses held-out labels even when they look better', () => {
  const cells = [];
  for (const way of [10, 14, 18]) for (const three of [2, 5, 8]) for (const luck of [0, 1, 2]) cells.push({ story: 'deepClock', way, three, luck, traps: 0, seed: 1 });
  const training = cells.find(c => !S.heldout(c)), held = cells.find(S.heldout);
  const make = (cell, family, id) => ({ stage: 'range', brief: { story: cell.story }, cell, family: { exp: family }, skilled: { exp: 3 }, id });
  const specs = S.trapRequests({ boards: [make(training, 18, 'train'), make(held, 11, 'heldout')] });
  assert.equal(specs.length, 1); assert.equal(specs[0].way, training.way); assert.equal(specs[0].three, training.three); assert.equal(specs[0].luck, training.luck); assert.equal(specs[0].heldout, false);
});
