#!/usr/bin/env node
/* E1 dial audit (process-design-synthesis.md section 7), on EXISTING data only. No bot is run.
     node source/tools/builder/loop/research/e1_dial_audit.js [--out DIR] [--no-factory-a3]
   Writes e1-dial-audit.json and e1-dial-audit.md to source/analysis/builder/process-v1/ (or DIR).

   Questions
   (1) Same-puzzle dial curves: how often is a spare shippable under section 3's rules
       (monotone with a noise margin, tighter-neighbour D(s-1) <= min(1.5 D(s), D(s)+3), D(s) < 18.5)?
       Split by D band (<6, 6-16, >16) and by bot (reference f3285928 lineage vs family-key-memory-v1 d362e85f).
   (2) Noise: per-campaign spread vs D from two-seed pairs (and, as a cross-check, from the per-campaign
       results[] kept in the rating cache), compared with sqrt(D(D-1)) and with the capped (20 tries) geometric.
   (3) A3: engine.clockShortest k (peek pairs allowed, the game's rules) vs the stored witness clock index + 1
       (t_clocks' definition) vs the strict (no peek pair) shortest, plus Hard.validSolution of the stored witness.

   Data are read-only. Puzzle identity = the board content without clock.n (meter.boardOf with clock.n blanked),
   so "same puzzle" never depends on a file's labels. Spare = clock.n - k, k from engine.clockShortest (peek). */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WT = path.resolve(__dirname, '..', '..', '..', '..', '..');   // this worktree (cc-builder-loop)
const ROOT = path.dirname(WT);                                        // C:\Users\den_k\Idea\OmasMahjong
const SRC = path.join(WT, 'source');
const P = {
  ladderRef: path.join(SRC, 'analysis/builder/why-hard-v1/v3-reference/ladder-summary.json'),
  ladderBoards: path.join(SRC, 'analysis/builder/why-hard-v1/v3-reference/ladder-readable/boards.json'),
  ladderKm: path.join(ROOT, 'codex-level-factory/source/build/why-hard-v3-candidate/ladder-summary.json'),
  knobsV1: path.join(SRC, 'analysis/builder/knobs-v1/boards.json'),
  spare1Plan: path.join(SRC, 'analysis/builder/knobs/clock-spare-1/plan.json'),
  spare1Summary: path.join(SRC, 'analysis/builder/knobs/clock-spare-1/summary.json'),
  qualified: path.join(SRC, 'analysis/builder/data/qualified-200-225.jsonl'),
  factoryDir: path.join(ROOT, 'codex-tasks/results'),
  caches: [path.join(SRC, 'build/factory-cache'), path.join(ROOT, 'codex-level-factory/source/build/factory-cache')],
  out: path.join(SRC, 'analysis/builder/process-v1'),
};
const BOT = {
  reference: 'f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561',
  keyMemory: 'd362e85fba3d61523c54bc53a92745458e4467fb4a59624aad1312e9d9003ae3',
  // family-identical predecessors of the reference fingerprint (meter.js FAMILY_CACHE_MIGRATIONS)
  referenceLineage: ['f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561',
    'cae3bc38f7b01e627e288330d5ba0cf210383e39e864ab35976e29faff64f83d',
    'ac24aad82490bab263850596afacb302f2f50b4b73464430c8e95962562808ef',
    '4cf0b4c7057c2242f27fe529bb1885e4ad06cdf94588b79411cc06c522509e39'],
};
const RULES = { cap: 20, censor: 18.5, monoMin: 0.5, monoSE: 2, tnRatio: 1.5, tnAdd: 3, maxN: 19, spares: [1, 2, 3],
  bands: [['<6', 0, 6], ['6-16', 6, 16.0000001], ['>16', 16.0000001, Infinity]], campaignsPerBlock: 40 };

const lazy = {};
const meter = () => lazy.meter || (lazy.meter = require(path.join(SRC, 'tools/factory/meter.js')));
const engine = () => lazy.engine || (lazy.engine = require(path.join(SRC, 'tools/builder/engine.js')));
const hard = () => lazy.hard || (lazy.hard = require(path.join(SRC, 'www/hard.js')));
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const exists = f => { try { return fs.existsSync(f); } catch { return false; } };
const r2 = x => x === null || x === undefined || !Number.isFinite(x) ? x : Math.round(x * 100) / 100;
const r3 = x => x === null || x === undefined || !Number.isFinite(x) ? x : Math.round(x * 1000) / 1000;
const median = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const pct = (k, n) => n ? Math.round(1000 * k / n) / 10 : null;

// ---------- noise models ----------
const geomVar = D => Math.max(0, D * (D - 1));
/* Tries per campaign of a bot that wins each try with probability p, counted the way the meter counts them:
   min(T, cap) (an unwon campaign counts as all its cap tries). Returns the q = 1-p whose capped mean is D. */
function cappedGeom(D, cap = RULES.cap) {
  if (!(D >= 1)) return { q: 0, mean: 1, var: 0, sd: 0 };
  if (D >= cap) return { q: 1, mean: cap, var: 0, sd: 0 };
  const m = q => { let s = 0, t = 1; for (let y = 0; y < cap; y++) { s += t; t *= q; } return s; };   // sum_{y<cap} q^y
  let lo = 0, hi = 1;
  for (let it = 0; it < 100; it++) { const mid = (lo + hi) / 2; if (m(mid) < D) lo = mid; else hi = mid; }
  const q = (lo + hi) / 2;
  let e1 = 0, e2 = 0, t = 1;
  for (let y = 1; y <= cap; y++) { e1 += t; e2 += (2 * y - 1) * t; t *= q; }                       // P(Y >= y) = q^(y-1)
  const v = Math.max(0, e2 - e1 * e1);
  return { q, mean: e1, var: v, sd: Math.sqrt(v) };
}
const pointSE = (D, N) => Math.sqrt(cappedGeom(D).var / N);

// ---------- puzzle identity ----------
function puzzleKey(design) {
  const M = meter();
  const d = { ...design, clock: design.clock ? { i: design.clock.i, n: 0 } : null };
  return M.digest(M.boardOf(d));
}

// ---------- section 3 rules on one curve ----------
/* curve: { [spare]: { D, se } } (se = standard error of D; null = unknown -> model from D and N).
   Returns the verdict for shipping spare s: pass | fail | unknown, and each check. */
function evalSpare(curve, s, rules = RULES) {
  const pt = curve[s]; if (!pt) return null;
  const sp = Object.keys(curve).map(Number).sort((a, b) => a - b);
  const lower = sp.filter(x => x < s), higher = sp.filter(x => x > s);
  const margin = (a, b) => Math.max(rules.monoMin, rules.monoSE * Math.sqrt((a.se || 0) ** 2 + (b.se || 0) ** 2));
  const out = { s, D: pt.D, se: pt.se, checks: {} };
  out.checks.censored = pt.D < rules.censor ? 'pass' : 'fail';
  // monotone: relaxing the clock never makes it harder beyond noise, on the nearest measured spare on each side
  const mono = [];
  if (lower.length) { const a = curve[lower.at(-1)]; mono.push(pt.D <= a.D + margin(a, pt) ? 'pass' : 'fail'); }
  if (higher.length) { const b = curve[higher[0]]; mono.push(b.D <= pt.D + margin(pt, b) ? 'pass' : 'fail'); }
  out.checks.monotone = !mono.length ? 'unknown' : mono.includes('fail') ? 'fail' : 'pass';
  out.checks.monotoneSides = mono.length;
  out.checks.monotoneStrict = (() => {             // the same with the fixed 0.5 margin (strictest reading)
    const m = [];
    if (lower.length) m.push(pt.D <= curve[lower.at(-1)].D + rules.monoMin);
    if (higher.length) m.push(curve[higher[0]].D <= pt.D + rules.monoMin);
    return !m.length ? 'unknown' : m.every(Boolean) ? 'pass' : 'fail';
  })();
  // tighter neighbour: exact at s-1; a farther tighter spare can only prove a pass (D(s-1) <= D(s-k) on a monotone curve)
  const lim = pt.D => Math.min(rules.tnRatio * pt.D, pt.D + rules.tnAdd);
  if (curve[s - 1]) {
    const a = curve[s - 1];
    out.checks.tighter = a.D <= lim(pt) ? 'pass' : 'fail';
    out.tighterD = a.D;
    // borderline: within 2 SE of the limit either way (noise could flip it)
    out.checks.tighterBorderline = Math.abs(a.D - lim(pt)) <= 2 * Math.sqrt((a.se || 0) ** 2 + (pt.se || 0) ** 2);
  } else if (lower.length) {
    const a = curve[lower.at(-1)];
    out.checks.tighter = a.D <= lim(pt) ? 'passBound' : 'unknown';
    out.tighterD = a.D; out.tighterFrom = lower.at(-1);
  } else out.checks.tighter = 'unknown';
  const c = out.checks;
  out.verdict = [c.censored, c.monotone, c.tighter].includes('fail') ? 'fail'
    : c.censored === 'pass' && c.monotone === 'pass' && ['pass', 'passBound'].includes(c.tighter) ? 'pass' : 'unknown';
  out.failedOn = ['censored', 'monotone', 'tighter'].filter(k => c[k] === 'fail');
  return out;
}
const bandOf = (D, rules = RULES) => rules.bands.find(([, lo, hi]) => D >= lo && D < hi)[0];
function evalCurve(curve, rules = RULES) {
  return rules.spares.filter(s => curve[s]).map(s => evalSpare(curve, s, rules));
}

/* Tally spare verdicts by band. items: [{ band, verdict, failedOn }]. */
function tally(items) {
  const t = { n: items.length, pass: 0, fail: 0, unknown: 0, failCensored: 0, failMonotone: 0, failTighter: 0 };
  for (const x of items) {
    t[x.verdict]++;
    for (const f of x.failedOn || []) t['fail' + f[0].toUpperCase() + f.slice(1)]++;
  }
  t.evaluable = t.pass + t.fail;
  t.passShare = pct(t.pass, t.evaluable);
  return t;
}

// ---------- engine (A3 and spare offsets) ----------
const ENGINE_BUDGET = { nodes: 400000, ms: 5000 };
const KCACHE = new Map();
function clockK(design) {
  const key = puzzleKey(design);
  if (KCACHE.has(key)) return KCACHE.get(key);
  const E = engine();
  const t0 = Date.now();
  const p = E.clockShortest(E.game(JSON.parse(JSON.stringify(design))), ENGINE_BUDGET);
  const t1 = Date.now();
  const s = E.clockShortest(E.game(JSON.parse(JSON.stringify(design)), { strict: true }), ENGINE_BUDGET);
  const r = { kPeek: p ? p.k : null, peekUnsure: !!(p && p.unsure), kStrict: s ? s.k : null, msPeek: t1 - t0, msStrict: Date.now() - t1 };
  KCACHE.set(key, r);
  return r;
}
/* A3 on one stored design: the stored witness passes Hard.validSolution, and its clock index + 1 equals the
   game's shortest k (peek pairs allowed). Also: is there a peek-pair shortcut at all (kPeek < kStrict)? */
function a3Check(design) {
  const E = engine(), H = hard();
  const k = clockK(design);
  const d = JSON.parse(JSON.stringify(design));
  const n = d.clock.n, idx = (d.solution || []).indexOf(d.clock.i);
  let valid = false;
  try { valid = !!H.validSolution(E.game(d, { strict: true }), d.solution); } catch { valid = false; }
  const strictReplay = E.replay(JSON.parse(JSON.stringify(design)), design.solution, { strict: true }).ok;
  const peekReplay = E.replay(JSON.parse(JSON.stringify(design)), design.solution);
  const kWitness = idx >= 0 ? idx + 1 : null;
  const known = k.kPeek !== null && k.kStrict !== null;
  const out = { n, kWitness, kPeek: k.kPeek, kStrict: k.kStrict, peekUnsure: k.peekUnsure, valid, strictReplay,
    peekReplay: peekReplay.ok, peekPairsInWitness: peekReplay.pairs || 0, ms: k.msPeek + k.msStrict };
  out.peekShortcut = known ? k.kPeek < k.kStrict : null;
  out.witnessNotShortest = k.kPeek !== null && kWitness !== null ? kWitness > k.kPeek : null;
  out.a3 = known ? valid && kWitness === k.kPeek : null;               // the A3 equality + validSolution
  out.trueSpare = k.kPeek !== null ? n - k.kPeek : null;
  out.tClocksSpare = kWitness !== null ? n - kWitness : null;
  out.a3Full = out.a3 === null ? null : out.a3 && n <= RULES.maxN && out.trueSpare >= 1 && out.trueSpare <= 3;
  return out;
}

// ---------- loaders: every same-puzzle measurement becomes a point ----------
/* point: { source, bot, puzzle, n, D, blocks: [exp per 40-campaign block], design, id, story } */
function ladderPoints(file, bot, boards) {
  if (!exists(file)) return { points: [], note: 'missing ' + file };
  const S = readJson(file), byId = new Map(boards.map(b => [b.id, b]));
  const seen = new Set(), points = [];
  for (const r of S.rows) {
    if (!r.family || !byId.get(r.id)?.design) continue;
    if (seen.has(r.boardKey)) continue;                  // identical physical board from a neighbouring request: once
    seen.add(r.boardKey);
    const d = byId.get(r.id).design;
    points.push({ source: 'ladder', bot, puzzle: puzzleKey(d), n: d.clock.n, D: r.family.exp, blocks: r.family.seeds.slice(),
      design: d, id: r.id, story: r.cell.story, designedSpare: r.cell.spare, boardKey: r.boardKey });
  }
  return { points, note: `${S.rows.length} rows, ${points.length} distinct rated boards` };
}
function knobsV1Points() {
  const B = readJson(P.knobsV1), seen = new Set(), points = [];
  for (const r of B) {
    if (!r.design || !r.family || !r.design.clock) continue;
    const bk = meter().boardKey(r.design); if (seen.has(bk)) continue; seen.add(bk);
    points.push({ source: 'knobs-v1', bot: 'reference', puzzle: puzzleKey(r.design), n: r.design.clock.n, D: r.family.exp,
      blocks: r.family.seeds ? r.family.seeds.slice() : null, design: r.design, id: r.id, story: r.brief?.story, boardKey: bk });
  }
  return { points, note: `${B.length} boards, ${points.length} distinct rated` };
}
function spare1Points() {
  const plan = readJson(P.spare1Plan), sum = readJson(P.spare1Summary), points = [];
  const byId = new Map(sum.profiles.family.pairs.map(p => [p.id, p]));
  for (const b of plan.boards) {
    const p = byId.get(b.id); if (!p || !p.valid) continue;
    for (const [v, D] of [['tight', p.tight], ['loose', p.loose]]) {
      const d = b[v].design;
      points.push({ source: 'clock-spare-1', bot: 'reference', puzzle: puzzleKey(d), n: d.clock.n, D, blocks: [D],
        design: d, id: b.id + ':' + v, story: b.story, boardKey: meter().boardKey(d) });
    }
  }
  return { points, note: `${plan.boards.length} boards x 2 spares, one 40-campaign block each (seed 4711)` };
}
function factoryPoints() {
  if (!exists(P.factoryDir)) return { points: [], pairs: [], note: 'missing ' + P.factoryDir };
  const dirs = fs.readdirSync(P.factoryDir).filter(d => /^200-225/.test(d) && exists(path.join(P.factoryDir, d, 'rated-candidates.json')));
  const byBoard = new Map(); let rows = 0, pairRows = 0;
  for (const dir of dirs) {
    for (const r of readJson(path.join(P.factoryDir, dir, 'rated-candidates.json'))) {
      const m = r.measurement; if (!m?.train?.valid || !r.design?.clock) continue;
      rows++; if (m.validation?.valid) pairRows++;
      const bk = meter().boardKey(r.design);
      if (!byBoard.has(bk)) byBoard.set(bk, { design: r.design, id: r.id, dir, story: (r.recipe || []).join('+'), obs: [] });
      byBoard.get(bk).obs.push([m.train.exp, m.validation?.valid ? m.validation.exp : null, m.bot]);
    }
  }
  const points = [], pairs = [];
  for (const [bk, x] of byBoard) {
    // the same board rated twice comes back from the cache: identical numbers. Keep distinct observations only.
    const uniq = [...new Map(x.obs.map(o => [o[0] + '/' + o[1], o])).values()];
    const withB = uniq.filter(o => o[1] !== null);
    const use = withB.length ? withB : uniq;
    const blocks = use.flatMap(o => o[1] === null ? [o[0]] : [o[0], o[1]]);
    points.push({ source: '200-225', bot: 'reference', puzzle: puzzleKey(x.design), n: x.design.clock.n, D: mean(blocks), blocks,
      design: x.design, id: x.id, story: x.story, boardKey: bk, trainOnly: !withB.length });
    for (const o of withB) pairs.push({ a: o[0], b: o[1], N: RULES.campaignsPerBlock, source: '200-225', bot: 'reference', selected: true });
  }
  return { points, pairs, note: `${dirs.length} folders, ${rows} valid rated rows (${pairRows} two-seed pairs), ${byBoard.size} distinct boards` };
}

/* Build curves: group points by (source, bot, puzzle); a curve needs >= 2 distinct clock.n values. */
function buildCurves(points, opts = {}) {
  const groups = new Map();
  for (const p of points) {
    const g = p.source + '|' + p.bot + '|' + p.puzzle;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const curves = [];
  for (const [g, ps] of groups) {
    const ns = new Set(ps.map(p => p.n));
    if (ns.size < 2) continue;
    const k = opts.kOf ? opts.kOf(ps[0].design) : clockK(ps[0].design);
    if (k.kPeek === null) { curves.push({ group: g, source: ps[0].source, bot: ps[0].bot, fail: 'kUnknown' }); continue; }
    const curve = {};
    for (const n of ns) {
      const at = ps.filter(p => p.n === n), blocks = at.flatMap(p => p.blocks || [p.D]);
      const D = mean(blocks), N = RULES.campaignsPerBlock * blocks.length;
      curve[n - k.kPeek] = { D, se: pointSE(D, N), N, n, id: at[0].id };
    }
    const verdicts = evalCurve(curve);
    curves.push({ group: g, source: ps[0].source, bot: ps[0].bot, puzzle: ps[0].puzzle, story: ps[0].story, k: k.kPeek,
      kStrict: k.kStrict, peekUnsure: k.peekUnsure, curve, verdicts });
  }
  return curves;
}

function summarizeCurves(curves) {
  const ok = curves.filter(c => !c.fail);
  const spareItems = ok.flatMap(c => c.verdicts.map(v => ({ ...v, band: bandOf(v.D), source: c.source, bot: c.bot })));
  const byBand = {};
  for (const [b] of RULES.bands) byBand[b] = tally(spareItems.filter(x => x.band === b));
  // puzzle-level: a puzzle is in a band if one of its evaluable shippable spares has D in it; it "can ship" there if one passes
  const puzzleBand = {};
  for (const [b] of RULES.bands) {
    const ps = ok.filter(c => c.verdicts.some(v => v.verdict !== 'unknown' && bandOf(v.D) === b));
    const can = ps.filter(c => c.verdicts.some(v => v.verdict === 'pass' && bandOf(v.D) === b));
    puzzleBand[b] = { puzzles: ps.length, canShip: can.length, share: pct(can.length, ps.length) };
  }
  const anyEval = ok.filter(c => c.verdicts.some(v => v.verdict !== 'unknown'));
  const anyPass = ok.filter(c => c.verdicts.some(v => v.verdict === 'pass'));
  const tnBorder = spareItems.filter(x => x.checks.tighter === 'fail' && x.checks.tighterBorderline).length;
  const monoStrictFail = spareItems.filter(x => x.checks.monotoneStrict === 'fail').length;
  return { curves: ok.length, kUnknown: curves.length - ok.length, spares: tally(spareItems), byBand, puzzleBand,
    puzzlesAnyEvaluable: anyEval.length, puzzlesAnyPass: anyPass.length, puzzleShare: pct(anyPass.length, anyEval.length),
    tighterFailBorderline: tnBorder, monotoneFailWithFixedHalfMargin: monoStrictFail };
}

// ---------- noise ----------
const NOISE_BINS = [1, 1.5, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20.01];
/* pairs: [{a, b, N}] two independent block means of N campaigns each. Per pair, N(a-b)^2/2 estimates the
   per-campaign variance sigma^2 at D = (a+b)/2. Bin by D; compare sqrt(mean) with sqrt(D(D-1)) and capped geometric. */
function noiseFit(pairs, bins = NOISE_BINS) {
  const rows = [];
  for (let i = 0; i + 1 < bins.length; i++) {
    const lo = bins[i], hi = bins[i + 1];
    const ps = pairs.filter(p => { const D = (p.a + p.b) / 2; return D >= lo && D < hi; });
    if (!ps.length) continue;
    const s2 = mean(ps.map(p => p.N * (p.a - p.b) ** 2 / 2));
    const Ds = ps.map(p => (p.a + p.b) / 2);
    const g = Math.sqrt(mean(Ds.map(geomVar))), c = Math.sqrt(mean(Ds.map(D => cappedGeom(D).var)));
    const sd = Math.sqrt(s2), rel = Math.sqrt(2 / ps.length) / 2;      // approx. relative SE of a SD from n chi2(1) terms
    rows.push({ lo, hi: Math.min(hi, 20), n: ps.length, D: r2(mean(Ds)), sd: r2(sd), geom: r2(g), capped: r2(c),
      ratioGeom: g ? r2(sd / g) : null, ratioCapped: c ? r2(sd / c) : null, sdLo: r2(sd * Math.max(0, 1 - 1.96 * rel)), sdHi: r2(sd * (1 + 1.96 * rel)) });
  }
  return rows;
}
/* One scale c with sigma = c * model(D), least squares on sigma^2, over pairs with D in [lo, hi). */
function noiseScale(pairs, model, lo = 3, hi = 16) {
  const ps = pairs.filter(p => { const D = (p.a + p.b) / 2; return D >= lo && D < hi; });
  const num = mean(ps.map(p => p.N * (p.a - p.b) ** 2 / 2)), den = mean(ps.map(p => model((p.a + p.b) / 2)));
  return { n: ps.length, lo, hi, c: ps.length && den ? r3(Math.sqrt(num / den)) : null };
}
/* Per-campaign cross-check from the rating cache: results[] keeps the 20 campaigns of the first sub-seed.
   D for binning comes from the OTHER seed block (independent of these 20 campaigns). */
function cacheCampaigns(points, fingerprintOf) {
  const M = meter(), out = [];
  for (const p of points) {
    if (!p.blocks || p.blocks.length < 2) continue;
    const fps = fingerprintOf(p);
    for (const [bi, seed] of [[0, 4711], [1, 18427]]) {
      let file = null;
      for (const fp of fps) {
        const key = M.digest({ fingerprint: fp, input: M.boardOf(p.design), settings: { runs: 20, seeds: 2, seed, setting: 'family' } });
        for (const c of P.caches) { const f = path.join(c, key + '.json'); if (exists(f)) { file = f; break; } }
        if (file) break;
      }
      if (!file) continue;
      let j; try { j = readJson(file); } catch { continue; }
      if (!j.valid || !Array.isArray(j.results) || !j.results.length) continue;
      const t = j.results.map(c => c.wonOn ?? c.attempts.length);
      const m = mean(t), v = t.reduce((s, x) => s + (x - m) ** 2, 0) / (t.length - 1);
      out.push({ source: p.source, bot: p.bot, Dother: p.blocks[1 - bi], m, v, n: t.length });
    }
  }
  return out;
}
function campaignFit(rows, bins = NOISE_BINS) {
  const res = [];
  for (let i = 0; i + 1 < bins.length; i++) {
    const lo = bins[i], hi = bins[i + 1], rs = rows.filter(r => r.Dother >= lo && r.Dother < hi);
    if (!rs.length) continue;
    const D = mean(rs.map(r => r.m)), sd = Math.sqrt(mean(rs.map(r => r.v)));
    const g = Math.sqrt(mean(rs.map(r => geomVar(r.m)))), c = Math.sqrt(cappedGeom(D).var);
    res.push({ lo, hi: Math.min(hi, 20), blocks: rs.length, campaigns: rs.reduce((s, r) => s + r.n, 0), D: r2(D), sd: r2(sd), geom: r2(g), capped: r2(c),
      ratioGeom: g ? r2(sd / g) : null, ratioCapped: c ? r2(sd / c) : null });
  }
  return res;
}
/* Common random numbers: on a spare pair measured with the same two seeds, do the seed errors at the two spares
   correlate? r = corr(a1-b1, a2-b2). r > 0 means paired steps are less noisy than unpaired ones. */
function pairingCorrelation(curvePairs) {
  const xs = [], ys = [];
  for (const [p1, p2] of curvePairs) { if (p1.blocks?.length === 2 && p2.blocks?.length === 2) { xs.push(p1.blocks[0] - p1.blocks[1]); ys.push(p2.blocks[0] - p2.blocks[1]); } }
  if (xs.length < 3) return { n: xs.length, r: null };
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return { n: xs.length, r: sxx && syy ? r3(sxy / Math.sqrt(sxx * syy)) : null };
}

// ---------- A3 over populations ----------
function a3Population(name, designs) {
  const rows = [];
  const seen = new Set();
  for (const { id, design, source } of designs) {
    if (!design?.clock || !Array.isArray(design.solution)) continue;
    const bk = meter().boardKey({ ...design });
    const sk = bk + '|' + JSON.stringify(design.solution);
    if (seen.has(sk)) continue; seen.add(sk);
    rows.push({ id, source, ...a3Check(design) });
  }
  const known = rows.filter(r => r.a3 !== null);
  const S = {
    population: name, boards: rows.length, engineUnknown: rows.length - known.length,
    peekUnsure: rows.filter(r => r.peekUnsure).length,
    witnessValid: rows.filter(r => r.valid).length,
    witnessUsesPeekPair: rows.filter(r => r.peekPairsInWitness > 0).length,
    peekShortcut: known.filter(r => r.peekShortcut).length,
    witnessNotShortest: known.filter(r => r.witnessNotShortest).length,
    witnessAboveStrict: known.filter(r => r.kWitness > r.kStrict).length,
    a3Fail: known.filter(r => !r.a3).length,
    a3FailShare: pct(known.filter(r => !r.a3).length, known.length),
    peekShortcutShare: pct(known.filter(r => r.peekShortcut).length, known.length),
    a3FullFail: known.filter(r => !r.a3Full).length,
    medianShortcutMoves: median(known.filter(r => r.peekShortcut).map(r => r.kStrict - r.kPeek)),
    engineMsMedian: median(rows.map(r => r.ms)),
  };
  return { summary: S, rows };
}
// the puzzle (not the stored design) view: puzzles whose shortest clock needs a peek pair
function a3Puzzles(rows) {
  const by = new Map();
  for (const r of rows) if (r.a3 !== null) by.set(r.puzzle, r);
  const ps = [...by.values()];
  return { puzzles: ps.length, peekShortcut: ps.filter(r => r.peekShortcut).length, share: pct(ps.filter(r => r.peekShortcut).length, ps.length) };
}

// ---------- main ----------
function run(opts = {}) {
  const t0 = Date.now(), notes = [];
  const boards = readJson(P.ladderBoards);
  const LR = ladderPoints(P.ladderRef, 'reference', boards); notes.push('ladder reference: ' + LR.note);
  const LK = ladderPoints(P.ladderKm, 'keyMemory', boards); notes.push('ladder key-memory: ' + LK.note);
  const KV = knobsV1Points(); notes.push('knobs-v1: ' + KV.note);
  const S1 = spare1Points(); notes.push('clock-spare-1: ' + S1.note);
  const FP = factoryPoints(); notes.push('200-225: ' + FP.note);
  const all = [...LR.points, ...LK.points, ...KV.points, ...S1.points, ...FP.points];

  // (1) curves
  const curves = buildCurves(all);
  const sources = ['ladder', 'knobs-v1', 'clock-spare-1', '200-225'];
  const part1 = { bySourceBot: {}, byBot: {} };
  for (const src of sources) for (const bot of ['reference', 'keyMemory']) {
    const cs = curves.filter(c => c.source === src && c.bot === bot);
    if (cs.length) part1.bySourceBot[src + ' / ' + bot] = summarizeCurves(cs);
  }
  for (const bot of ['reference', 'keyMemory']) part1.byBot[bot] = summarizeCurves(curves.filter(c => c.bot === bot));
  // the builder's boards without frozen keys (frozenGuards, chainReaction are banned by section 3.5)
  const banned = c => /frozenGuards|chainReaction/.test(c.story || '');
  part1.byBotAllowedStories = {};
  for (const bot of ['reference', 'keyMemory']) part1.byBotAllowedStories[bot] = summarizeCurves(curves.filter(c => c.bot === bot && !banned(c)));
  // same ladder pairs under both bots: do the verdicts agree?
  const lr = new Map(curves.filter(c => c.source === 'ladder' && c.bot === 'reference' && !c.fail).map(c => [c.puzzle, c]));
  const agree = { pairs: 0, same: 0, refOnly: 0, kmOnly: 0, details: [] };
  for (const c of curves.filter(c => c.source === 'ladder' && c.bot === 'keyMemory' && !c.fail)) {
    const r = lr.get(c.puzzle); if (!r) continue;
    for (const v of c.verdicts) {
      const w = r.verdicts.find(x => x.s === v.s); if (!w || v.verdict === 'unknown' || w.verdict === 'unknown') continue;
      agree.pairs++;
      if (v.verdict === w.verdict) agree.same++; else if (w.verdict === 'pass') agree.refOnly++; else agree.kmOnly++;
    }
  }
  part1.botAgreementLadder = agree;
  // the spare step sizes on the spare 1 -> 2 ladder/knobs pairs, for context
  const steps = curves.filter(c => !c.fail && c.curve[1] && c.curve[2]).map(c => ({ src: c.source, bot: c.bot, d1: c.curve[1].D, d2: c.curve[2].D }));
  part1.step12 = {};
  for (const bot of ['reference', 'keyMemory']) {
    const s = steps.filter(x => x.bot === bot);
    part1.step12[bot] = { pairs: s.length, harderBy05: s.filter(x => x.d2 > x.d1 + 0.5).length, medianDelta: r2(median(s.map(x => x.d2 - x.d1))),
      cliffs: s.filter(x => x.d1 > Math.min(1.5 * x.d2, x.d2 + 3)).length };
  }

  // (2) noise
  const pairsOf = pts => pts.filter(p => p.blocks?.length === 2).map(p => ({ a: p.blocks[0], b: p.blocks[1], N: RULES.campaignsPerBlock }));
  const pairSets = {
    'ladder reference (unselected)': pairsOf(LR.points), 'ladder key-memory (unselected)': pairsOf(LK.points),
    'knobs-v1 reference (unselected)': pairsOf(KV.points), '200-225 reference (selected: first seed in 5.5-11.5)': FP.pairs.map(p => ({ ...p })),
  };
  pairSets['all reference'] = [...pairSets['ladder reference (unselected)'], ...pairSets['knobs-v1 reference (unselected)'], ...pairSets['200-225 reference (selected: first seed in 5.5-11.5)']];
  const part2 = { pairs: {}, scale: {}, campaigns: {} };
  for (const [k, ps] of Object.entries(pairSets)) {
    part2.pairs[k] = { n: ps.length, bins: noiseFit(ps) };
    part2.scale[k] = { geom: noiseScale(ps, geomVar), capped: noiseScale(ps, D => cappedGeom(D).var),
      geomMid: noiseScale(ps, geomVar, 6, 16), geomAll: noiseScale(ps, geomVar, 1, 20.01) };
  }
  const camp = cacheCampaigns([...LR.points, ...KV.points, ...LK.points],
    p => p.bot === 'keyMemory' ? [BOT.keyMemory] : BOT.referenceLineage);
  part2.campaigns = { blocks: camp.length, byBot: {} };
  for (const bot of ['reference', 'keyMemory']) {
    const rs = camp.filter(r => r.bot === bot);
    const mid = rs.filter(r => r.Dother >= 3 && r.Dother < 16);
    part2.campaigns.byBot[bot] = { blocks: rs.length, bins: campaignFit(rs),
      scaleMid: mid.length ? r3(Math.sqrt(mean(mid.map(r => r.v)) / mean(mid.map(r => geomVar(r.m))))) : null, midBlocks: mid.length };
  }
  // pairing benefit on spare pairs that share seeds (ladder, knobs-v1)
  const cp = [];
  for (const c of curves.filter(c => !c.fail && ['ladder', 'knobs-v1'].includes(c.source))) {
    const pts = all.filter(p => p.source === c.source && p.bot === c.bot && p.puzzle === c.puzzle);
    const a = pts.find(p => p.n === c.k + 1), b = pts.find(p => p.n === c.k + 2);
    if (a && b) cp.push([a, b]);
  }
  part2.pairingCorrelation = pairingCorrelation(cp);

  // (3) A3
  const pops = [];
  const ladderDesigns = boards.filter(b => b.design).map(b => ({ id: b.id, design: b.design, source: 'ladder' }));
  const qualified = fs.readFileSync(P.qualified, 'utf8').trim().split('\n').map(l => JSON.parse(l)).map(r => ({ id: r.id + '@' + r.level, design: r.design, source: 'qualified' }));
  const knobsDesigns = readJson(P.knobsV1).filter(r => r.design).map(r => ({ id: r.id, design: r.design, source: 'knobs-v1' }));
  const spare1Designs = readJson(P.spare1Plan).boards.flatMap(b => ['tight', 'loose'].map(v => ({ id: b.id + ':' + v, design: b[v].design, source: 'clock-spare-1' })));
  const factoryDesigns = opts.factoryA3 === false ? [] : FP.points.map(p => ({ id: p.id, design: p.design, source: '200-225' }));
  const part3 = { populations: {}, puzzles: {} };
  for (const [name, ds] of [['ladder (builder v3)', ladderDesigns], ['qualified 200-225 (18 kept boards)', qualified],
    ['knobs-v1 (builder v2, Task 10)', knobsDesigns], ['clock-spare-1', spare1Designs], ['200-225 factory candidates (Codex, not the builder)', factoryDesigns]]) {
    if (!ds.length) continue;
    const p = a3Population(name, ds);
    for (const r of p.rows) r.puzzle = puzzleKey(ds.find(d => d.id === r.id).design);
    part3.populations[name] = p.summary;
    part3.puzzles[name] = a3Puzzles(p.rows);
    pops.push(p);
  }
  const builderRows = pops.filter(p => /builder/.test(p.summary.population)).flatMap(p => p.rows);
  part3.builderPooled = { boards: builderRows.length, a3Fail: builderRows.filter(r => r.a3 === false).length,
    a3FailShare: pct(builderRows.filter(r => r.a3 === false).length, builderRows.filter(r => r.a3 !== null).length),
    peekShortcut: builderRows.filter(r => r.peekShortcut).length,
    peekShortcutShare: pct(builderRows.filter(r => r.peekShortcut).length, builderRows.filter(r => r.a3 !== null).length) };
  // the ladder card's "fewestMoves" (builder's k) against the engine now
  const cardK = boards.filter(b => b.design && b.card?.clock?.fewestMoves).map(b => [b.card.clock.fewestMoves, clockK(b.design).kPeek]);
  part3.ladderCardAgreement = { boards: cardK.length, equal: cardK.filter(([a, b]) => a === b).length };
  // the spare the factory's t_clocks would see vs the true spare, on the 200-225 curve groups' designs
  const pick = rows => rows.filter(r => r.a3 === false).slice(0, 12).map(r => ({ id: r.id, n: r.n, kWitness: r.kWitness, kPeek: r.kPeek, kStrict: r.kStrict, valid: r.valid }));
  part3.examples = Object.fromEntries(pops.map(p => [p.summary.population, pick(p.rows)]));

  // kill criteria
  const kill = [];
  {
    const m = part1.byBot.reference.puzzleBand['6-16'], mk = part1.byBot.keyMemory.puzzleBand['6-16'];
    const share = m.share, fired = share !== null && share < 25;
    kill.push({ id: 'K1', rule: 'under 25% of mid-band (D 6-16) puzzles have a spare that could ship -> the dial is a minor trim; library ~2x wider',
      value: `reference ${m.canShip}/${m.puzzles} = ${m.share}%; key-memory ${mk.canShip}/${mk.puzzles} = ${mk.share}%`,
      fired: fired || (mk.share !== null && mk.share < 25) });
  }
  {
    const s = part2.scale['ladder reference (unselected)'].geom.c, s2 = part2.scale['all reference'].geom.c,
      s3 = part2.scale['ladder key-memory (unselected)'].geom.c, cm = part2.campaigns.byBot.reference.scaleMid;
    const vals = [s, s2, cm].filter(x => x !== null);
    kill.push({ id: 'K2', rule: 'per-campaign spread departs from sqrt(D(D-1)) by more than 30% (D 3-16) -> redo the section 2 precision table',
      value: `scale c (sd / sqrt(D(D-1))): ladder ref ${s}, all reference pairs ${s2}, ladder key-memory ${s3}, per-campaign cache ref ${cm}`,
      fired: vals.some(c => Math.abs(c - 1) > 0.3) });
  }
  {
    const b = part3.builderPooled;
    kill.push({ id: 'K3', rule: 'more than 20% of boards fail A3 -> the peek-pair decision moves to the top of Dennis\'s list',
      value: `builder boards ${b.a3Fail}/${b.boards} = ${b.a3FailShare}% fail A3; peek-pair shortcut ${b.peekShortcut} = ${b.peekShortcutShare}%; qualified ${part3.populations['qualified 200-225 (18 kept boards)']?.a3Fail}/18`,
      fired: b.a3FailShare !== null && b.a3FailShare > 20 });
  }

  const compactCurves = curves.filter(c => !c.fail).map(c => ({ source: c.source, bot: c.bot, story: c.story, k: c.k, kStrict: c.kStrict,
    curve: Object.fromEntries(Object.entries(c.curve).map(([s, p]) => [s, { D: r2(p.D), se: r2(p.se), n: p.n }])),
    verdicts: c.verdicts.map(v => ({ s: v.s, D: r2(v.D), verdict: v.verdict, failedOn: v.failedOn, tighter: v.checks.tighter, monotone: v.checks.monotone })) }));
  return {
    schema: 'e1-dial-audit-v1', created: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000),
    rules: RULES, bots: BOT, inputs: P, notes, part1, part2, part3, kill, curves: compactCurves,
    a3Rows: pops.flatMap(p => p.rows.map(r => ({ pop: p.summary.population, id: r.id, n: r.n, kWitness: r.kWitness, kPeek: r.kPeek, kStrict: r.kStrict,
      valid: r.valid, peekPairsInWitness: r.peekPairsInWitness, a3: r.a3 }))),
  };
}

// ---------- report ----------
function md(R) {
  const L = [], t = (h, rows) => { L.push('| ' + h.join(' | ') + ' |', '|' + h.map(() => '---').join('|') + '|'); for (const r of rows) L.push('| ' + r.join(' | ') + ' |'); L.push(''); };
  L.push('# E1 dial audit on existing data', '');
  L.push(`Generated by \`source/tools/builder/loop/research/e1_dial_audit.js\` on ${R.created.slice(0, 10)} in ${R.seconds} s. No bot was run; only stored ratings and the engine (clockShortest, replay, Hard.validSolution). Numbers below come from \`e1-dial-audit.json\` next to this file.`, '');
  L.push('Sources:', ''); for (const n of R.notes) L.push('- ' + n); L.push('');
  L.push('Definitions: a *puzzle* is the board content without clock.n. *Spare* s = clock.n - k with k = `engine.clockShortest` (peek pairs allowed, the game\'s rules). D of a point = mean of its 40-campaign blocks; SE from the capped geometric variance at D. A spare s in {1,2,3} *passes* when D(s) < 18.5, the nearest measured spare on each side is monotone within max(0.5, 2 SE of the difference), and the tighter neighbour D(s-1) <= min(1.5 D(s), D(s)+3). If s-1 is not measured but a tighter spare is and already satisfies the limit, that counts as a pass (bound); otherwise the spare is *unknown*. Bands are by D at the spare being shipped.', '');
  L.push('## Kill criteria', '');
  t(['', 'rule', 'measured', 'fired?'], R.kill.map(k => [k.id, k.rule, k.value, k.fired ? '**FIRED**' : 'no']));
  L.push('## 1 Can a spare ship?', '');
  const P1 = R.part1;
  const row = (name, s) => [name, s.curves, `${s.spares.pass}/${s.spares.evaluable} (${s.spares.passShare}%)`, s.spares.unknown,
    ...['<6', '6-16', '>16'].map(b => `${s.byBand[b].pass}/${s.byBand[b].evaluable}${s.byBand[b].evaluable ? ' (' + s.byBand[b].passShare + '%)' : ''}`),
    `${s.puzzleBand['6-16'].canShip}/${s.puzzleBand['6-16'].puzzles}${s.puzzleBand['6-16'].puzzles ? ' (' + s.puzzleBand['6-16'].share + '%)' : ''}`,
    `${s.spares.failCensored}/${s.spares.failMonotone}/${s.spares.failTighter}`];
  const H = ['data / bot', 'curves', 'spares pass', 'unknown', 'pass D<6', 'pass D 6-16', 'pass D>16', 'mid-band puzzles that can ship', 'fails: censored/monotone/tighter'];
  t(H, Object.entries(P1.bySourceBot).map(([k, s]) => row(k, s)));
  L.push('Pooled by bot (all sources):', '');
  t(H, [row('reference (all)', P1.byBot.reference), row('key-memory (ladder only)', P1.byBot.keyMemory),
    row('reference, stories without frozen keys', P1.byBotAllowedStories.reference), row('key-memory, stories without frozen keys', P1.byBotAllowedStories.keyMemory)]);
  L.push(`Tighter-neighbour fails that sit within 2 SE of the limit (could flip with more campaigns): reference ${P1.byBot.reference.tighterFailBorderline} of ${P1.byBot.reference.spares.failTighter}; key-memory ${P1.byBot.keyMemory.tighterFailBorderline} of ${P1.byBot.keyMemory.spares.failTighter}. Monotone fails with the fixed 0.5 margin instead of the noise margin: reference ${P1.byBot.reference.monotoneFailWithFixedHalfMargin}, key-memory ${P1.byBot.keyMemory.monotoneFailWithFixedHalfMargin}.`, '');
  L.push(`Spare 1 -> 2 steps: reference ${P1.step12.reference.pairs} pairs, ${P1.step12.reference.harderBy05} harder by more than 0.5, median change ${P1.step12.reference.medianDelta}, ${P1.step12.reference.cliffs} cliffs (D(1) above the tighter-neighbour limit of D(2)); key-memory ${P1.step12.keyMemory.pairs} pairs, ${P1.step12.keyMemory.harderBy05} harder, median ${P1.step12.keyMemory.medianDelta}, ${P1.step12.keyMemory.cliffs} cliffs.`, '');
  const ag = P1.botAgreementLadder;
  L.push(`Same ladder pairs under both bots: ${ag.same} of ${ag.pairs} evaluable spare verdicts agree; ${ag.refOnly} pass only under the reference bot, ${ag.kmOnly} only under key memory.`, '');
  L.push('## 2 Noise model', '');
  L.push('Per pair of independent 40-campaign blocks a, b: sigma^2 estimate = 40 (a-b)^2 / 2, at D = (a+b)/2. "capped" is the geometric with the 20-try cap the meter applies. Ratios near 1 mean the model is right.', '');
  for (const [k, v] of Object.entries(R.part2.pairs)) {
    const sc = R.part2.scale[k];
    L.push(`**${k}**: ${v.n} pairs. Scale c = sd / model over D 3-16: sqrt(D(D-1)) ${sc.geom.c} (n ${sc.geom.n}), capped ${sc.capped.c}; over D 6-16: ${sc.geomMid.c} (n ${sc.geomMid.n}).`, '');
    t(['D bin', 'pairs', 'mean D', 'sd per campaign (95%)', 'sqrt(D(D-1))', 'capped geom', 'ratio geom', 'ratio capped'],
      v.bins.map(b => [`${b.lo}-${b.hi}`, b.n, b.D, `${b.sd} (${b.sdLo}-${b.sdHi})`, b.geom, b.capped, b.ratioGeom, b.ratioCapped]));
  }
  L.push('Cross-check from the per-campaign results[] kept in the rating cache (20 campaigns per block, binned by the other seed block\'s D so the bin is independent of the spread):', '');
  for (const [bot, v] of Object.entries(R.part2.campaigns.byBot)) {
    if (!v.blocks) { L.push(`- ${bot}: no cache entries found.`, ''); continue; }
    L.push(`**${bot}**: ${v.blocks} blocks; scale over D 3-16 = ${v.scaleMid} (${v.midBlocks} blocks).`, '');
    t(['D bin', 'blocks', 'campaigns', 'mean D', 'sd', 'sqrt(D(D-1))', 'capped', 'ratio geom', 'ratio capped'],
      v.bins.map(b => [`${b.lo}-${b.hi}`, b.blocks, b.campaigns, b.D, b.sd, b.geom, b.capped, b.ratioGeom, b.ratioCapped]));
  }
  L.push(`Pairing (common random numbers) on spare pairs measured with the same seeds: correlation of the seed gap at spare 1 and at spare 2 r = ${R.part2.pairingCorrelation.r} (n ${R.part2.pairingCorrelation.n}). The variance of a paired step is (1 - r) times the unpaired one when both spares have the same spread.`, '');
  L.push('## 3 A3: peek-pair shortcut', '');
  L.push('k peek = engine.clockShortest (the game\'s rules); k strict = the same without peek pairs (lab/exact.js); k witness = stored solution clock index + 1 (what t_clocks uses). A3 passes when Hard.validSolution accepts the stored witness and k witness = k peek.', '');
  t(['population', 'boards', 'engine unknown', 'witness valid', 'peek-pair shortcut (k peek < k strict)', 'witness slower than k peek', 'A3 fail', 'also needs n <= 19 and s in 1-3', 'median shortcut (moves)', 'engine ms (median)'],
    Object.values(R.part3.populations).map(s => [s.population, s.boards, s.engineUnknown, s.witnessValid, `${s.peekShortcut} (${s.peekShortcutShare}%)`, s.witnessNotShortest, `${s.a3Fail} (${s.a3FailShare}%)`, s.a3FullFail, s.medianShortcutMoves, s.engineMsMedian]));
  L.push('By puzzle (one row per puzzle; a puzzle with several clock.n counted once):', '');
  t(['population', 'puzzles', 'peek-pair shortcut'], Object.entries(R.part3.puzzles).map(([k, v]) => [k, v.puzzles, `${v.peekShortcut} (${v.share}%)`]));
  L.push(`Builder boards pooled (ladder, knobs-v1): ${R.part3.builderPooled.a3Fail} of ${R.part3.builderPooled.boards} fail A3 (${R.part3.builderPooled.a3FailShare}%); peek-pair shortcut on ${R.part3.builderPooled.peekShortcut} (${R.part3.builderPooled.peekShortcutShare}%). Ladder card fewestMoves equals the engine's k on ${R.part3.ladderCardAgreement.equal} of ${R.part3.ladderCardAgreement.boards}.`, '');
  return L.join('\n');
}

module.exports = { cappedGeom, geomVar, pointSE, puzzleKey, evalSpare, evalCurve, bandOf, tally, a3Check, clockK, noiseFit, noiseScale,
  campaignFit, pairingCorrelation, buildCurves, summarizeCurves, run, md, RULES, BOT, P };

if (require.main === module) {
  const args = process.argv.slice(2), outI = args.indexOf('--out');
  const out = outI >= 0 ? path.resolve(args[outI + 1]) : P.out;
  const R = run({ factoryA3: !args.includes('--no-factory-a3') });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'e1-dial-audit.json'), JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(out, 'e1-dial-audit.md'), md(R) + '\n');
  console.log(R.kill.map(k => `${k.id} ${k.fired ? 'FIRED' : 'not fired'}: ${k.value}`).join('\n'));
  console.log(`wrote ${out} in ${R.seconds} s`);
}
