'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('./publicfork.js'), traps = require('../../factory/design_traps.js');
const SG = require('./static_gates.js');
test('A7 calibration preserves loss and unknown evidence, and leaves defaults intact', t => {
  t.mock.method(traps, 'roomProfile', () => ({ ok: true, unrelieved: 2, tightBlind: 3 }));
  t.mock.method(P, 'luckFromStart', () => ['win', 'lose', 'unknown', 'win']);
  const d = { tiles: Array.from({ length: 8 }, (_, i) => [i * 4, 0, 0]), faces: [0, 0, 1, 1, 2, 2, 3, 3], down: [], obst: {}, clock: { i: 0, n: 3 }, solution: [0, 1, 2, 3, 4, 5, 6, 7] };
  const opts = { budget: 1, previous: [] };
  const original = SG.staticGates(d, opts);
  const relaxed = SG.staticGates(d, { ...opts, thresholds: { A7: { unrelieved: 2, tightBlind: 3, lostDeals: 1 } } });
  assert.equal(original.gates.A7.pass, false); assert.equal(relaxed.gates.A7.pass, true);
  assert.deepEqual(relaxed.gates.A7.detail.results, ['win', 'lose', 'unknown', 'win']);
  assert.equal(relaxed.gates.A7.warn, 'unknown');
  assert.equal(SG.staticGates(d, opts).gates.A7.pass, false);
  assert.equal(relaxed.gates.A1.pass, false, 'relaxing A7 does not make an invalid board pass');
});
