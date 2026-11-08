#!/usr/bin/env node
'use strict';
// Assign (puzzle, spare) pairs to a level range (process-design-synthesis.md section 5 and section 6 step 9).
//
//   const A = require('./assign_levels.js');
//   A.assign(pairs, { from: 250, to: 275 })
//     -> { levels, unfillable, windows, totalCost, proven, nodes, holes, text }
//
// Minimises sum |log D - log target| by depth-first branch-and-bound in level order (candidates cheapest first,
// lower bound = the cheapest per-level cost of every level still open). Constraints:
//   trend       approved 250-275 curve, then +3 tries per 25 levels; no per-position modifiers
//   level       |D - target| <= 1
//   spike cap   D <= T + 1
//   big boards  > 88 tiles only on lv%10 == 0
//   clock       opening clock (k <= 6): spare >= 2
//   spare 1     at most 1 in any 5 consecutive levels, never two in a row
//   story       no story twice in any 3 consecutive levels
//   window      every 5 consecutive levels: |mean(D - target)| <= 0.5
//   skilled     trusted S in [2.5, 6] per level; explicit fallback may lower the minimum to 2
//   B7          a pair whose ratings are inflated by repeated losing moves (maxTarget) only on targets <= maxTarget
//   unique      each puzzle at most once (and never one listed in `exclude`)
// A level no pair can fill is reported plainly ('noCandidate' with the reasons the pairs failed). When pairs exist
// but every combination breaks a rule between levels, the search leaves a hole ('conflict') at a cost of
// holePenalty; a hole counts as on target (D - target = 0, S = floor) in the window checks around it.
// Levels before `from` can be given as context ({ level, D, spare, story, S?, target? }) so the rules between levels
// see the levels already shipped.

const Policy = require('./policy.js');
const DEFAULTS = Object.freeze({
  trend: Policy.TREND,
  tolerance: { abs: 1, rel: 0 },
  spike: { abs: 1, rel: 0 },
  window: { size: 5, abs: 0.5, rel: 0 },
  bigBoardTiles: 88,
  openingClockMinSpare: 2,
  spare1: { window: 5, max: 1 },
  storyWindow: 3,
  archetypeWindow: 0,   // 0 = off; k = no archetype label twice in any k consecutive levels
  skilled: Policy.SKILLED,
  holePenalty: 10,
  maxNodes: 2e6,
});

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v;
  return out;
}
const trendAt = (L, t) => t.points ? Policy.familyTarget(L) : Math.min(t.cap ?? Infinity, t.T0 * Math.pow(t.g, L - t.L0));

// The slot of level L for one pair: its target and shape.
function slotFor(L, pair, o) {
  const T = trendAt(L, o.trend);
  return { T, target: T, shape: 'trend' };
}
const levelTol = (target, o) => Math.max(o.tolerance.abs, o.tolerance.rel * target);

// First reason a pair cannot fill level L on its own (null = it can).
function levelCheck(L, pair, o) {
  const s = slotFor(L, pair, o), pos = ((L % 10) + 10) % 10;
  const big = pair.bigBoard ?? (pair.tiles > o.bigBoardTiles);
  if (big && pos !== 0) return { why: 'bigBoardOffSlot', s };
  if (pair.maxTarget != null && s.target > pair.maxTarget) return { why: 'b7Inflated', s };
  if (pair.openingClock && pair.spare < o.openingClockMinSpare) return { why: 'openingClock', s };
  if (!(pair.Strusted && pair.S != null && pair.S >= o.skilled.lo)) return { why: pair.S == null || !pair.Strusted ? 'skilledUnknown' : 'skilledLow', s };
  if (pair.S != null && pair.Strusted && pair.S > Policy.SKILLED.hi) return { why: 'skilledHigh', s };
  if (!(pair.D > 0)) return { why: 'noD', s };
  if (Math.abs(pair.D - s.target) > levelTol(s.T, o)) return { why: pair.D > s.target ? 'tooHard' : 'tooEasy', s };
  if (pair.D > s.T + Math.max(o.spike.abs, o.spike.rel * s.T)) return { why: 'spike', s };
  return { why: null, s };
}

function assign(pairsIn, opts = {}) {
  const o = merge(DEFAULTS, opts);
  if (opts.trend) o.trend = opts.trend;
  Policy.assertSkilledOptions(o.skilled);
  if (opts.shape != null) throw Error('Difficulty dips and peaks are not supported');
  if (o.tolerance.abs > 1 || o.tolerance.rel !== 0 || o.window.abs > 0.5 || o.window.rel !== 0) throw Error('Tolerance is at most 1 per level and 0.5 per five levels');
  const from = opts.from, to = opts.to;
  if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) throw Error('assign needs integer from <= to');
  const exclude = new Set(opts.exclude || []);
  const notExcluded = pairsIn.filter(p => !exclude.has(p.key));
  // dropCurve: leave out pairs whose D is only a CURVE estimate (not an ACCEPT value of record); counted in the result
  const curveDropped = opts.dropCurve ? notExcluded.filter(p => p.Dsource === 'CURVE').length : 0;
  const pairs = opts.dropCurve ? notExcluded.filter(p => p.Dsource !== 'CURVE') : notExcluded;
  const levels = []; for (let L = from; L <= to; L++) levels.push(L);
  for (let i = 0; i < levels.length; i++) {
    const T = trendAt(levels[i], o.trend);
    if (!Number.isFinite(T) || T <= 0 || (i && T < trendAt(levels[i - 1], o.trend))) throw Error('Family curve must be finite, positive and nondecreasing');
  }
  const nL = levels.length;

  // ---- per-level candidates and why the others fail ----
  const cand = levels.map(L => {
    const ok = [], why = {}, near = [];
    for (const p of pairs) {
      const c = levelCheck(L, p, o);
      if (c.why) {
        why[c.why] = (why[c.why] || 0) + 1;
        if (c.why === 'tooHard' || c.why === 'tooEasy' || c.why === 'spike') near.push({ key: p.key, spare: p.spare, D: p.D, target: c.s.target, why: c.why, gap: Math.abs(Math.log(p.D / c.s.target)) });
        continue;
      }
      ok.push({ p, s: c.s, cost: Math.abs(Math.log(p.D / c.s.target)), dev: p.D - c.s.target, Sw: p.Strusted && p.S != null ? p.S : 0 });
    }
    ok.sort((a, b) => a.cost - b.cost || (a.p.key < b.p.key ? -1 : a.p.key > b.p.key ? 1 : a.p.spare - b.p.spare));
    near.sort((a, b) => a.gap - b.gap);
    return { L, ok, why, near: near.slice(0, 3) };
  });
  const allowHoles = opts.allowHoles !== false;
  const minCost = cand.map(c => c.ok.length ? c.ok[0].cost : (allowHoles ? o.holePenalty : Infinity));
  const lbSuffix = new Array(nL + 1).fill(0);
  for (let i = nL - 1; i >= 0; i--) lbSuffix[i] = lbSuffix[i + 1] + Math.min(minCost[i], allowHoles ? o.holePenalty : Infinity);
  const devMin = cand.map(c => Math.min(...c.ok.map(x => x.dev), allowHoles || !c.ok.length ? 0 : Infinity));
  const devMax = cand.map(c => Math.max(...c.ok.map(x => x.dev), allowHoles || !c.ok.length ? 0 : -Infinity));

  // ---- the timeline: context levels before `from`, then the range ----
  const ctx = (opts.context || []).filter(c => c.level < from).sort((a, b) => a.level - b.level);
  const ctxBy = new Map(ctx.map(c => [c.level, c]));
  const first = ctx.length ? Math.min(ctx[0].level, from) : from;
  // seq[j] for level first + j: { known: true, dev, spare, story, archetype, S } once fixed
  const seq = [];
  for (let L = first; L < from; L++) {
    const c = ctxBy.get(L);
    if (!c) { seq.push(null); continue; }   // a gap in the context: rules that need this level are skipped
    const T = c.target ?? (o.trend.points && L < 250 ? c.D : trendAt(L, o.trend)), target = c.target ?? T;
    seq.push({ fixed: true, dev: c.D - target, spare: c.spare, story: c.story ?? null, archetype: c.archetype ?? null, S: c.S ?? null, T });
  }
  const off = seq.length;   // index of `from` in seq
  for (let i = 0; i < nL; i++) seq.push(undefined);   // undefined = not yet assigned
  const Tof = j => seq[j]?.T ?? trendAt(first + j, o.trend);
  const W = o.window.size;

  // rules between levels at position j (in seq): null = fine, else the rule that breaks. Positions not yet assigned
  // (undefined) are ignored, so the same checks serve the search and the final diagnosis of holes.
  const real = y => y && !y.hole;
  function pairRuleWhy(j) {
    const x = seq[j];
    if (!real(x)) return null;
    if (x.spare === 1) {
      if ((real(seq[j - 1]) && seq[j - 1].spare === 1) || (real(seq[j + 1]) && seq[j + 1].spare === 1)) return 'spare1';
      for (let a = j - o.spare1.window + 1; a <= j; a++) {
        let n = 0;
        for (let b = Math.max(0, a); b < a + o.spare1.window && b < seq.length; b++) if (real(seq[b]) && seq[b].spare === 1) n++;
        if (n > o.spare1.max) return 'spare1';
      }
    }
    if (x.story != null) for (let b = j - o.storyWindow + 1; b < j + o.storyWindow; b++) if (b !== j && b >= 0 && real(seq[b]) && seq[b].story === x.story) return 'story';
    if (o.archetypeWindow > 0 && x.archetype != null) for (let b = j - o.archetypeWindow + 1; b < j + o.archetypeWindow; b++) if (b !== j && b >= 0 && real(seq[b]) && seq[b].archetype === x.archetype) return 'archetype';
    return null;
  }
  // window rules for every window containing j; positions not yet assigned use their best/worst bounds
  function windowWhy(j) {
    for (let a = j - W + 1; a <= j; a++) {
      if (a < 0 || a + W > seq.length) continue;
      let lo = 0, hi = 0, Tsum = 0, skip = false;
      for (let b = a; b < a + W; b++) {
        const y = seq[b];
        Tsum += Tof(b);
        if (y === null) { skip = true; break; }
        if (y === undefined) { lo += devMin[b - off]; hi += devMax[b - off]; }
        else { lo += y.dev; hi += y.dev; }
      }
      if (skip) continue;
      const tol = Math.max(o.window.abs, o.window.rel * Tsum / W) * W;
      if (lo > tol + 1e-9 || hi < -tol - 1e-9) return 'window';
    }
    return null;
  }
  const slotOf = c => ({ dev: c.dev, spare: c.p.spare, story: c.p.story ?? null, archetype: c.p.archetype ?? null, Sw: c.Sw });
  const HOLE = Object.freeze({ hole: true, dev: 0, Sw: o.skilled.lo });
  // the context itself may already break a window; never blame the search for that
  const used = new Set();
  let best = null, bestCost = Infinity, nodes = 0, budgetHit = false;
  const chosen = new Array(nL);
  function dfs(i, cost) {
    if (++nodes > o.maxNodes) { budgetHit = true; return; }
    if (i === nL) { if (cost < bestCost - 1e-12) { bestCost = cost; best = chosen.slice(); } return; }
    if (cost + lbSuffix[i] >= bestCost - 1e-12) return;
    const j = off + i;
    for (const c of cand[i].ok) {
      if (budgetHit) return;
      if (cost + c.cost + lbSuffix[i + 1] >= bestCost - 1e-12) break;   // sorted by cost: nothing cheaper follows
      if (used.has(c.p.key)) continue;
      seq[j] = slotOf(c);
      if (!pairRuleWhy(j) && !windowWhy(j)) { used.add(c.p.key); chosen[i] = c; dfs(i + 1, cost + c.cost); used.delete(c.p.key); }
      seq[j] = undefined;
    }
    if (allowHoles && !budgetHit) {
      seq[j] = HOLE;
      if (!windowWhy(j)) { chosen[i] = null; dfs(i + 1, cost + o.holePenalty); }
      seq[j] = undefined;
    }
  }
  dfs(0, 0);

  // ---- report ----
  const outLevels = [], unfillable = [];
  // why each candidate of a hole does not fit, given the final levels around it
  const diagnose = i => {
    const j = off + i, usedKeys = new Set(best.filter(Boolean).map(c => c.p.key)), why = {};
    for (const c of cand[i].ok) {
      let w = usedKeys.has(c.p.key) ? 'puzzleUsed' : null;
      if (!w) { seq[j] = slotOf(c); w = pairRuleWhy(j) || windowWhy(j) || 'searchBudget'; seq[j] = HOLE; }
      why[w] = (why[w] || 0) + 1;
    }
    return why;
  };
  if (best) best.forEach((c, i) => { seq[off + i] = c ? slotOf(c) : HOLE; });
  if (best) {
    best.forEach((c, i) => {
      const L = levels[i];
      if (!c) {
        const T = trendAt(L, o.trend);
        const conflicts = cand[i].ok.length ? diagnose(i) : null;
        const u = cand[i].ok.length
          ? { level: L, reason: 'conflict', T: round(T), candidates: cand[i].ok.length, conflicts,
              text: `Level ${L} (trend ${round(T)}): ${cand[i].ok.length} pair(s) fit the level on their own, but none fits with the levels around it: ` +
                Object.entries(conflicts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${CONFLICT_TEXT[k] || k}`).join(', ') + '.' }
          : { level: L, reason: 'noCandidate', T: round(T), failures: cand[i].why, nearest: cand[i].near.map(n => ({ ...n, D: round(n.D), target: round(n.target), gap: round(n.gap) })),
              text: `Level ${L} (trend ${round(T)}): no pair in the library fits. ` + describeWhy(cand[i].why) };
        unfillable.push(u);
        outLevels.push({ level: L, T: round(T), hole: true, reason: u.reason });
        return;
      }
      outLevels.push({ level: L, T: round(c.s.T), target: round(c.s.target), shape: c.s.shape, key: c.p.key, spare: c.p.spare, D: round(c.p.D), Dsource: c.p.Dsource ?? null,
        dev: round(c.dev), cost: round(c.cost, 4), S: c.p.S ?? null, skilledFallback: c.p.S < Policy.SKILLED.lo, Strusted: !!c.p.Strusted, story: c.p.story ?? null, tiles: c.p.tiles ?? null, archetype: c.p.archetype ?? null, card: c.p.card ?? null });
    });
  } else {
    for (let i = 0; i < nL; i++) unfillable.push({ level: levels[i], reason: cand[i].ok.length ? 'conflict' : 'noCandidate', failures: cand[i].why });
  }
  // windows over the final sequence (holes count as on target)
  const windows = [];
  if (best) {
    for (let a = Math.max(0, off - W + 1); a + W <= seq.length; a++) {
      let s = 0, Ts = 0, holes = 0, gap = false;
      for (let b = a; b < a + W; b++) { const y = seq[b]; if (!y) { gap = true; break; } s += y.dev; Ts += Tof(b); if (y.hole) holes++; }
      if (gap) continue;
      const tol = Math.max(o.window.abs, o.window.rel * Ts / W);
      windows.push({ from: first + a, to: first + a + W - 1, meanDev: round(s / W), tol: round(tol), ok: Math.abs(s / W) <= tol + 1e-9, holes });
    }
  }
  const holes = unfillable.length;
  const res = {
    range: [from, to], params: { trend: o.trend, tolerance: o.tolerance, spike: o.spike, window: o.window, spare1: o.spare1, storyWindow: o.storyWindow,
      archetypeWindow: o.archetypeWindow, skilled: o.skilled, bigBoardTiles: o.bigBoardTiles, openingClockMinSpare: o.openingClockMinSpare, holePenalty: o.holePenalty },
    pairs: pairs.length, puzzles: new Set(pairs.map(p => p.key)).size, excluded: pairsIn.length - pairs.length,
    levels: outLevels, curveDropped, curveFilled: outLevels.filter(l => l.Dsource === "CURVE").length, unfillable, windows, holes,
    totalCost: best ? round(bestCost - holes * o.holePenalty, 4) : null,
    proven: !!best && !budgetHit, nodes, budgetHit,
  };
  res.text = reportText(res);
  return res;
}

const round = (x, k = 2) => x == null || !Number.isFinite(x) ? x ?? null : Math.round(x * 10 ** k) / 10 ** k;
const WHY_TEXT = { tooHard: 'too hard for the target', tooEasy: 'too easy for the target', spike: 'above the spike cap', bigBoardOffSlot: 'a big board off a lv%10==0 slot',
  openingClock: 'fast opening clock at spare 1', skilledUnknown: 'no trusted skilled rating', skilledLow: 'skilled rating under the floor', skilledHigh: 'skilled rating over 6',
  b7Inflated: 'rating inflated by repeated losing moves (B7), target too high', noD: 'no family rating' };
const CONFLICT_TEXT = { puzzleUsed: 'use a puzzle already placed on another level', spare1: 'break the spare-1 rationing', story: 'repeat a story within 3 levels',
  archetype: 'repeat an archetype too soon', window: 'push a 5-level window mean out of its band',
  searchBudget: 'were not reached before the search budget ran out' };
function describeWhy(why) {
  const parts = Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${WHY_TEXT[k] || k}`);
  return parts.length ? 'Pairs failed as: ' + parts.join(', ') + '.' : 'The library has no pairs.';
}
function reportText(r) {
  const lines = [];
  const filled = r.levels.filter(l => !l.hole).length;
  lines.push(`Levels ${r.range[0]}-${r.range[1]}: ${filled} of ${r.levels.length || (r.range[1] - r.range[0] + 1)} filled from ${r.puzzles} puzzles (${r.pairs} puzzle-spare pairs).`);
  if (r.curveDropped) lines.push(`${r.curveDropped} pairs with only a CURVE difficulty were left out (not values of record).`);
  if (r.curveFilled) lines.push(`${r.curveFilled} levels are filled from CURVE values (provisional).`);
  const fallback = r.levels.filter(l => l.skilledFallback);
  if (fallback.length) lines.push(`Skilled fallback below 2.5 used on ${fallback.map(l => l.level).join(', ')}; minimum allowed ${r.params.skilled.lo}.`);
  lines.push(r.proven ? 'The assignment is the cheapest the rules allow (search finished).' : r.budgetHit ? `The search stopped at its node budget (${r.nodes} nodes): the result is valid but may not be the cheapest.` : 'No assignment found.');
  for (const l of r.levels) {
    if (l.hole) continue;
    lines.push(`  ${l.level}: ${l.shape}, target ${l.target} (trend ${l.T}); puzzle ${l.key.slice(0, 10)} spare ${l.spare}, D ${l.D}${l.Dsource && l.Dsource !== 'ACCEPT' ? ' (' + l.Dsource + ', not yet a value of record)' : ''}, S ${l.S != null ? round(l.S) : '?'}${l.Strusted ? '' : ' (untrusted)'}, story ${l.story}`);
  }
  if (r.unfillable.length) {
    lines.push(`Unfillable (${r.unfillable.length}):`);
    for (const u of r.unfillable) lines.push('  ' + (u.text || `Level ${u.level}: ${u.reason}`));
  }
  const bad = r.windows.filter(w => !w.ok);
  if (bad.length) lines.push(`Windows outside the band: ${bad.map(w => `${w.from}-${w.to} (${w.meanDev} vs +-${w.tol})`).join(', ')} (windows that start in the context can break before this range).`);
  return lines.join('\n');
}

// ---------- CLI ----------
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    a[k.slice(2)] = v;
  }
  return a;
}
function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.from || !a.to) {
    console.error('usage: assign_levels.js --from 250 --to 275 [--lib dir] [--skilled-min 2 (fallback only)]\n' +
      '         [--context levels.json] [--measured accept.json] [--gate-profile e5-v1|strict-v1] [--exclude keys.json] [--family <fingerprint>] [--allow-curve (use CURVE D values; default drops them)] [--nodes 2000000] [--out plan.json]');
    process.exit(64);
  }
  const fs = require('fs'), Lb = require('./library.js');
  const lib = Lb.createLibrary({ dir: a.lib });
  const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const measurements = a.measured ? read(a.measured) : undefined;
  const { pairs, skipped } = Lb.pairsOf(lib.entries(), { measured: measurements?.measured ?? measurements,
    family: a.family || require('./yardstick.js').loadPins().family.fingerprint,
    gateProfile: require('./gate_profile.js').loadProfile(a['gate-profile'] || 'e5-v1').fingerprint, withSkipped: true });
  const res = assign(pairs, {
    from: +a.from, to: +a.to,
    trend: a.T0 != null ? { T0: +a.T0, L0: +(a.L0 ?? a.from), g: +(a.g ?? 1), cap: +(a.cap ?? Infinity) } : DEFAULTS.trend,
    skilled: { floor: a.skilled || 'hard', lo: +(a['skilled-min'] ?? Policy.SKILLED.lo) },
    context: a.context ? read(a.context) : [], exclude: a.exclude ? read(a.exclude) : [],
    maxNodes: a.nodes ? +a.nodes : undefined, dropCurve: !a['allow-curve'],
  });
  res.librarySkipped = skipped; res.libraryDamagedLines = lib.damaged.length;
  res.context = a.context ? read(a.context) : [];
  if (a.out) fs.writeFileSync(a.out, JSON.stringify(res, null, 1));
  console.log(res.text);
  if (skipped.otherRuler) console.log(`(${skipped.otherRuler} library entries rated with another family ruler were left out.)`);
  if (skipped.otherGateProfile) console.log(`(${skipped.otherGateProfile} library entries with missing or different gate profiles were left out.)`);
}
if (require.main === module) main();

module.exports = { assign, slotFor, levelCheck, trendAt, levelTol, DEFAULTS, reportText };
