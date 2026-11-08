'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const GP = require('./gate_profile.js');
function report() {
  return { pass: false, shipSpares: [2], gates: Object.fromEntries(['A1','A2','A3','A4','A5','A6','A7','A8','A9'].map(g => [g, { pass: !['A5','A7'].includes(g), detail: { evidence: g } }])) };
}
test('E5 profile changes decisions without erasing raw luck or detour evidence', () => {
  const raw = report(), p = GP.loadProfile(), r = GP.applyStatic(raw, p);
  assert.equal(r.pass, true); assert.equal(raw.gates.A7.pass, false);
  assert.equal(r.gates.A7.pass, null); assert.equal(r.gates.A7.wouldPass, false);
  assert.deepEqual(r.gates.A7.detail, raw.gates.A7.detail);
  assert.equal(GP.applyStatic(raw, GP.loadProfile('strict-v1')).pass, false);
  r.gates.A6.pass = false; assert.equal(GP.applyStatic(r, p).pass, false);
});
test('profiles bind exact thresholds and remain independent between callers', () => {
  const p = GP.loadProfile(), strict = GP.loadProfile('strict-v1');
  assert.notEqual(p.fingerprint, strict.fingerprint);
  assert.equal(p.traces.thresholds.B2.min, 0.2);
  const o = GP.traceOptions({ campaigns: 80 }, p); o.thresholds.B2.min = 1;
  assert.equal(p.traces.thresholds.B2.min, 0.2);
  assert.equal(GP.loadProfile().fingerprint, p.fingerprint);
  assert.throws(() => GP.loadProfile('typo'), /Unknown/);
  const r = report(); r.gates.A6.warn = 'unknown';
  assert.deepEqual(GP.unresolvedStatic(r, p), ['A6']);
});
