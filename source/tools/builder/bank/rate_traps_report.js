#!/usr/bin/env node
'use strict';
// Validate complete cards and export the raw placement blockers. No rule overrides.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '../../../..');
const OUT = path.join(ROOT, 'codex-tasks/results/rate-traps-v1');
const BANK = path.join(ROOT, 'source/analysis/builder/bank/traps');
const M = require('../../factory/meter.js'), MS = require('./measure.js');
const LED = require('./ledger.js'), P = require('./place.js');
const { SEEDS } = require('./rate_traps.js');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const cards = fs.readdirSync(BANK).filter(f => f.endsWith('.json')).map(f => read(path.join(BANK, f)));
const inputs = fs.readdirSync(path.join(OUT, 'inputs')).filter(f => f.endsWith('.json'));
assert.equal(cards.length, inputs.length);
const rated = LED.loadRated();
const rows = cards.map(j => {
  const c = j.card, m = j.measurements;
  assert.equal(j.complete, true, j.input.file);
  assert.equal(c.boardKey, M.boardKey(j.design));
  assert.deepEqual(j.design, read(path.join(OUT, 'inputs', j.input.file)).original.design);
  assert.equal(c.protocol, 'extended-40-v1');
  assert.equal(m.sFull.ok, true); assert.equal(m.dFull.ok, true); assert.equal(m.trace.valid, true);
  assert.equal(m.sFull.n, 80); assert.equal(m.dFull.n, 160); assert.equal(m.trace.campaigns, 80);
  assert.deepEqual(m.sFull.calls, SEEDS.S_FULL.map(seed => ({ runs: 40, seed })));
  assert.deepEqual(m.dFull.calls, SEEDS.D_FULL.map(seed => ({ runs: 40, seed })));
  assert.equal(m.dFull.cap, 40); assert.equal(m.sFull.cap, 20);
  assert.equal(c.stats.D40, MS.stats(m.dFull.raw, 40).D40);
  assert.equal(m.stability.steps.length, 2);
  for (const s of m.stability.steps) { assert.equal(s.ok, true); assert.equal(s.n, 40); }
  const ledger = LED.check(LED.signature(j.design, c), rated);
  const failures = [];
  if (c.stats.S < 1.75 || c.stats.S > 6) failures.push('skilled band 1.75–6');
  if (typeof c.traceGates.B6.value === 'number' && c.traceGates.B6.value < 0.25) failures.push('post-clock loss share <0.25');
  if (!(typeof c.traceGates.B7.value === 'number' && c.traceGates.B7.value <= 0.3)) failures.push(c.traceGates.B7.value == null ? 'B7 unmeasured (no qualifying losses)' : 'repeated-blunder share >0.3');
  if (!ledger.ok) failures.push('ledger');
  const slots = [];
  for (let level = 250; level < 290; level++) { const s = P.slot(level); if (c.tiles >= s.minTiles && c.tiles <= s.maxTiles && Math.abs(c.stats.D40 - P.targetCurve(level)) <= 1 + 1e-9) slots.push(level); }
  if (!slots.length) failures.push('no size/curve-compatible slot 250–289');
  return { file: j.input.file, level: c.dennis?.level || j.spec.level, layout: c.layout, shape: c.trap.shape || c.trapType, chainLength: c.trap.chainLength ?? null, tiles: c.tiles,
    dennis: c.dennis, ...c.stats, stability: c.stability.ratio, postClockLossShare: c.traceGates.B6.value, repeatedBlunderShare: c.traceGates.B7.value,
    B1: c.traceGates.B1.value, B2: c.traceGates.B2.value, curveLevel: +(250 + 15 * (c.stats.D40 - 6)).toFixed(2),
    slots, failures, ledgerReasons: ledger.reasons, traceCounts: m.trace.counts, lossKinds: m.trace.lossKinds, errorKinds: m.trace.errorKinds,
    bait: m.bait && Object.fromEntries(['skilled', 'family'].map(k => { const { rows, ...v } = m.bait[k]; return [k, v]; })) };
}).sort((a, b) => (a.level || 10000) - (b.level || 10000) || a.file.localeCompare(b.file));
const ranks = a => a.map(x => 1 + a.filter(y => y < x).length + (a.filter(y => y === x).length - 1) / 2);
const correlation = (x, y) => {
  const a = ranks(x), b = ranks(y), ma = MS.mean(a), mb = MS.mean(b);
  const den = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) * b.reduce((s, v) => s + (v - mb) ** 2, 0));
  return den ? a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / den : null;
};
const chains = rows.filter(r => r.level >= 291 && r.level <= 296 && r.dennis);
const agreement = {};
for (const metric of ['S', 'D40', 'B1', 'B2', 'postClockLossShare', 'repeatedBlunderShare']) {
  const sample = chains.filter(r => Number.isFinite(r[metric]));
  const good = sample.filter(r => r.dennis.stars >= 4), easy = sample.filter(r => r.dennis.stars === 2);
  const comparisons = good.flatMap(a => easy.map(b => a[metric] > b[metric] ? 1 : a[metric] === b[metric] ? 0.5 : 0));
  agreement[metric] = { n: sample.length, starsSpearman: correlation(sample.map(r => r[metric]), sample.map(r => r.dennis.stars)),
    triesSpearman: correlation(sample.map(r => r[metric]), sample.map(r => r.dennis.tries)),
    likedAboveEasyPairShare: comparisons.length ? MS.mean(comparisons) : null };
}
M.atomicJson(path.join(OUT, 'summary.json'), { validated: cards.length, ledgerEntries: rated.length, agreement, rows });
const lines = ['| Board | Chain / layout / tiles | Dennis stars / tries | D40 (SE) | S | Stability | Post-clock | Repeat | Trap errors B2 | Curve level |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) lines.push(`| ${r.level || r.file.replace(/\.json$/, '')} | ${r.shape} / L${r.layout} / ${r.tiles} | ${r.dennis ? r.dennis.stars + ' / ' + r.dennis.tries : 'unrated'} | ${r.D40} (${r.D_se}) | ${r.S} | ${r.stability} | ${r.postClockLossShare ?? 'n/a'} | ${r.repeatedBlunderShare ?? 'n/a'} | ${r.B2 ?? 'n/a'} | ${r.curveLevel}${r.D40 < 5 ? ' (below 5)' : r.curveLevel > 289 ? ' (beyond requested range)' : ''} |`);
fs.writeFileSync(path.join(OUT, 'table.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ validated: cards.length, ledgerEntries: rated.length, agreement, rows }, null, 1));
