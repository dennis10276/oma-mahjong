'use strict';
// Re-pair tail pictures, including the tail copies of pre-clock waiters.
// Those copies were immovable in the greedy tuner: it changed whole tail
// pairs only. Every result retains a strict shortest-prefix solution and
// must pass the caller's complete trap/static proof before it is accepted.
const Tl = require('./tail.js'), E = require('../engine.js'), SEP = require('./separate.js');
const copy = x => structuredClone(x);
function tune(design, opts = {}) {
  const t0 = Date.now(), wall = opts.ms ?? 60000, seed0 = opts.seed ?? 1;
  let seed = seed0 >>> 0; const rnd = n => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); };
  const band = opts.band || [0.06, 0.28], budget = { scope: 'board', nodes: opts.nodes ?? 200000, ms: opts.queryMs ?? 1000, moments: opts.moments ?? 3 };
  const before = Tl.forcedPressure(design, budget), P = Tl.prepare(design), g0 = Tl.gambleFacts(design), geo = SEP.geometry(design), c0 = SEP.closeTwins(design, geo);
  const freeze = new Set((opts.freeze || []).map(i => design.faces[i]));
  let movable = P.tail.filter(i => !freeze.has(design.faces[i]));
  let proposals = 0, checked = 0, proven = 0, best = null, nearest = null, failures = {};
  const fail = k => { failures[k] = (failures[k] || 0) + 1; };
  const tailWin = d => Tl.measure(d, { seed: 977, playouts: 800 }).tailGreedyWin;
  const inBand = w => w >= band[0] && w <= band[1];
  const distance = w => w < band[0] ? band[0] - w : w > band[1] ? w - band[1] : 0;
  const rank = (f, w) => f.targetMet ? 10 - 2 * (w == null ? 0 : distance(w)) : f.cap2.result === 'win' ? 2 + f.episodes.lowerBound : 0;
  // Each restart begins at the proven board. Neutral swaps permit local
  // combinations; they do not bypass the final board-wide pressure proof.
  let cur = copy(design), currentRank = rank(before, tailWin(design)), edits = [], restarts = 0, opened = false;
  if (before.targetMet && inBand(tailWin(design))) return { ok: true, design, before, after: before, edits: [], proposals, checked, proven, failures, ms: Date.now() - t0 };
  while (Date.now() - t0 < wall && proposals < (opts.proposals ?? 20000)) {
    if (!opened && Date.now() - t0 > wall / 2 && opts.openFreeze !== false) { movable = P.tail.slice(); opened = true; }
    if (movable.length < 2) break;
    proposals++;
    if (proposals % 120 === 0) { cur = copy(design); edits = []; currentRank = rank(before, tailWin(design)); restarts++; }
    const u = movable[rnd(movable.length)], v = movable[rnd(movable.length)];
    if (u === v || cur.faces[u] === cur.faces[v]) continue;
    let d = copy(cur); d.solution = design.solution.slice(); [d.faces[u], d.faces[v]] = [d.faces[v], d.faces[u]];
    const ct = SEP.closeTwins(d, geo);
    if (ct.visible > c0.visible || ct.share > Math.max(0.05, c0.share) || ct.four > c0.four) { fail('twins'); continue; }
    if (!Tl.tailReplays(P, d.faces)) {
      // Re-search the tail only, preserving the shortest clock prefix.
      const r = Tl.cappedTail(d, 3, { peek: false, nodes: 10000, ms: 100 });
      if (r.result !== 'win') { fail('strictTail:' + r.result); continue; }
      d.solution = r.solution;
    }
    let gm = Tl.gambleFacts(d);
    if ((gm.gamble > g0.gamble || gm.blindOnly > g0.blindOnly) && rnd(8) === 0) {
      const rr = Tl.reroute(d, { width: 40, wallMs: 400, seed: rnd(100000) + 1 });
      if (rr.ok) { d = rr.design; gm = Tl.gambleFacts(d); }
    }
    if (gm.gamble > g0.gamble || gm.blindOnly > g0.blindOnly) { fail('gamble'); continue; }
    checked++;
    let f = Tl.forcedPressure(d, budget);
    let w = f.targetMet || f.episodes.lowerBound >= 2 ? tailWin(d) : null;
    if (!f.targetMet && opts.escalate && f.cap2.result === 'win' && f.episodes.lowerBound >= 2 && inBand(w) && f.episodes.tests.some(t => t.result === 'unknown')) {
      f = Tl.forcedPressure(d, { ...budget, nodes: budget.nodes * 5, ms: budget.ms * 3 });
    }
    if (f.targetMet && w === null) w = tailWin(d);
    const rnk = rank(f, w);
    if (f.cap2.result === 'win' && f.episodes.lowerBound >= 2 && inBand(w) && (!nearest || f.episodes.lowerBound > nearest.forced.episodes.lowerBound)) nearest = { design: d, forced: f, tail: w };
    if (rnk >= currentRank && (rnk > currentRank || rnd(4) === 0)) { cur = d; edits.push([u, v]); currentRank = rnk; }
    if (!f.targetMet) { fail('pressure:' + f.cap1.result + '/' + f.cap2.result + '/' + f.episodes.lowerBound); continue; }
    if (!inBand(w)) { fail('band:' + (w < band[0] ? 'hard' : 'easy')); continue; }
    const vr = opts.validate ? opts.validate(d) : { ok: true };
    if (vr !== true && !vr.ok) { fail('proof:' + vr.why); continue; }
    proven++; best = { design: d, after: f, edits: edits.concat(cur === d ? [] : [[u, v]]), tail: w };
    break;
  }
  return { ok: !!best, ...(best || {}), before, ...(best ? {} : { candidate: nearest }), proposals, checked, proven, restarts, openedFreeze: opened, failures, ms: Date.now() - t0 };
}
module.exports = { tune };
