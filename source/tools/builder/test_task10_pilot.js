'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), P = require('./task10_pilot.js'), M = require('../factory/meter.js');
test('pilot gold is a normal matching pair and preserves all measured puzzle inputs', () => {
  const d = { tiles: Array.from({ length: 16 }, (_, i) => [i * 4, 0, 0]), faces: Array.from({ length: 16 }, (_, i) => i >> 1),
    down: [], gold: [], clock: { i: 0, n: 2 }, obst: { ice: { 1: 1 }, locks: [2], keys: [3, 4] }, solution: Array.from({ length: 16 }, (_, i) => i) };
  const r = P.goldPair(d);
  assert.equal(r.gold.length, 2); assert.equal(r.faces[r.gold[0]], r.faces[r.gold[1]]);
  assert.ok(r.gold.every(i => ![0, 1, 2, 3, 4].includes(i)));
  assert.equal(M.boardKey(r), M.boardKey(d)); assert.deepEqual(d.gold, []);
});
test('the first-check denominator includes every successful construction, including rejected or missing checks', () => {
  const builds = [{ task: 'a', proofBuilt: true }, { task: 'b', proofBuilt: true }, { task: 'c', proofBuilt: false }];
  const x = P.hitRate(builds, [{ task: 'a', search: { valid: true }, validation: { valid: true }, firstHit: true, pooledHit: true }]);
  assert.equal(x.built, 2); assert.equal(x.firstCheckHitRate, 0.5); assert.equal(x.complete, false); assert.equal(x.meets50percent, false);
  const y = P.hitRate(builds, [{ task: 'a', search: { valid: true }, validation: { valid: true }, firstHit: true, pooledHit: true }, { task: 'b', search: { valid: true }, validation: { valid: true }, firstHit: true, pooledHit: false }]);
  assert.equal(y.meets50percent, true); assert.equal(y.firstCheckHitRate, 0.5);
  assert.equal(y.seed4711HitRate, 1, 'a favorable single seed cannot replace the declared pooled curve metric');
});

test('a sealed pilot cannot start checking unfinished or changed builds', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task10-seal-'));
  const p = { fingerprint: 'pilot', requests: [{ id: 'a' }] }, b = [{ task: 'a', proofBuilt: true, row: { design: { faces: [1, 1] } } }];
  try {
    assert.throws(() => P.sealBuilds(dir, p, []), /Finish every/);
    P.sealBuilds(dir, p, b); P.sealBuilds(dir, p, b);
    b[0].row.design.faces[0] = 2;
    assert.throws(() => P.sealBuilds(dir, p, b), /changed after sealing/);
  } finally { fs.unlinkSync(path.join(dir, 'built-plan.json')); fs.rmdirSync(dir); }
});
