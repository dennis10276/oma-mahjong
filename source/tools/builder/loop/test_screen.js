'use strict';
// node --test source/tools/builder/loop/test_screen.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const S = require('./screen.js'), Y = require('./yardstick.js'), M = require('../../factory/meter.js');

const QUALIFIED = path.resolve(__dirname, '../../../analysis/builder/data/qualified-200-225.jsonl');
const qualified = () => fs.readFileSync(QUALIFIED, 'utf8').trim().split('\n').map(JSON.parse);
const pins = Y.loadPins();

// Fake meter: per-campaign tries from the campaign's own seed (like the bots), geometric with p(clock.n).
function u01(seed) {
  let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function fakeMeasure(pOfN, log = []) {
  return (board, settings) => {
    log.push({ n: board.clock.n, ...settings });
    const { runs, seeds = 2, seed } = settings, p = pOfN(board.clock.n), results = [], pooled = [];
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
const design = () => qualified()[1].design; // level 201: k = 9, witness fits at every spare

test('capped geometric: inverse mean and SD (the precision table without the cap)', () => {
  for (const t of [1.5, 3, 8, 12, 18.5]) assert(Math.abs(S.cappedMean(S.pForMean(t)) - t) < 1e-6);
  assert(Math.abs(S.cappedSd(2) - Math.sqrt(2)) < 0.01);       // cap irrelevant at D 2
  assert(Math.abs(S.cappedSd(4) - Math.sqrt(12)) < 0.1);
  assert(S.cappedSd(12) < Math.sqrt(132) * 0.7, 'the 20-try cap shrinks the spread at D 12');
  assert.equal(S.cappedSd(1), 0);
});

test('early stop: false-stop rate <= 2% at the threshold for z 3 (pinned)', () => {
  assert.equal(pins.blocks.SCREEN.sequential.z, 3);
  for (const t of [4, 8, 12]) for (const side of ['below', 'above']) {
    const r = S.simulateStop(t, { t, side }, 3, { sims: 4000, seed: t });
    assert(r.stopRate <= 0.025, `t ${t} ${side}: ${r.stopRate}`);
  }
  // ... and it does stop clearly-out boards: D 2 against lo - 1 = 9.
  const far = S.simulateStop(2, { t: 9, side: 'below' }, 3, { sims: 4000 });
  assert(far.stopRate > 0.95 && far.meanCampaigns < 12, JSON.stringify(far));
});

test('screenBoard: chunks are the SCREEN campaigns; keep rule at spares 1 and 3', () => {
  const log = [], ys = Y.createYardstick({ measure: fakeMeasure(n => Math.min(0.95, 0.025 * n), log) });
  const r = S.screenBoard(design(), ys, { lo: 4, hi: 12, early: false });
  // spare 1 -> clock.n 10, spare 3 -> 12; four 5-campaign chunks each, one seed.
  assert.deepEqual(log.map(c => [c.n, c.runs, c.seeds]), [...Array(4).fill([10, 5, 1]), ...Array(4).fill([12, 5, 1])]);
  assert.deepEqual(log.slice(0, 4).map(c => c.seed), Y.splitCall(pins.blocks.SCREEN.calls[0], 5).map(c => c.seed));
  // The chunked value equals the one-call SCREEN value.
  const whole = Y.createYardstick({ measure: fakeMeasure(n => Math.min(0.95, 0.025 * n)) });
  const sp1 = require('../knobs.js').clockSpare(design(), 1).design;
  assert.equal(r.points[1].D, whole.rate(sp1, { block: 'SCREEN' }).D);
  assert.equal(r.points[1].n, 20); assert.equal(r.campaigns, 40); assert.equal(r.botCampaigns, 40);
  const D1 = r.points[1].D, D3 = r.points[3].D;
  assert.equal(r.keep, D1 >= 3 && D3 <= 13 && D1 < 18.5);
  // Too easy at spare 1: spare 3 is never rated.
  const log2 = [], easy = S.screenBoard(design(), Y.createYardstick({ measure: fakeMeasure(() => 0.6, log2) }), { lo: 8, hi: 12, early: false });
  assert.equal(easy.keep, false); assert.deepEqual(easy.reasons, ['tooEasyAtSpare1']); assert.equal(easy.points[3], undefined);
  assert(log2.every(c => c.n === 10));
  // Too hard at spare 3.
  const hard = S.screenBoard(design(), Y.createYardstick({ measure: fakeMeasure(() => 0.06) }), { lo: 3, hi: 6, early: false });
  assert.deepEqual(hard.reasons, ['tooHardAtSpare3']);
  // Censored at spare 1.
  const wall = S.screenBoard(design(), Y.createYardstick({ measure: fakeMeasure(() => 0.001) }), { lo: 3, hi: 30, early: false });
  assert(wall.reasons.includes('censoredAtSpare1'));
  assert.throws(() => S.screenBoard(design(), ys, { lo: 5 }));
});

test('screenBoard: early stop saves campaigns on a clearly-out board, never on an in-band one', () => {
  const log = [], easy = S.screenBoard(design(), Y.createYardstick({ measure: fakeMeasure(() => 0.7, log) }), { lo: 12, hi: 14 });
  assert.equal(easy.keep, false); assert.equal(easy.points[1].stoppedBy, 'tooEasyAtSpare1');
  assert(easy.points[1].stoppedAt <= 10, 'stopped after ' + easy.points[1].stoppedAt); assert.equal(log.length, easy.points[1].stoppedAt / 5);
  const hard = S.screenBoard(design(), Y.createYardstick({ measure: fakeMeasure(n => n >= 12 ? 0.05 : 0.3) }), { lo: 2, hi: 4 });
  assert.equal(hard.points[3].stoppedBy, 'tooHardAtSpare3'); assert(hard.points[3].n < 20);
  // In band: both spares rated in full.
  const ok = S.screenBoard(design(), Y.createYardstick({ measure: fakeMeasure(() => 0.15) }), { lo: 5, hi: 9 });
  assert.equal(ok.points[1].n, 20); assert.equal(ok.points[3].n, 20); assert.equal(ok.points[1].stoppedAt, null);
});

test('screenBoard: a cached CURVE 4711 rating is the SCREEN block (no bot time)', () => {
  // Level 200 is stored at spare 1; Codex rated it (d362e85f), which the meter migrates to the fast ruler.
  const src = path.resolve(__dirname, '../../../build/factory-cache'), d = qualified()[0].design;
  const f = M.digest({ fingerprint: pins.family.codexFingerprint, input: M.boardOf(d), settings: { setting: 'family', runs: 20, seeds: 2, seed: 4711 } }) + '.json';
  if (!fs.existsSync(path.join(src, f))) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'screen-cache-'));
  try {
    fs.copyFileSync(path.join(src, f), path.join(dir, f));
    const ys = Y.createYardstick({ cacheDir: dir, ledgerFile: false });
    const r = S.screenBoard(d, ys, { lo: 30, hi: 31 }); // lo - 1 = 29: rejected at spare 1, spare 3 never rated
    assert.equal(r.points[1].source, 'curve4711Cache'); assert.equal(r.botCampaigns, 0); assert.deepEqual(r.reasons, ['tooEasyAtSpare1']);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.deepEqual(r.points[1].perCampaign, saved.results.map(x => x.wonOn ?? 20));
    assert.equal(ys.meters.family.stats.calls, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real smoke: 4 chunks of 5 play exactly the SCREEN campaigns with the fast ruler', () => {
  const ys = Y.createYardstick({ cacheDir: false, ledgerFile: false }), d = qualified()[0].design;
  const started = Date.now();
  const whole = ys.rateCalls(d, pins.blocks.SCREEN.calls), parts = ys.rateCalls(d, Y.splitCall(pins.blocks.SCREEN.calls[0], 5));
  assert.deepEqual(parts.perCampaign, whole.perCampaign);
  assert.equal(parts.D, whole.D); assert.equal(whole.valid, true);
  assert(Date.now() - started < 30000, 'took ' + (Date.now() - started) + ' ms');
});
