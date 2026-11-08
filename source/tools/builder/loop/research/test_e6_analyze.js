'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { analyze } = require('./e6_analyze.js');
const base = path.resolve(__dirname, '../../../../analysis/builder');
const read = f => fs.readFileSync(path.join(base, f), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const runs = read('library/pipeline-runs.jsonl'), gates = read('process-v1/e6-gates.jsonl'), rejects = read('library/rejects.jsonl');
test('E6 covers exactly 500 attempts; zero output never becomes a finite per-level CPU estimate', () => {
  const r = analyze(runs, gates, rejects);
  assert.equal(r.builds, 500); assert.equal(r.steps.build.pass, 455);
  assert.equal(r.steps.static.pass, 168); assert.equal(r.steps.screen.pass, 32);
  assert.equal(r.steps.planner.pass, 5); assert.equal(r.libraryCandidates, 0);
  assert.equal(r.cpuS, 863.422); assert.equal(r.supplyKill, true);
  assert.equal(r.cpuPerLibraryCandidate, null); assert.equal(r.cpuPerFinishedLevel, null);
  assert.equal(r.staticByGate.A2.fail, 273); assert.equal(r.finalists.length, 5);
});
test('E6 refuses missing chunks, overlapping chunks, mixed settings and damaged evidence', () => {
  assert.throws(() => analyze(runs.slice(1), gates, rejects), /exactly 500/);
  assert.throws(() => analyze([...runs, runs[0]], gates, rejects), /overlapping/);
  const mixed = structuredClone(runs); mixed[1].options.curveSpares = [0, 1, 2, 3, 4];
  assert.throws(() => analyze(mixed, gates, rejects), /mixed/);
  assert.throws(() => analyze(runs, gates.slice(1), rejects), /coverage/);
  assert.throws(() => analyze(runs, gates, rejects.slice(1)), /coverage/);
});
