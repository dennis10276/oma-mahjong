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

test('measureCurve: a peek-pair shortcut board is probed below the witness, never shipped there', () => {
  // Level 202 (ebe4a48640ad0101): k = 9 with peek pairs, the stored witness takes the clock at index 10 (strict k 11).
  const row = qualified().find(r => r.id === 'ebe4a48640ad0101');
  const log = [], ys = Y.createYardstick({ measure: fakeMeasure(n => Math.min(0.9, 0.05 * (n - 1)), log) });
  const c = C.measureCurve(row.design, ys);
  assert.equal(c.k, 9);
  assert.deepEqual(c.points.map(p => p.clockN), [9, 10, 11, 12]);
  assert.deepEqual(c.points.map(p => p.probe || null), ['witnessWouldChange', 'witnessWouldChange', null, null]);
  assert.deepEqual(c.points.map(p => p.releaseSpare), [null, null, 0, 1]); // t_clocks: clock.n - 10 - 1
  assert(c.verdicts[1].reasons.includes('witnessWouldChange')); assert.equal(c.verdicts[1].canShip, false);
  assert(c.verdicts[2].reasons.includes('releaseTestSpare')); assert.equal(c.verdicts[2].canShip, false);
  assert.equal(c.verdicts[3].tighterNeighbour, true, 'spare 3 is judged against the measured spare 2');
  assert.deepEqual(c.shippable, [3]);
  assert.equal(log.length, 8);
  // Without probing, the failed spares are recorded and not rated.
  const log2 = [], c2 = C.measureCurve(row.design, Y.createYardstick({ measure: fakeMeasure(() => 0.3, log2) }), { probeUnwitnessed: false });
  assert.deepEqual(c2.points.map(p => p.D === null), [true, true, false, false]); assert.equal(log2.length, 4);
});

test('opening-clock rule: k <= 6 flags spare 1 (shippableOpeningRule), canShip unchanged', () => {
  const pts = [pt(0, 14), pt(1, 11), pt(2, 9), pt(3, 7.5)], steps = [st(0, -3), st(1, -2), st(2, -1.5)];
  let r = C.applyRules(pts, steps, undefined, { k: 6 });
  assert.equal(r.openingClock.restricted, true); assert.deepEqual(r.shippable, [1, 2, 3]); assert.deepEqual(r.shippableOpeningRule, [2, 3]);
  assert.equal(r.verdicts[1].openingClockOk, false);
  r = C.applyRules(pts, steps, undefined, { k: 7 });
  assert.equal(r.openingClock.restricted, false); assert.deepEqual(r.shippableOpeningRule, [1, 2, 3]);
  // Level 200 (k = 3) through measureCurve.
  const c = C.measureCurve(qualified()[0].design, Y.createYardstick({ measure: fakeMeasure(n => Math.min(0.9, 0.12 * n)) }));
  assert.equal(c.k, 3); assert.equal(c.openingClock.restricted, true); assert(!c.shippableOpeningRule.includes(1));
});

test('spare arithmetic matches engine.clockShortest and the stored witness on all qualified boards', () => {
  const E = require('../engine.js'), K = require('../knobs.js');
  for (const r of qualified()) {
    const t = K.clockSpare(r.design, 3);
    if (t.fail) continue;
    const k = E.clockShortest(E.game(JSON.parse(JSON.stringify(r.design)))).k;
    assert.equal(t.design.clock.n, k + 3); assert.equal(t.proof.minimum, k);
    // The witness's clock index + 1 is the strict minimum; at clock.n = that - 1 it no longer fits.
    const idx = r.design.solution.indexOf(r.design.clock.i), x = JSON.parse(JSON.stringify(r.design));
    x.clock.n = idx + 1; assert.equal(E.replay(x, x.solution).ok, true, r.id);
    x.clock.n = idx; assert.equal(E.replay(x, x.solution).ok, false, r.id);
    assert(idx + 1 >= k, 'the witness can never beat the proven minimum ' + r.id);
  }
});
