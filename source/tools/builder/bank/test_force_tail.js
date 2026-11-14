'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const F = require('./force_tail.js'), Tl = require('./tail.js'), E = require('../engine.js'), SEP = require('./separate.js');
const fixture = require('./fixtures/lab5/before-force-302.json').design;
test('tail picture repair proves two-waiting pressure without changing the trap, face-down set or strict clock prefix', () => {
  const d = structuredClone(fixture), prefix = d.solution.slice(0, d.solution.indexOf(d.clock.i) + 1), frozen = d.faces[64];
  const r = F.tune(d, { ms: 10000, seed: 19, band: [0.06, 0.18], freeze: [64], openFreeze: false, validate: x => ({ ok: E.replay(x, x.solution, { strict: true }).ok }) });
  assert.ok(r.ok, JSON.stringify(r.failures)); assert.ok(r.after.targetMet);
  assert.equal(r.after.cap1.result, 'lose'); assert.equal(r.after.cap2.result, 'win');
  assert.deepEqual(r.design.tiles, d.tiles); assert.deepEqual(r.design.clock, d.clock); assert.deepEqual(r.design.obst, d.obst); assert.deepEqual(r.design.down, d.down);
  assert.deepEqual(r.design.solution.slice(0, prefix.length), prefix);
  for (const i of prefix) assert.equal(r.design.faces[i], d.faces[i]);
  for (let i = 0; i < d.faces.length; i++) if (d.faces[i] === frozen) assert.equal(r.design.faces[i], frozen);
  assert.deepEqual(r.design.faces.slice().sort(), d.faces.slice().sort());
  assert.ok(SEP.closeTwins(r.design).visible === 0);
  assert.ok(Tl.gambleFacts(r.design).gamble <= Tl.gambleFacts(d).gamble);
  assert.ok(E.replay(r.design, r.design.solution, { strict: true }).ok);
  assert.deepEqual(d, fixture, 'input is not mutated');
});
test('a rejected complete proof never returns an accepted board', () => {
  const d = structuredClone(fixture);
  const r = F.tune(d, { ms: 500, seed: 19, band: [0, 1], validate: () => ({ ok: false, why: 'deliberately rejected' }) });
  assert.equal(r.ok, false); assert.equal(r.design, undefined); assert.deepEqual(d, fixture);
});
