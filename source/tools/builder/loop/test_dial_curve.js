'use strict';
// node --test source/tools/builder/loop/test_dial_curve.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const C = require('./dial_curve.js'), Y = require('./yardstick.js');

const QUALIFIED = path.resolve(__dirname, '../../../analysis/builder/data/qualified-200-225.jsonl');
const qualified = () => fs.readFileSync(QUALIFIED, 'utf8').trim().split('\n').map(JSON.parse);

// Fake meter: per-campaign tries from a common uniform per campaign seed (inverse geometric CDF),
// so a looser clock (higher p) gives fewer or equal tries on every campaign, like a paired bot.
function u01(seed) {
  let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function fakeMeasure(pOfN, log = []) {
  return (board, settings) => {
    log.push(board.clock.n);
    const { runs, seeds, seed } = settings, p = pOfN(board.clock.n), results = [], pooled = [];
    for (let s = 0; s < seeds; s++) for (let r = 0; r < runs; r++) {
      const u = u01(((seed + s * 7919) | 0) + Math.imul(r + 1, 0x9e3779b9) | 0);
      const tries = p >= 1 ? 1 : Math.ceil(Math.log(1 - u) / Math.log(1 - p));
      const c = tries <= 20 ? { wonOn: tries, attempts: Array(tries).fill({}) } : { wonOn: null, attempts: Array(20).fill({}) };
      pooled.push(c); if (s === 0) results.push(c);
    }
    const exp = pooled.reduce((t, c) => t + (c.wonOn ?? 20), 0) / pooled.length;
    return { expectedTries: Number(exp.toFixed(2)), firstTryRate: 0, valid: true, results };
  };
}
const pt = (spare, D, extra = {}) => ({ spare, D, clockN: 10 + spare, valid: true, ...extra });
const st = (from, diff, seDiff = 0.2) => ({ from, to: from + 1, diff, seDiff });

test('rules: a smooth curve ships spares 1-3 and is diallable', () => {
  const pts = [pt(0, 14), pt(1, 11), pt(2, 9), pt(3, 7.5)];
  const r = C.applyRules(pts, [st(0, -3), st(1, -2), st(2, -1.5)]);
  assert.deepEqual(r.shippable, [1, 2, 3]);
  assert.equal(r.verdicts[0].canShip, false); assert.deepEqual(r.verdicts[0].reasons, ['tighterNeighbourUnmeasured', 'probeOnly']);
  assert.equal(r.verdicts[3].monotone, null); assert.deepEqual(r.verdicts[3].notes, ['monotoneUnchecked']);
  assert(Math.abs(r.ratio13 - 11 / 7.5) < 1e-12); assert.equal(r.diallable, true); assert.equal(r.monotone, true);
});

test('rules: tighter-neighbour cliff (the 217 lesson), monotone breach, censoring, clock limit, flat dial', () => {
  // D(0) 20 next to D(1) 8: 20 > min(12, 11) -> spare 1 refused; spare 2 still fine.
  let r = C.applyRules([pt(0, 20), pt(1, 8), pt(2, 7), pt(3, 6)], [st(0, -12), st(1, -1), st(2, -1)]);
  assert.deepEqual(r.verdicts[1].reasons, ['cliffAtTighterNeighbour']); assert.deepEqual(r.shippable, [2, 3]);
  // The limit is min(1.5 D, D + 3): at D 4 the ratio binds (6), at D 10 the +3 binds (13).
  r = C.applyRules([pt(0, 6), pt(1, 4)], [st(0, -2)]); assert.equal(r.verdicts[1].tighterNeighbour, true);
  r = C.applyRules([pt(0, 6.01), pt(1, 4)], [st(0, -2)]); assert.equal(r.verdicts[1].tighterNeighbour, false);
  r = C.applyRules([pt(0, 13), pt(1, 10)], [st(0, -3)]); assert.equal(r.verdicts[1].tighterNeighbour, true);
  r = C.applyRules([pt(0, 13.01), pt(1, 10)], [st(0, -3)]); assert.equal(r.verdicts[1].tighterNeighbour, false);
  // Looser spare harder by more than max(0.5, 2 SE): spare 1 refused.
  r = C.applyRules([pt(0, 9), pt(1, 8), pt(2, 9)], [st(0, -1), st(1, 1, 0.3)]);
  assert.equal(r.verdicts[1].monotone, false); assert(r.verdicts[1].reasons.includes('cliffToLooser')); assert.equal(r.monotone, false);
  // ... but within 2 SE it is noise.
  r = C.applyRules([pt(0, 9), pt(1, 8), pt(2, 9)], [st(0, -1), st(1, 1, 0.6)]);
  assert.equal(r.verdicts[1].monotone, true); assert.equal(r.monotone, true);
  // Censored and over-long clocks.
  r = C.applyRules([pt(0, 20), pt(1, 19), pt(2, 18.4, { clockN: 20 })], [st(0, -1), st(1, -0.6)]);
  assert(r.verdicts[1].reasons.includes('censored')); assert(r.verdicts[2].reasons.includes('clockOver19'));
  assert.deepEqual(r.shippable, []);
  // Flat dial: not diallable.
  r = C.applyRules([pt(0, 8), pt(1, 7.6), pt(2, 7.3), pt(3, 7)], [st(0, -0.4), st(1, -0.3), st(2, -0.3)]);
  assert.equal(r.diallable, false); assert.deepEqual(r.shippable, [1, 2, 3]);
  // A spare that clockSpare refused is reported, and blocks its looser neighbour's tighter check.
  r = C.applyRules([{ spare: 0, fail: 'witnessWouldChange', D: null }, pt(1, 8), pt(2, 7)], [st(1, -1)]);
  assert.deepEqual(r.verdicts[0].reasons, ['witnessWouldChange']); assert.equal(r.verdicts[1].canShip, false); assert.deepEqual(r.shippable, [2]);
});

test('measureCurve: knobs.clockSpare per spare, paired seeds, paired SE below unpaired', () => {
  const log = [], ys = Y.createYardstick({ measure: fakeMeasure(n => Math.min(0.9, 0.04 * (n - 1)), log) });
  const design = qualified()[0].design; // clockShortest k = 3
  const c = C.measureCurve(design, ys);
  assert.deepEqual(c.points.map(p => p.clockN), [3, 4, 5, 6]);
  assert.deepEqual(log, [3, 3, 4, 4, 5, 5, 6, 6]); // two production calls per spare
  assert.equal(c.steps.length, 3);
  for (const s of c.steps) {
    assert.equal(s.pairs, 40); assert.equal(s.n, 80);
    assert(s.diff <= 0, 'common random numbers: looser never harder');
    assert(s.seDiff < s.seUnpaired, `paired ${s.seDiff} < unpaired ${s.seUnpaired}`);
  }
  assert(c.points[0].D > c.points[3].D);
  assert.equal(c.fingerprint, Y.loadPins().family.fingerprint);
  assert.deepEqual(Object.keys(c.points[1]).filter(k => ['spare', 'clockN', 'D', 'pHat', 'se'].includes(k)).sort(), ['D', 'clockN', 'pHat', 'se', 'spare']);
  assert(c.shippable.every(s => [1, 2, 3].includes(s)));
  assert.equal(typeof c.diallable, 'boolean');
  // Pairing by seed index: step SE equals SD of per-campaign differences over sqrt(80).
  const [a, b] = [c.points[1], c.points[2]], d = a.perCampaign.map((x, i) => b.perCampaign[i] - x);
  assert(Math.abs(c.steps[1].seDiff - Y.sampleSd(d) / Math.sqrt(80)) < 1e-12);
});

test('measureCurve: a clockSpare failure is recorded, not rated', () => {
  const rows = qualified(), row = rows.find(r => require('../knobs.js').clockSpare(r.design, 0).fail);
  assert(row, 'some qualified board has a stored witness longer than the shortest clock route');
  const log = [], ys = Y.createYardstick({ measure: fakeMeasure(() => 0.3, log) });
  const c = C.measureCurve(row.design, ys);
  assert(c.points[0].fail); assert.equal(c.points[0].D, null);
  assert.equal(log.length, 2 * c.points.filter(p => p.D != null).length);
});
