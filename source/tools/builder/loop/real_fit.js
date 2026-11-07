#!/usr/bin/env node
/* Real-data estimator and power simulation (Claude, 2026-11-07; process design section 2 "real_fit", experiment E2).
   Plain node, no python. Model, per try of player i on level l (which sits in window W(l)):

       logit P(win) = skill[i] - window[W(l)] - level[l] - u[i,l]

     - window effects: a random walk over consecutive windows, step ~ N(0, tau^2), the first window fixed at 0
       (so skill is "skill in the first window"); a positive step means the next window is harder;
     - level effects: shared by all players, shrunk towards 0 (sd sdLevel);
     - u[i,l]: one effect per player and level (sd sdSeq), for levels that are hard for one player only.
       sdLevel and sdSeq are chosen together by the Laplace evidence on a 2-D grid (chooseSds);
     - no player-skill drift (learning): a drift shared by the family is confounded with the window walk, so this
       data cannot separate it from a change in difficulty;
     - exact censoring: a level not won yet only contributes its lost tries; tries after the 12th are dropped
       (a run still unwon at 12 is censored there: the rage cut).
   Fitted by Newton's method on the posterior mode, with the per-sequence effects eliminated by their Schur
   complement (each touches one player, window and level), so a fit of ~300 sequences takes milliseconds.
   Standard errors are the Laplace ones (inverse Hessian of the fixed block).

   Power simulation (E2): fitted skills, flat windows plus one planted step of +delta logit at one window
   boundary, level and player-level effects drawn at the fitted sds, and the real pattern of who has played
   which level (missing levels, Dennis's absent 90-105, the frontiers: the lag). A step counts as detected when
   the estimated step clears 2 SE in the planted direction and every leave-one-player-out refit that still has
   data on both sides agrees on its sign. A false alarm is the same test passing (either sign) with no step.

     node source/tools/builder/loop/real_fit.js e2 <plays-export.json> <out.json> [sims]                       */
'use strict';
const fs = require('fs');
const path = require('path');

const CAP = 12;
const DEFAULTS = { tau: 0.5, sdLevel: 0.3, sdSeq: 0, sdSkill: 5 };

/* ---------- small linear algebra ---------- */
function cholesky(A, n) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) { if (!(s > 0)) return null; L[i * n + i] = Math.sqrt(s); } else L[i * n + j] = s / L[j * n + j];
    }
  }
  return L;
}
function cholSolve(L, n, b) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]; y[i] = s / L[i * n + i]; }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k]; x[i] = s / L[i * n + i]; }
  return x;
}
const log1pexp = z => (z > 30 ? z : z < -30 ? Math.exp(z) : Math.log1p(Math.exp(z)));
const sigmoid = z => 1 / (1 + Math.exp(-z));

/* ---------- data ---------- */
const windowIndex = (lv, size, from) => Math.floor(lv / size) - Math.floor(from / size);
const windowLabel = (j, size, from, to) => { const a = (Math.floor(from / size) + j) * size; return `${Math.max(a, from)}-${Math.min(a + size - 1, to)}`; };

/* sequences: [{ who, lv, res: [0,0,1], won }] from real_ledger.js. */
function prepare(sequences, { size = 20, from = 85, to = 199, cap = CAP, players } = {}) {
  const seqs = sequences.filter(s => s.lv >= from && s.lv <= to && s.res && s.res.length);
  players = players || [...new Set(seqs.map(s => s.who))].sort();
  const levels = [...new Set(seqs.map(s => s.lv))].sort((a, b) => a - b);
  const J = windowIndex(to, size, from) + 1;
  const P = {}; players.forEach((p, i) => { P[p] = i; });
  const Lx = {}; levels.forEach((l, i) => { Lx[l] = i; });
  const rows = seqs.filter(s => s.who in P).map(s => {
    const r = s.res.slice(0, cap), W = r[r.length - 1] === 1 ? 1 : 0;
    return { p: P[s.who], w: windowIndex(s.lv, size, from), l: Lx[s.lv], W, N: r.length, lv: s.lv, who: s.who, won: !!s.won, rawTries: s.res.length };
  });
  return { players, levels, J, size, from, to, rows };
}

/* ---------- fit ---------- */
function fit(data, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { players, levels, J, rows } = data;
  const nP = players.length, nL = levels.length, K = nP + (J - 1) + nL, Q = rows.length;
  const iW = j => nP + j - 1, iB = l => nP + J - 1 + l;
  const th = new Float64Array(K), u = new Float64Array(Q);
  if (o.init) { th.set(o.init.th); if (o.init.u && o.init.u.length === Q) u.set(o.init.u); }
  const useU = o.sdSeq > 0, pu = useU ? 1 / (o.sdSeq * o.sdSeq) : 0;
  const pt = 1 / (o.tau * o.tau), pb = 1 / (o.sdLevel * o.sdLevel), ps = 1 / (o.sdSkill * o.sdSkill);
  const eta = (r, q, t, uu) => t[r.p] - (r.w > 0 ? t[iW(r.w)] : 0) - t[iB(r.l)] - (useU ? uu[q] : 0);
  const wv = (t, j) => (j > 0 ? t[iW(j)] : 0);
  function objective(t, uu) {
    let F = 0;
    for (let q = 0; q < Q; q++) { const r = rows[q], z = eta(r, q, t, uu); F += r.N * log1pexp(z) - r.W * z; if (useU) F += 0.5 * pu * uu[q] * uu[q]; }
    for (let i = 0; i < nP; i++) F += 0.5 * ps * t[i] * t[i];
    for (let j = 1; j < J; j++) { const d = wv(t, j) - wv(t, j - 1); F += 0.5 * pt * d * d; }
    for (let l = 0; l < nL; l++) F += 0.5 * pb * t[iB(l)] * t[iB(l)];
    return F;
  }
  // a_q as (index, coefficient) pairs
  const aOf = r => { const a = [[r.p, 1], [iB(r.l), -1]]; if (r.w > 0) a.push([iW(r.w), -1]); return a; };
  const A = rows.map(aOf);
  let F = objective(th, u), H = null, L = null, Huu = new Float64Array(Q), iter = 0, converged = false;
  for (iter = 0; iter < (o.maxIter || 60); iter++) {
    const g = new Float64Array(K); H = new Float64Array(K * K);
    for (let i = 0; i < nP; i++) { g[i] += ps * th[i]; H[i * K + i] += ps; }
    for (let j = 1; j < J; j++) {
      const d = wv(th, j) - wv(th, j - 1);
      g[iW(j)] += pt * d; H[iW(j) * K + iW(j)] += pt;
      if (j > 1) { g[iW(j - 1)] -= pt * d; H[iW(j - 1) * K + iW(j - 1)] += pt; H[iW(j) * K + iW(j - 1)] -= pt; H[iW(j - 1) * K + iW(j)] -= pt; }
    }
    for (let l = 0; l < nL; l++) { g[iB(l)] += pb * th[iB(l)]; H[iB(l) * K + iB(l)] += pb; }
    const gu = new Float64Array(Q);
    for (let q = 0; q < Q; q++) {
      const r = rows[q], z = eta(r, q, th, u), p = sigmoid(z), gq = r.W - r.N * p, h = r.N * p * (1 - p);
      let c = h, gadd = -gq;
      if (useU) { gu[q] = gq + pu * u[q]; Huu[q] = h + pu; c = h * pu / Huu[q]; gadd += h * gu[q] / Huu[q]; }
      for (const [i, ai] of A[q]) { g[i] += gadd * ai; for (const [k, ak] of A[q]) H[i * K + k] += c * ai * ak; }
    }
    L = cholesky(H, K);
    if (!L) throw new Error('Hessian not positive definite');
    const neg = g.map(v => -v), dth = cholSolve(L, K, neg);
    const du = new Float64Array(Q);
    if (useU) for (let q = 0; q < Q; q++) { const r = rows[q]; let ad = 0; for (const [i, ai] of A[q]) ad += ai * dth[i]; du[q] = -(gu[q] - r.N * sigmoid(eta(r, q, th, u)) * (1 - sigmoid(eta(r, q, th, u))) * ad) / Huu[q]; }
    let step = 1, Fn, tn, un, ok = false;
    for (let k = 0; k < 30; k++, step /= 2) {
      tn = th.map((v, i) => v + step * dth[i]); un = useU ? u.map((v, q) => v + step * du[q]) : u;
      Fn = objective(tn, un);
      if (Fn <= F + 1e-12) { ok = true; break; }
    }
    if (!ok) { converged = false; break; } // no step lowers the objective: keep th and u, report the failure
    let mx = 0; for (let i = 0; i < K; i++) mx = Math.max(mx, Math.abs(step * dth[i]));
    th.set(tn); if (useU) u.set(un);
    const dF = F - Fn; F = Fn;
    if (mx < 1e-7 || dF < 1e-11) { converged = true; break; }
  }
  // final Hessian pieces for SE and evidence (recomputed at the mode)
  const res = finish();
  function finish() {
    H = new Float64Array(K * K);
    for (let i = 0; i < nP; i++) H[i * K + i] += ps;
    for (let j = 1; j < J; j++) { H[iW(j) * K + iW(j)] += pt; if (j > 1) { H[iW(j - 1) * K + iW(j - 1)] += pt; H[iW(j) * K + iW(j - 1)] -= pt; H[iW(j - 1) * K + iW(j)] -= pt; } }
    for (let l = 0; l < nL; l++) H[iB(l) * K + iB(l)] += pb;
    let sumLogHuu = 0;
    for (let q = 0; q < Q; q++) {
      const r = rows[q], z = eta(r, q, th, u), p = sigmoid(z), h = r.N * p * (1 - p);
      let c = h; if (useU) { Huu[q] = h + pu; c = h * pu / Huu[q]; sumLogHuu += Math.log(Huu[q]); }
      for (const [i, ai] of A[q]) for (const [k, ak] of A[q]) H[i * K + k] += c * ai * ak;
    }
    L = cholesky(H, K);
    let logdet = 0; for (let i = 0; i < K; i++) logdet += 2 * Math.log(L[i * K + i]);
    // covariance of the window block
    const idx = []; for (let j = 1; j < J; j++) idx.push(iW(j));
    const covW = idx.map(i => { const e = new Float64Array(K); e[i] = 1; const x = cholSolve(L, K, e); return idx.map(k => x[k]); });
    const w = [0, ...idx.map(i => th[i])];
    const vw = (a, b) => (a === 0 || b === 0 ? 0 : covW[a - 1][b - 1]);
    const steps = [];
    for (let j = 1; j < J; j++) { const v = vw(j, j) + vw(j - 1, j - 1) - 2 * vw(j, j - 1); steps.push({ j, est: w[j] - w[j - 1], se: Math.sqrt(Math.max(v, 0)) }); }
    // log marginal likelihood (Laplace): each Gaussian prior adds -log(sd) per parameter (its 2*pi term cancels the
    // Laplace one), so evidences at different sdLevel, sdSeq or tau can be compared
    const priorNorm = (useU ? Q * Math.log(o.sdSeq) : 0) + nL * Math.log(o.sdLevel) + (J - 1) * Math.log(o.tau) + nP * Math.log(o.sdSkill);
    const evidence = -(F + priorNorm) - 0.5 * (logdet + sumLogHuu);
    return { w, seW: [0, ...idx.map((_, k) => Math.sqrt(covW[k][k]))], steps, evidence };
  }
  return {
    opts: o, converged, iter, F,
    skill: Object.fromEntries(players.map((p, i) => [p, th[i]])),
    window: res.w, windowSE: res.seW, steps: res.steps, evidence: res.evidence,
    level: Object.fromEntries(levels.map((l, i) => [l, th[iB(i)]])),
    th: Array.from(th), u: Array.from(u),
  };
}

/* sdSeq by the Laplace evidence over a grid. */
function chooseSdSeq(data, opts = {}, grid = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]) {
  const scores = grid.map(sd => ({ sd, evidence: fit(data, { ...opts, sdSeq: sd }).evidence }));
  const best = scores.reduce((a, b) => (b.evidence > a.evidence ? b : a));
  return { best: best.sd, scores };
}
/* sdLevel and sdSeq together by the Laplace evidence over a 2-D grid. */
function chooseSds(data, opts = {}, gridLevel = [0.15, 0.3, 0.5, 0.75, 1, 1.25], gridSeq = [0, 0.25, 0.5, 0.75, 1]) {
  const scores = [];
  for (const sdLevel of gridLevel) for (const sdSeq of gridSeq) {
    const f = fit(data, { ...opts, sdLevel, sdSeq });
    scores.push({ sdLevel, sdSeq, evidence: +f.evidence.toFixed(2), converged: f.converged });
  }
  const best = scores.filter(x => x.converged).reduce((a, b) => (b.evidence > a.evidence ? b : a));
  return { sdLevel: best.sdLevel, sdSeq: best.sdSeq, evidence: best.evidence, scores };
}

/* Expected tries to the first win (no cap) for a player in a window. The sd argument is the spread integrated out:
   pass levelSpread(opts) = sqrt(sdLevel^2 + sdSeq^2) for the average over the levels of a window; sdSeq alone
   gives a level whose shared effect is 0.  E[1/p] = 1 + exp(-(skill - window) + sd^2/2). */
const levelSpread = o => Math.hypot(o.sdLevel || 0, o.sdSeq || 0);
const sigmoidMix = (z, sd = 0) => { if (!(sd > 0)) return sigmoid(z); let s = 0, w = 0; for (let k = -30; k <= 30; k++) { const x = k / 6, g = Math.exp(-x * x / 2); s += g * sigmoid(z - sd * x); w += g; } return s / w; };
const expectedTries = (skill, win, sdSeq = 0) => 1 + Math.exp(-(skill - win) + sdSeq * sdSeq / 2);
/* The same with the tries capped (as Y is, at 20): E[min(T, cap)] = E[(1 - (1-p)^cap) / p], the spread (same
   meaning as above) integrated out numerically over N(0, sd^2) (61-point grid on +-5 sd). */
function expectedTriesCapped(skill, win, sdSeq = 0, cap = 20) {
  const one = z => { const p = sigmoid(z); return (1 - Math.pow(1 - p, cap)) / p; };
  if (!(sdSeq > 0)) return one(skill - win);
  let s = 0, wsum = 0;
  for (let k = -30; k <= 30; k++) { const x = k / 6, w = Math.exp(-x * x / 2); s += w * one(skill - win - sdSeq * x); wsum += w; }
  return s / wsum;
}

/* ---------- the step test ---------- */
// players with data in both windows next to boundary j
function coverage(data) {
  const seen = data.players.map(() => new Set());
  for (const r of data.rows) seen[r.p].add(r.w);
  const out = [];
  for (let j = 1; j < data.J; j++) out.push(data.players.filter((p, i) => seen[i].has(j) && seen[i].has(j - 1)));
  return out;
}
function without(data, who) {
  const p = data.players.indexOf(who);
  return { ...data, rows: data.rows.filter(r => r.p !== p) };
}
/* One full test: the main fit plus a fit leaving out each player. Returns per boundary
   { est, se, z, lopoAgree, pass2se, passFloor } where pass* include the LOPO agreement. */
function stepTest(data, opts = {}, { floor = 0.15, k = 2 } = {}) {
  const main = fit(data, opts), cov = coverage(data);
  const lopo = data.players.map(who => ({ who, f: fit(without(data, who), { ...opts, init: { th: main.th } }), cov: coverage(without(data, who)) }));
  const notConverged = (main.converged ? 0 : 1) + lopo.filter(L => !L.f.converged).length;
  return main.steps.map((s, idx) => {
    const sign = Math.sign(s.est);
    let agree = cov[idx].length >= 2; // with one player only nobody can confirm
    for (const L of lopo) {
      if (!cov[idx].includes(L.who)) continue; // dropping a player who is not there changes nothing to check
      if (!L.cov[idx].length) { agree = false; continue; }
      if (Math.sign(L.f.steps[idx].est) !== sign) agree = false;
    }
    const over = Math.abs(s.est) > k * s.se;
    return { boundary: idx + 1, est: s.est, se: s.se, z: s.est / s.se, players: cov[idx], lopoAgree: agree, pass2se: over && agree, passFloor: over && agree && Math.abs(s.est) > floor, pass2seNoLopo: over, notConverged };
  });
}

/* ---------- simulation ---------- */
function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const normal = () => { let x = 0; while (x === 0) x = next(); return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * next()); };
  return { next, normal };
}
/* New rows with the real pattern: won levels are played to the win (cut at 12), unfinished ones only as far as
   the player really got. */
function simulateRows(data, truth, R, cap = CAP) {
  const bl = data.levels.map(() => truth.sdLevel * R.normal());
  return data.rows.map(r => {
    const z = truth.skill[r.p] - truth.window[r.w] - bl[r.l] - truth.sdSeq * R.normal(), p = sigmoid(z);
    const limit = r.won ? cap : Math.min(cap, r.N);
    let W = 0, N = 0;
    while (N < limit) { N++; if (R.next() < p) { W = 1; break; } }
    return { ...r, W, N };
  });
}
function power(data, fitted, { deltas = [0.2, 0.35, 0.5], simsNull = 200, simsPer = 60, seed = 20261107, opts = {}, truth = {}, onProgress } = {}) {
  const R = rng(seed), J = data.J;
  // the simulated world: fitted skills; level and player-level sds as fitted unless `truth` says otherwise
  const truthBase = { skill: data.players.map(p => fitted.skill[p]), sdLevel: truth.sdLevel ?? opts.sdLevel ?? DEFAULTS.sdLevel, sdSeq: truth.sdSeq ?? opts.sdSeq ?? 0 };
  const cov = coverage(data);
  let notConverged = 0, tests = 0;
  const nullCounts = Array.from({ length: J - 1 }, () => ({ pass2se: 0, passFloor: 0, pass2seNoLopo: 0, n: 0 }));
  for (let s = 0; s < simsNull; s++) {
    const rows = simulateRows(data, { ...truthBase, window: new Array(J).fill(0) }, R);
    const t = stepTest({ ...data, rows }, opts);
    tests++; notConverged += t[0].notConverged;
    t.forEach((b, i) => { const c = nullCounts[i]; c.n++; c.pass2se += b.pass2se; c.passFloor += b.passFloor; c.pass2seNoLopo += b.pass2seNoLopo; });
    if (onProgress) onProgress('null', s);
  }
  const planted = [];
  for (const delta of deltas) for (let j = 1; j < J; j++) {
    const c = { delta, boundary: j, players: cov[j - 1], n: 0, pass2se: 0, passFloor: 0, pass2seNoLopo: 0, estMean: 0, seMean: 0 };
    const window = Array.from({ length: J }, (_, k) => (k >= j ? delta : 0));
    for (let s = 0; s < simsPer; s++) {
      const rows = simulateRows(data, { ...truthBase, window }, R);
      const b = stepTest({ ...data, rows }, opts)[j - 1];
      tests++; notConverged += b.notConverged;
      c.n++; c.estMean += b.est; c.seMean += b.se;
      const up = b.est > 0;
      c.pass2se += b.pass2se && up; c.passFloor += b.passFloor && up; c.pass2seNoLopo += b.pass2seNoLopo && up;
    }
    c.estMean /= c.n; c.seMean /= c.n;
    planted.push(c);
    if (onProgress) onProgress('planted', delta, j);
  }
  // fits: main plus one leave-one-player-out fit per player, per simulated test; notConverged: those whose line search failed
  return { nullCounts, planted, coverage: cov, truth: { sdLevel: truthBase.sdLevel, sdSeq: truthBase.sdSeq }, fits: tests * (1 + data.players.length), notConverged };
}

/* Does the simulated world look like the real one? Per player: share of levels won on the first try, share of
   levels reaching the 12-try cut, mean capped tries; real against simulated (fitted windows, not flat). */
function predictiveCheck(data, fitted, { sims = 200, seed = 7, truth = {} } = {}) {
  const R = rng(seed), stat = rows => data.players.map((p, i) => {
    const x = rows.filter(r => r.p === i && (r.won || r.N >= CAP));
    return { first: x.filter(r => r.W && r.N === 1).length / x.length, cut: x.filter(r => !r.W && r.N >= CAP).length / x.length, mean: x.reduce((a, r) => a + r.N, 0) / x.length };
  });
  const real = stat(data.rows), acc = data.players.map(() => ({ first: [], cut: [], mean: [] }));
  const t = { skill: data.players.map(p => fitted.skill[p]), window: fitted.window, sdLevel: truth.sdLevel ?? fitted.opts.sdLevel, sdSeq: truth.sdSeq ?? fitted.opts.sdSeq };
  for (let s = 0; s < sims; s++) stat(simulateRows(data, t, R)).forEach((v, i) => { for (const k of ['first', 'cut', 'mean']) acc[i][k].push(v[k]); });
  const q = (a, f) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(f * b.length))]; };
  return data.players.map((p, i) => Object.fromEntries([['player', p], ...['first', 'cut', 'mean'].map(k => [k, { real: +real[i][k].toFixed(3), sim: +(acc[i][k].reduce((a, b) => a + b, 0) / sims).toFixed(3), sim90: [+q(acc[i][k], 0.05).toFixed(3), +q(acc[i][k], 0.95).toFixed(3)] }])]));
}

/* Pool the per-boundary power counts: detection per delta over boundaries (optionally only those with all three
   family players), the false-alarm rate per window, and the kill test of E2. */
function summarisePower(pw, { family = ['Dennis', 'Gerda', 'MrsD'], killDelta = 0.35, killDetect = 0.7, killFalse = 0.1 } = {}) {
  const full = i => family.every(p => pw.coverage[i].includes(p));
  const pool = (list, key) => { const n = list.reduce((a, c) => a + c.n, 0); return n ? +(list.reduce((a, c) => a + c[key], 0) / n).toFixed(3) : null; };
  const deltas = [...new Set(pw.planted.map(c => c.delta))];
  const detection = deltas.map(d => {
    const all = pw.planted.filter(c => c.delta === d), three = all.filter(c => full(c.boundary - 1));
    const rates = all.map(c => c.pass2se / c.n);
    return { delta: d, pooledAll: pool(all, 'pass2se'), pooledThreePlayers: pool(three, 'pass2se'), bestBoundary: rates.length ? +Math.max(...rates).toFixed(3) : null, pooledNoLopo: pool(all, 'pass2seNoLopo'),
      meanEstOverDelta: all.length ? +(all.reduce((a, c) => a + c.estMean, 0) / all.length / d).toFixed(2) : null };
  });
  const fa = pw.nullCounts.map(c => c.pass2se / c.n);
  const falseAlarm = { pooled: pool(pw.nullCounts, 'pass2se'), worstWindow: fa.length ? +Math.max(...fa).toFixed(3) : null, pooledNoLopo: pool(pw.nullCounts, 'pass2seNoLopo') };
  const k = detection.find(d => d.delta === killDelta);
  return { detection, falseAlarm, kill: k ? { detect: k.pooledThreePlayers ?? k.pooledAll, needAtLeast: killDetect, falseAlarmWorst: falseAlarm.worstWindow, needAtMost: killFalse,
    killed: (k.pooledThreePlayers ?? k.pooledAll) < killDetect || falseAlarm.worstWindow > killFalse } : null };
}

module.exports = { CAP, predictiveCheck, DEFAULTS, prepare, fit, chooseSdSeq, chooseSds, levelSpread, sigmoidMix, expectedTries, expectedTriesCapped, summarisePower, coverage, stepTest, simulateRows, power, rng, windowLabel, windowIndex, cholesky, cholSolve };

/* ---------- E2 runner ---------- */
if (require.main === module) {
  const [cmd, file, out, simsArg] = process.argv.slice(2);
  if (cmd !== 'e2' || !file || !out) { console.error('usage: node real_fit.js e2 <plays-export.json> <out.json> [simsPer]'); process.exit(1); }
  const RL = require('./real_ledger.js');
  const t0 = Date.now();
  const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
  const L = RL.ledger(exp, { from: 85, to: 199 });
  const fam = L.sequences.filter(s => RL.FAMILY.includes(s.who));
  // levels beyond 199 (today's live 200-269 boards, which the 200-225 batch will replace): descriptive only
  const famBeyond = RL.ledger(exp, { from: 200, to: 269 }).sequences.filter(s => RL.FAMILY.includes(s.who));
  const simsPer = Number(simsArg) || 60;
  const result = { about: 'E2: real-data estimator and power simulation (loop/real_fit.js).', source: path.basename(file), made: new Date().toISOString(),
    ledger: { sequences: fam.length, tries: fam.reduce((a, s) => a + s.res.length, 0), triesAfterCap: fam.reduce((a, s) => a + Math.min(CAP, s.res.length), 0), skipped: L.skipped, outcomeCheck: { agree: L.diag.outcomeAgree, differ: L.diag.outcomeDiffer }, frontier: L.frontier },
    settings: { tau: DEFAULTS.tau, sdSkill: DEFAULTS.sdSkill, sdLevelAndSdSeq: 'chosen per window size by evidence (windows.<size>.sds)', cap: CAP, deadband: '2 SE, leave-one-player-out sign agreement', floor: 0.15 }, windows: {} };
  // descriptive tables by 10-level window
  const Y = RL.yardstick(fam), desc = [];
  const famAll = [...fam, ...famBeyond], YAll = { ...Y, ...RL.yardstick(famBeyond) };
  for (let a = 80; a < 270; a += 10) {
    const lo = Math.max(a, 85), hi = a + 9;
    if (a >= 200 && !famBeyond.some(s => s.lv >= lo && s.lv <= hi)) continue;
    const Y = YAll, fam = famAll, ys = Object.entries(Y).filter(([lv]) => +lv >= lo && +lv <= hi).map(([, v]) => v);
    const d = fam.filter(s => s.who === 'Dennis' && s.lv >= lo && s.lv <= hi);
    const row = { window: `${lo}-${hi}`, Ylevels: ys.length, Ymean: ys.length ? +(ys.reduce((x, v) => x + v.Y, 0) / ys.length).toFixed(2) : null,
      Ymedian: ys.length ? (v => (v[(v.length - 1) >> 1] + v[v.length >> 1]) / 2)(ys.map(v => v.Y).sort((x, y) => x - y)) : null, Ycensored: ys.filter(v => v.censored).length,
      dennisLevels: d.length, dennisFirstTry: d.length ? +(d.filter(s => s.won && s.tries === 1).length / d.length).toFixed(2) : null };
    for (const w of RL.FAMILY) { const x = fam.filter(s => s.who === w && s.lv >= lo && s.lv <= hi); row[w + 'Levels'] = x.length; row[w + 'NotWon'] = x.filter(s => !s.won).map(s => s.lv); row[w + 'MeanTriesCap20'] = x.length ? +(x.reduce((t, s) => t + Math.min(20, s.won ? s.tries : s.tries + 1), 0) / x.length).toFixed(2) : null; }
    desc.push(row);
  }
  result.byTen = desc;
  result.beyond199 = famBeyond.map(s => ({ who: s.who, lv: s.lv, tries: s.tries, won: s.won, open: s.open }));
  result.yardstick = Y;
  for (const size of [20, 10]) {
    const data = prepare(fam, { size, from: 85, to: 199 });
    // sdLevel and sdSeq together by the evidence; the chosen pair is both the fit setting and the simulated world
    const sds = chooseSds(data, {}, [0.15, 0.3, 0.5, 0.6, 0.75, 0.9, 1, 1.25], [0, 0.25, 0.5, 0.75, 1]);
    const opts = { sdLevel: sds.sdLevel, sdSeq: sds.sdSeq }, spread = levelSpread(opts);
    const f = fit(data, opts), test = stepTest(data, opts);
    // the setting the first draft used (fixed sdLevel 0.3, sdSeq 0.5 by evidence without the level normaliser)
    const OLD = { sdLevel: 0.3, sdSeq: 0.5 }, fOld = fit(data, OLD), testOld = stepTest(data, OLD);
    const labels = Array.from({ length: data.J }, (_, j) => windowLabel(j, size, 85, 199));
    const nNull = Math.max(100, simsPer * 2);
    const pw = power(data, f, { deltas: [0.2, 0.35, 0.5, 0.75], simsNull: nNull, simsPer, opts });
    // sensitivity: almost no random-walk shrinkage of the windows (tau 5), so the 2-SE test is not made conservative
    // by the prior; the truth is the same world
    const pwFlat = power(data, f, { deltas: [0.35, 0.5, 0.75], simsNull: nNull, simsPer: Math.round(simsPer / 2), opts: { ...opts, tau: 5 }, seed: 777 });
    // misspecified: worlds that differ from the fit setting, fitted with the chosen setting (false alarms only)
    const misWorlds = [{ sdLevel: opts.sdLevel, sdSeq: 0.5 }, { sdLevel: 0.3, sdSeq: 0.5 }];
    const pwMis = misWorlds.map((w, k) => power(data, f, { simsNull: nNull, simsPer: 0, deltas: [], opts, truth: w, seed: 99 + k }));
    // a heavier world (player-level sd 1.0) than the fit assumes: false alarms and detection of +0.35
    const pwHeavy = power(data, f, { simsNull: nNull, simsPer: Math.round(simsPer / 2), deltas: [0.35], opts, truth: { sdSeq: 1.0 }, seed: 4242 });
    const check = predictiveCheck(data, f), check1 = predictiveCheck(data, f, { truth: { sdSeq: 1.0 } });
    const eT = (p, v) => expectedTriesCapped(f.skill[p], v, spread);
    const modelY = v => (2 * eT('Dennis', v) + eT('Gerda', v) + 2 * eT('MrsD', v)) / 5;
    const fa = c => +(c.pass2se / c.n).toFixed(3), lab = i => labels[i] + ' | ' + labels[i + 1];
    const allPw = [pw, pwFlat, ...pwMis, pwHeavy];
    result.windows[size] = {
      predictiveCheck: { fitted: check, heavierSd1: check1 },
      labels, sds, players: data.players,
      fit: { settings: opts, converged: f.converged, spreadPerLevel: +spread.toFixed(3), skill: f.skill,
        window: f.window.map((v, j) => ({ window: labels[j], effect: +v.toFixed(3), se: +f.windowSE[j].toFixed(3),
          expectedTries: Object.fromEntries(data.players.map(p => [p, +expectedTries(f.skill[p], v, spread).toFixed(2)])),
          modelYcap20: +modelY(v).toFixed(2), dennisFirstTryModel: +sigmoidMix(f.skill.Dennis - v, spread).toFixed(3) })),
        steps: test.map(b => ({ between: lab(b.boundary - 1), est: +b.est.toFixed(3), se: +b.se.toFixed(3), z: +b.z.toFixed(2), players: b.players, lopoAgree: b.lopoAgree, flagged: b.pass2se })),
        levelSd: +Math.sqrt(Object.values(f.level).reduce((a, v) => a + v * v, 0) / Object.keys(f.level).length).toFixed(3),
        hardestLevels: Object.entries(f.level).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l, v]) => [+l, +v.toFixed(2)]),
        // what a step means in tries, at the first window, averaged over levels (capped at 20)
        stepInTries: [0, 0.2, 0.35, 0.5, 0.75, 1].map(d => ({ step: d, modelY: +modelY(d).toFixed(2), ratioY: +(modelY(d) / modelY(0)).toFixed(2),
          ...Object.fromEntries(data.players.map(p => [p, +eT(p, d).toFixed(2)])) })) },
      fitOldSettings: { settings: OLD, skill: fOld.skill, evidence: +fOld.evidence.toFixed(2), steps: testOld.map(b => ({ est: +b.est.toFixed(3), se: +b.se.toFixed(3), flagged: b.pass2se })) },
      power: {
        world: pw.truth,
        fits: allPw.reduce((a, x) => a + x.fits, 0), fitsNotConverged: allPw.reduce((a, x) => a + x.notConverged, 0),
        summary: summarisePower(pw),
        summaryFlatTau5: summarisePower(pwFlat),
        falseAlarm: pw.nullCounts.map((c, i) => ({ between: lab(i), players: pw.coverage[i], n: c.n, rate2se: fa(c), rateFloor: +(c.passFloor / c.n).toFixed(3), rateNoLopo: +(c.pass2seNoLopo / c.n).toFixed(3) })),
        falseAlarmMisspecified: pwMis.map(x => ({ world: x.truth, fitted: opts, n: x.nullCounts[0].n, pooled: summarisePower(x).falseAlarm.pooled, worstWindow: summarisePower(x).falseAlarm.worstWindow,
          perBoundary: x.nullCounts.map((c, i) => ({ between: lab(i), rate2se: fa(c), rateNoLopo: +(c.pass2seNoLopo / c.n).toFixed(3) })) })),
        heavierWorldSd1: { world: pwHeavy.truth, fitted: opts, falseAlarm: pwHeavy.nullCounts.map((c, i) => ({ between: lab(i), rate2se: fa(c) })), detection035: pwHeavy.planted.map(c => ({ between: lab(c.boundary - 1), players: c.players, rate2se: fa(c) })), summary: summarisePower(pwHeavy) },
        detection: pw.planted.map(c => ({ delta: c.delta, between: lab(c.boundary - 1), players: c.players, n: c.n, rate2se: fa(c), rateFloor: +(c.passFloor / c.n).toFixed(3), rateNoLopo: +(c.pass2seNoLopo / c.n).toFixed(3), meanEst: +c.estMean.toFixed(3), meanSE: +c.seMean.toFixed(3) })),
      },
    };
    console.log('window', size, 'sdLevel', sds.sdLevel, 'sdSeq', sds.sdSeq, 'done', Math.round((Date.now() - t0) / 1000) + 's');
  }
  const s20 = result.windows[20].power.summary.kill, s10 = result.windows[10].power.summary.kill;
  result.verdict = { rule: 'E2 kill: a +0.35 logit step over 20 levels detected < 70% of the time, or false alarms > 10% per window -> real data does not steer the slope',
    window20: s20, window10: s10, flatTau20: result.windows[20].power.summaryFlatTau5.kill, killed: !!(s20 && s20.killed) };
  result.care = RL.careLedger(exp);
  result.seconds = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
  console.log('wrote', out, result.seconds + 's');
}
