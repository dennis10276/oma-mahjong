'use strict';
// Family screen (process-design-synthesis.md section 6 step 4, section 2 "SCREEN" block).
//
//   const s = screenBoard(design, ys, { lo, hi });   // open target range [lo, hi]
//   s.keep, s.reasons, s.points[1], s.points[3], s.campaigns, s.botCampaigns
//
// SCREEN = the 20-campaign prefix of seed 4711 ({runs:20, seeds:1, seed:4711}), rated at spare 1 and
// spare 3 (knobs.clockSpare; a spare whose stored witness does not fit is rated as a probe at
// clock.n = k + s, see dial_curve.js). Keep rule:
//   D(1) >= lo - 1   and   D(3) <= hi + 1   and   D(1) < 18.5
//
// Early stop (sequential test). The 20 campaigns are played in 4 chunks of 5; chunk j is the meter
// call {runs:5, seeds:1, seed:(4711 + imul(5j, 0x9e3779b9))|0}, which plays exactly campaigns
// 5j..5j+4 of the SCREEN block (yardstick.splitCall). After 5, 10 and 15 campaigns the rating stops
// when the running mean m_n is beyond the threshold t of a failing condition by more than
//   z * sd(t) / sqrt(n),   sd(t) = SD of min(Geometric, 20) with mean t
// (the precision table's sqrt(D(D-1)), with the 20-try cap). A board that is not stopped gets the
// exact SCREEN value. Spare 1 is screened first; a board that fails there never pays for spare 3.
// z is calibrated in calibrate() (Monte Carlo on the capped geometric, plus a replay of real
// key-memory ratings from the cache) and pinned in yardstick.json blocks.SCREEN.sequential.z.
// If the CURVE 4711 rating at that spare is already cached, its visible first 20 campaigns ARE the
// SCREEN block: they are used without bot time.
const fs = require('fs'), path = require('path');
const Y = require('./yardstick.js');
const C = require('./dial_curve.js');

const CAP = 20;

// Capped geometric: X = min(G, cap), G ~ Geometric(p) on 1, 2, ... ; E[X] = (1 - q^cap) / p.
function cappedMean(p, cap = CAP) { const q = 1 - p; return p >= 1 ? 1 : (1 - q ** cap) / p; }
function pForMean(t, cap = CAP) {
  if (t <= 1) return 1;
  if (t >= cap) return 0;
  let lo = 1e-9, hi = 1;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (cappedMean(mid, cap) > t) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function cappedSd(t, cap = CAP) {
  if (t <= 1) return 0;
  const p = pForMean(t, cap), q = 1 - p;
  let m = 0, m2 = 0;
  for (let k = 1; k < cap; k++) { const w = q ** (k - 1) * p; m += k * w; m2 += k * k * w; }
  const tail = q ** (cap - 1); m += cap * tail; m2 += cap * cap * tail;
  return Math.sqrt(Math.max(0, m2 - m * m));
}

// The conditions a screen point can fail, as (threshold, side). side 'below': fail if D < t;
// 'above': fail if D > t ('atLeast' fails at D >= t; early stop treats it like 'above').
function conditions(spare, lo, hi, R) {
  if (spare === 1) return [{ name: 'tooEasyAtSpare1', t: lo - 1, side: 'below' }, { name: 'censoredAtSpare1', t: R.censoredAt, side: 'atLeast' }];
  if (spare === 3) return [{ name: 'tooHardAtSpare3', t: hi + 1, side: 'above' }];
  return [];
}
const fails = (D, c) => c.side === 'below' ? D < c.t : c.side === 'above' ? D > c.t : D >= c.t;
function earlyFail(m, n, c, z) {
  const b = z * cappedSd(c.t) / Math.sqrt(n);
  return c.side === 'below' ? m < c.t - b : m > c.t + b;
}

function screenSpare(design, spare, ys, { conds, z, chunk, looks, early, clockOptions }) {
  const sp = C.spareDesign(design, spare, clockOptions, true);
  if (sp.fail) return { spare, fail: sp.fail, D: null };
  const d = sp.design, seq = ys.pins.blocks.SCREEN;
  const base = { spare, clockN: d.clock.n, k: sp.k, ...(sp.probe ? { probe: sp.probe } : {}) };
  // Cached CURVE 4711 at this spare: its visible sub-block is the SCREEN block.
  const curve4711 = Y.blockCalls(ys.pins, 'CURVE', { campaigns: 40 });
  if (ys.cached(d, curve4711)) {
    const r = ys.rateCalls(d, curve4711, { alternatives: ys.pins.blocks.CURVE.cacheAlternatives || [] });
    const tries = r.perCampaign.slice(0, seq.campaigns);
    if (tries.length === seq.campaigns && r.valid) {
      const D = tries.reduce((a, b) => a + b, 0) / tries.length;
      return { ...base, D, n: tries.length, valid: true, perCampaign: tries, stoppedAt: null, source: 'curve4711Cache', botCampaigns: 0 };
    }
  }
  const chunks = Y.splitCall(seq.calls[0], chunk), tries = [];
  let valid = true, botCampaigns = 0;
  for (let j = 0; j < chunks.length; j++) {
    const cached = ys.cached(d, [chunks[j]]);
    const r = ys.rateCalls(d, [chunks[j]]);
    if (!cached) botCampaigns += chunks[j].runs;
    tries.push(...r.perCampaign); valid = valid && r.valid;
    const n = tries.length, m = tries.reduce((a, b) => a + b, 0) / n;
    if (!valid) return { ...base, D: m, n, valid: false, perCampaign: tries, stoppedAt: n, source: 'chunks', botCampaigns };
    if (early && n < seq.campaigns && looks.includes(n)) {
      const hit = conds.find(c => earlyFail(m, n, c, z));
      if (hit) return { ...base, D: m, n, valid, perCampaign: tries, stoppedAt: n, stoppedBy: hit.name, source: 'chunks', botCampaigns };
    }
  }
  const D = tries.reduce((a, b) => a + b, 0) / tries.length;
  return { ...base, D, n: tries.length, valid, perCampaign: tries, stoppedAt: null, source: 'chunks', botCampaigns };
}

// screenBoard(design, ys, { lo, hi }) -> { keep, reasons, points, campaigns, botCampaigns, seconds }
function screenBoard(design, ys, { lo, hi, early = true, z, order = [1, 3], clockOptions } = {}) {
  if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi)) throw Error('screenBoard needs an open target range lo <= hi');
  const started = Date.now(), seq = ys.pins.blocks.SCREEN.sequential || {};
  const R = { ...C.DEFAULT_RULES, ...(ys.pins.curveRules || {}) };
  const opt = { z: z ?? seq.z ?? 2.5, chunk: seq.chunk ?? 5, looks: seq.looks ?? [5, 10, 15], early, clockOptions };
  const points = {}, reasons = [];
  for (const spare of order) {
    const conds = conditions(spare, lo, hi, R);
    const p = screenSpare(design, spare, ys, { ...opt, conds });
    points[spare] = p;
    if (p.fail) { reasons.push(`spare${spare}:${p.fail}`); break; }
    if (!p.valid) { reasons.push(`spare${spare}:invalidRating`); break; }
    const failed = conds.filter(c => p.stoppedBy ? c.name === p.stoppedBy : fails(p.D, c)).map(c => c.name);
    if (failed.length) { reasons.push(...failed); break; }
  }
  const all = Object.values(points);
  return { keep: reasons.length === 0, reasons, lo, hi, z: opt.z, points,
    campaigns: all.reduce((a, p) => a + (p.n || 0), 0), botCampaigns: all.reduce((a, p) => a + (p.botCampaigns || 0), 0),
    fingerprint: ys.fingerprint, seconds: (Date.now() - started) / 1000 };
}

// ---------- calibration of z ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const drawCapped = (p, u) => { if (p >= 1) return 1; const g = Math.ceil(Math.log(1 - u) / Math.log(1 - p)); return Math.min(CAP, Math.max(1, g)); };

// Probability that the sequential rule stops early for condition c when the true mean is `trueD`,
// and the mean number of campaigns used. Pure Monte Carlo on min(Geometric, 20).
function simulateStop(trueD, c, z, { looks = [5, 10, 15], total = 20, sims = 20000, seed = 1 } = {}) {
  const p = pForMean(trueD), u = rng(seed);
  let stops = 0, used = 0;
  for (let s = 0; s < sims; s++) {
    let sum = 0, n = 0, stopped = false;
    while (n < total) {
      sum += drawCapped(p, u()); n++;
      if (looks.includes(n) && earlyFail(sum / n, n, c, z)) { stopped = true; break; }
    }
    if (stopped) stops++;
    used += n;
  }
  return { stopRate: stops / sims, meanCampaigns: used / sims };
}

// Real-data replay: per-campaign tries of real key-memory ratings in the cache (20 visible
// campaigns each). The threshold is put exactly at the rating's own 40-campaign D (a board on the
// edge of the keep rule), both sides; a stop is then a false stop.
function replayCache(cacheDir, z, { looks = [5, 10, 15], version = 'human-g6.3-key-memory-candidate1', limit = Infinity } = {}) {
  const rows = [];
  for (const f of fs.readdirSync(cacheDir)) {
    if (rows.length >= limit) break;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8')); } catch { continue; }
    if (j.version !== version || j.valid !== true || !Array.isArray(j.results) || j.results.length !== 20 || j.runs !== 20) continue;
    if (j.plannerStyles) continue; // planner ratings are not the family ruler
    rows.push({ D40: j.expectedTries, tries: j.results.map(r => r.wonOn == null ? CAP : r.wonOn) });
  }
  return summarizeReplay(rows, z, looks);
}
function summarizeReplay(rows, zs, looks = [5, 10, 15]) {
  const out = { rows: rows.length, perZ: {} };
  const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  // Spread per campaign against the model, by D band.
  out.spread = [[1, 3], [3, 6], [6, 10], [10, 14], [14, 20.01]].map(([a, b]) => {
    const g = rows.filter(r => r.D40 >= a && r.D40 < b);
    if (!g.length) return { band: [a, b], n: 0 };
    const obs = Math.sqrt(g.reduce((s, r) => s + sd(r.tries) ** 2, 0) / g.length);
    const model = Math.sqrt(g.reduce((s, r) => s + cappedSd(r.D40) ** 2, 0) / g.length);
    return { band: [a, b], n: g.length, sdObserved: +obs.toFixed(2), sdModel: +model.toFixed(2), ratio: +(obs / model).toFixed(2) };
  });
  for (const z of [].concat(zs)) {
    let low = 0, high = 0, eligibleLow = 0;
    for (const r of rows) {
      const cl = { t: r.D40, side: 'below' }, ch = { t: r.D40, side: 'above' };
      let sum = 0, stopL = false, stopH = false;
      for (let n = 1; n <= 20; n++) {
        sum += r.tries[n - 1];
        if (looks.includes(n)) { stopL = stopL || earlyFail(sum / n, n, cl, z); stopH = stopH || earlyFail(sum / n, n, ch, z); }
      }
      if (r.D40 > 1) eligibleLow++;
      low += stopL; high += stopH;
    }
    out.perZ[z] = { falseStopBelow: +(low / Math.max(1, eligibleLow)).toFixed(4), falseStopAbove: +(high / rows.length).toFixed(4) };
  }
  return out;
}

// Pick the smallest z whose simulated false-stop rate at the threshold is <= target for every
// threshold in the grid and both sides.
function calibrate({ zs = [1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5], grid = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18.5], target = 0.02, sims = 20000, cacheDir } = {}) {
  const table = zs.map(z => {
    const at = grid.map(t => {
      const below = simulateStop(t, { t, side: 'below' }, z, { sims, seed: 11 + t * 100 });
      const above = simulateStop(t, { t, side: 'above' }, z, { sims, seed: 7 + t * 100 });
      // Power: true D one SCREEN-SE (sd(t)/sqrt(20)) * 2 beyond the threshold.
      const off = 2 * cappedSd(t) / Math.sqrt(20);
      const farBelow = t - off > 1 ? simulateStop(t - off, { t, side: 'below' }, z, { sims, seed: 13 + t * 100 }) : null;
      const farAbove = t + off < CAP ? simulateStop(t + off, { t, side: 'above' }, z, { sims, seed: 17 + t * 100 }) : null;
      return { t, falseBelow: below.stopRate, falseAbove: above.stopRate, powerBelow: farBelow?.stopRate ?? null, powerAbove: farAbove?.stopRate ?? null,
        campaignsBelow: farBelow?.meanCampaigns ?? null, campaignsAbove: farAbove?.meanCampaigns ?? null };
    });
    return { z, maxFalse: Math.max(...at.map(a => Math.max(a.falseBelow, a.falseAbove))), at };
  });
  const chosen = table.find(r => r.maxFalse <= target) || table[table.length - 1];
  const replay = cacheDir ? replayCache(cacheDir, zs) : null;
  return { target, chosenZ: chosen.z, table, replay };
}

module.exports = { screenBoard, screenSpare, conditions, earlyFail, cappedSd, cappedMean, pForMean, simulateStop, calibrate, summarizeReplay, replayCache };

if (require.main === module) {
  const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
  if (process.argv.includes('--calibrate')) {
    const res = calibrate({ cacheDir: arg('cache') || Y.CACHE_DIR, sims: Number(arg('sims') || 20000) });
    const out = arg('out');
    const brief = { target: res.target, chosenZ: res.chosenZ,
      sim: res.table.map(r => ({ z: r.z, maxFalse: r.maxFalse })), chosenTable: res.table.find(r => r.z === res.chosenZ).at, replay: res.replay };
    if (out) fs.writeFileSync(out, JSON.stringify(brief, null, 2) + '\n');
    console.log(JSON.stringify(brief, null, 2));
  } else {
    console.error('usage: node screen.js --calibrate [--cache dir] [--sims n] [--out file]');
    process.exit(64);
  }
}
