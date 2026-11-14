'use strict';
/* tail.js: a bot-free hardness measure and tuner for the part of a board AFTER the clock is taken
   (Dennis, lab 5, 2026-11-13: "a bit too easy after" on 292, 293, 294).

     const Tl = require('./tail.js');
     Tl.measure(design, { seed, playouts })     -> { tailGreedyWin, wins, playouts, seed, start:{ step, tray, left }, stored:{ steps, peakTray, meanTray, moves2plus, tray2Share } }
     Tl.tune(design, { band:[0.15,0.40], seed, wallMs, validate, k, playouts, ... })
                                                -> { design, before, after, band, inBand, edits, notes, reached, validated, ... }

   The greedy player (never looks ahead, deterministic from a seed): it turns over every free face-down tile (free), then
     1. takes a free tile whose picture waits in the tray (a visible match),
     2. else takes a free pair of the same picture (two visible copies) when the tray has room, or as a peek pair (one of them was face-down
        and the picture does not wait),
     3. else taps a random free tile (a 4th waiting tile loses).
   The measure starts from the state right after the clock tile was taken (following the stored solution) and plays the rest of the board;
   tailGreedyWin = the share of playouts that clear the board. Same rules as the strict engine (ice, locks, 4 slots), pictures of face-down tiles are
   unknown only in that the player never uses a face-down tile's picture before it is free.

   The tuner re-pairs pictures INSIDE the tail (the swap of smarten.js: (u,u'),(v,v') -> (v,u'),(u,v'), both pairs entirely after the clock, so the
   state at the clock and the whole pre-clock part stay as they are). A swap is kept when the stored solution still replays strictly, no close
   twin appears, and it moves tailGreedyWin towards the band; the final state must pass the caller's validate(design) (clock k, trap proof,
   static gates ...) - on a failure the longest valid prefix of the edits is kept (binary search). Blind gambles are never added: the number of
   gamble steps (>= 2 waiting, no safe progress, the stored move taps a face-down tile) and blind-only steps may not grow, and the face-down set is not touched.
   Deterministic for a seed; light CPU; bounded by wallMs.                                                                                      */
const E = require('../engine.js');
const L = global.Layouts || (global.Layouts = require('../../../www/layouts.js'));
const SEP = require('./separate.js');

const clone = x => JSON.parse(JSON.stringify(x));
const rngOf = seed => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const SLOTS = L.SLOTS;
const BAND = [0.15, 0.40];

// everything that does not depend on the pictures: neighbours, rules, the state after the clock tile, the tail order
function prepare(design) {
  const g = E.game(design, { strict: true }), n = g.n, sol = design.solution, ci = sol.indexOf(design.clock.i), init = new Uint8Array(n).fill(1);
  if (ci < 0) throw new Error('tail: stored solution does not contain the clock tile');
  const alive = init.slice(); for (let p = 0; p <= ci; p++) alive[sol[p]] = 0;
  const tail = sol.slice(ci + 1), inTail = new Uint8Array(n); for (const t of tail) inTail[t] = 1;
  const down = new Uint8Array(n); for (const i of design.down || []) down[i] = 1;
  return { g, n, sol, ci, init, alive, tail, inTail, down, nb: g.nb, rules: g.rules, T: g.tiles };
}
const takeable = (P, alive, i) => !!alive[i] && (P.rules ? L.takeable(i, alive, P.nb, P.rules, P.init) : L.isFree(i, alive, P.nb));
// the tray (tile ids) after the first `upto` solution entries, strict rules; null when the solution fails
function trayAfter(P, faces, upto) {
  const tray = []; for (let p = 0; p < upto; p++) { const t = P.sol[p], q = tray.findIndex(x => faces[x] === faces[t]); if (q >= 0) tray.splice(q, 1); else tray.push(t); if (tray.length >= SLOTS) return null; }
  return tray;
}
// does the stored tail still replay strictly with these faces (cheap: only the tail is simulated from the clock state)
function tailReplays(P, faces) {
  const tray = trayAfter(P, faces, P.ci + 1); if (!tray) return false;
  const alive = P.alive.slice();
  for (const t of P.tail) {
    if (!takeable(P, alive, t)) return false;
    alive[t] = 0; const q = tray.findIndex(x => faces[x] === faces[t]);
    if (q >= 0) tray.splice(q, 1); else { tray.push(t); if (tray.length >= SLOTS) return false; }
  }
  return tray.length === 0;
}

// ---------- the greedy playouts ----------
function playout(P, faces, rand) {
  const alive = P.alive.slice(), tray = trayAfter(P, faces, P.ci + 1); if (!tray) return false;
  let left = 0; for (let i = 0; i < P.n; i++) left += alive[i];
  const known = new Uint8Array(P.n); for (let i = 0; i < P.n; i++) known[i] = P.down[i] ? 0 : 1;
  const take = t => { alive[t] = 0; left--; const q = tray.findIndex(x => faces[x] === faces[t]); if (q >= 0) { tray.splice(q, 1); return true; } tray.push(t); return tray.length < SLOTS; };
  while (left > 0) {
    const free = []; for (let i = 0; i < P.n; i++) if (takeable(P, alive, i)) { free.push(i); known[i] = 1; }   // free face-down tiles are turned over
    if (!free.length) return false;
    const trayF = new Set(tray.map(x => faces[x]));
    const m = free.filter(i => trayF.has(faces[i]));
    if (m.length) { take(m[Math.floor(rand() * m.length)]); continue; }
    const byFace = new Map(); for (const i of free) { if (!byFace.has(faces[i])) byFace.set(faces[i], []); byFace.get(faces[i]).push(i); }
    const pairs = []; for (const g of byFace.values()) if (g.length >= 2) for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) pairs.push([g[a], g[b]]);
    const ok = pairs.filter(([a, b]) => tray.length <= SLOTS - 2 || P.down[a] || P.down[b]);
    if (ok.length) { const [a, b] = ok[Math.floor(rand() * ok.length)]; alive[a] = 0; alive[b] = 0; left -= 2; continue; }   // a pair goes together (a peek pair needs no slot)
    if (!take(free[Math.floor(rand() * free.length)])) return false;
  }
  return tray.length === 0;
}
function greedyWin(P, faces, seed, playouts) {
  const rand = rngOf(seed * 2654435761 + 11); let wins = 0;
  for (let p = 0; p < playouts; p++) if (playout(P, faces, rand)) wins++;
  return wins;
}

// facts of the stored solution inside the tail
function storedFacts(P, faces) {
  const tray = trayAfter(P, faces, P.ci + 1) || [], alive = P.alive.slice(); let peak = tray.length, sum = 0, m2 = 0, steps = 0;
  for (const t of P.tail) {
    steps++; if (tray.length >= 2) m2++;
    alive[t] = 0; const q = tray.findIndex(x => faces[x] === faces[t]); if (q >= 0) tray.splice(q, 1); else tray.push(t);
    peak = Math.max(peak, tray.length); sum += tray.length;
  }
  return { steps, peakTray: peak, meanTray: steps ? +(sum / steps).toFixed(3) : 0, moves2plus: m2, tray2Share: steps ? +(m2 / steps).toFixed(3) : 0 };
}
function measure(design, opts = {}) {
  const P = prepare(design), seed = opts.seed ?? 1, playouts = opts.playouts ?? 400, wins = greedyWin(P, design.faces, seed, playouts);
  const tray = trayAfter(P, design.faces, P.ci + 1) || [];
  return { tailGreedyWin: +(wins / playouts).toFixed(4), wins, playouts, seed, start: { step: P.ci + 1, tray: tray.length, left: P.tail.length }, stored: storedFacts(P, design.faces) };
}
// blind gamble facts of the tail along the stored solution (as texture.js counts them): taps of a face-down tile with >= 2 waiting and no safe progress
function gambleFacts(design) {
  const P = prepare(design), F = design.faces, alive = P.init.slice(), tray = []; let gamble = 0, blindOnly = 0;
  P.sol.forEach((m, t) => {
    if (t > P.ci) {
      const free = []; for (let i = 0; i < P.n; i++) if (takeable(P, alive, i)) free.push(i);
      const vis = free.filter(i => !P.down[i]), trayF = new Set(tray.map(x => F[x]));
      const safe = vis.some(i => trayF.has(F[i])) || (tray.length <= 2 && vis.some((i, a) => vis.some((j, b) => b > a && F[i] === F[j])));
      if (tray.length >= 2 && !safe && P.down[m]) gamble++;
      if (tray.length >= 2 && vis.length === 0) blindOnly++;
    }
    alive[m] = 0; const q = tray.findIndex(x => F[x] === F[m]); if (q >= 0) tray.splice(q, 1); else tray.push(m);
  });
  return { gamble, blindOnly };
}

// ---------- the tuner ----------
const dist = (w, band) => w < band[0] ? band[0] - w : w > band[1] ? w - band[1] : 0;
function tuneOnce(design, opts = {}) {
  const t0 = Date.now(), wallMs = opts.wallMs ?? 40000, band = opts.band || BAND, aim = [band[0] + Math.min(0.06, (band[1] - band[0]) / 4), band[1] - Math.min(0.06, (band[1] - band[0]) / 4)], playouts = opts.playouts ?? 300, rand = rngOf((opts.seed ?? 1) * 40503 + 5), notes = [];
  const P = prepare(design), geo = SEP.geometry(design), validate = opts.validate || (() => ({ ok: true })), fresh = opts.freshSeed ?? 977;
  const seed = opts.seed ?? 1, over = () => Date.now() - t0 > wallMs, close0 = SEP.closeTwins(design, geo), g0 = gambleFacts(design);
  const before = { ...measure(design, { seed: fresh, playouts: opts.reportPlayouts ?? 800 }), tuneSeed: measure(design, { seed, playouts }).tailGreedyWin };
  // tail pairs: both tiles after the clock (the pre-clock part and the tray at the clock stay as they are)
  const frozen = new Set((opts.freeze || []).map(t => design.faces[t]));
  const pairOf = new Map(), tray = []; P.sol.forEach(t => { const q = tray.findIndex(x => design.faces[x] === design.faces[t]); if (q >= 0) { pairOf.set(t, tray[q]); pairOf.set(tray[q], t); tray.splice(q, 1); } else tray.push(t); });
  const movable = P.tail.filter(t => P.inTail[pairOf.get(t)] && !frozen.has(design.faces[t]));
  let faces = design.faces.slice(), cur = tuneScore(P, faces, seed, playouts, aim), edits = [], pending = 0, snap = { faces: faces.slice(), n: 0, cur };
  const closeCost = f => { const d2 = { ...design, faces: f }; const c = SEP.closeTwins(d2, geo); return [c.visible, c.four, c.count]; };
  const c0 = closeCost(faces), noWorse = c => c[0] <= c0[0] && c[1] <= c0[1] && c[2] <= Math.max(c0[2], 0);
  const noGamble = f => { const g1 = gambleFacts({ ...design, faces: f }); return g1.gamble <= g0.gamble && g1.blindOnly <= g0.blindOnly; };
  notes.push(`start: tailGreedyWin ${before.tailGreedyWin} (fresh seed), ${before.tuneSeed} (tune seed), band ${band.join('-')}, ${movable.length} movable tail tiles`);
  let tries = 0;
  while (!over() && cur.d > 0 && movable.length > 3 && tries < 6000) {
    tries++;
    const u = movable[Math.floor(rand() * movable.length)], v = movable[Math.floor(rand() * movable.length)];
    if (u === v || faces[u] === faces[v] || pairOf.get(u) === v) continue;
    const fu = faces[u], fv = faces[v]; faces[u] = fv; faces[v] = fu;
    let keep = false;
    if (tailReplays(P, faces)) {   // cheapest test first; the twins and gamble checks only for a swap that helps
      const s = tuneScore(P, faces, seed, playouts, aim);
      if (s.d < cur.d && noWorse(closeCost(faces)) && noGamble(faces)) {
        if (opts.validateEach) {   // proven in chunks of validateEvery accepted swaps (a proof costs seconds on a big board); a failing chunk is dropped as a whole
          cur = s; edits.push([u, v]); keep = true; pending++;
          if (pending >= (opts.validateEvery ?? 3)) {
            const dv = clone(design); dv.faces = faces.slice(); const rv = validate(dv);
            if ((rv === true || rv.ok) && (!opts.accept || opts.accept(dv))) { snap = { faces: faces.slice(), n: edits.length, cur }; pending = 0; }
            else { notes.push('swaps refused: ' + (rv.why || 'accept')); faces = snap.faces.slice(); edits.length = snap.n; cur = snap.cur; pending = 0; keep = true; }
          }
        }
        else { cur = s; edits.push([u, v]); keep = true; }
      }
    }
    if (!keep) { faces[u] = fu; faces[v] = fv; }
  }
  notes.push(`${tries} proposals, ${edits.length} swaps kept, tune-seed win ${cur.w}`);
  // validate; keep the longest valid prefix when the full set fails
  const apply = m => { const d2 = clone(design); for (const [u, v] of edits.slice(0, m)) { const t = d2.faces[u]; d2.faces[u] = d2.faces[v]; d2.faces[v] = t; } return d2; };
  const okOf = d2 => { const g1 = gambleFacts(d2); if (g1.gamble > g0.gamble || g1.blindOnly > g0.blindOnly) return { ok: false, why: 'gamble ' + g1.gamble + '/' + g1.blindOnly }; const v = validate(d2); return v === true ? { ok: true } : v; };
  let m = edits.length, d2 = apply(m), v = m ? okOf(d2) : { ok: true }, validated = true;
  if (!v.ok) {
    notes.push('full edit set rejected: ' + v.why); let lo = 0, hi = m - 1, best = 0, bestD = null;
    while (lo <= hi && Date.now() - t0 < wallMs * 2) { const mid = (lo + hi) >> 1; if (mid === 0) { lo = 1; continue; } const dd = apply(mid), r = okOf(dd); if (r.ok) { best = mid; bestD = dd; lo = mid + 1; } else hi = mid - 1; }
    m = best; d2 = best ? bestD : clone(design); if (!best) validated = true; notes.push('kept ' + best + ' of ' + edits.length + ' swaps');
  }
  const after = { ...measure(d2, { seed: fresh, playouts: opts.reportPlayouts ?? 800 }), tuneSeed: measure(d2, { seed, playouts }).tailGreedyWin };
  const inBand = after.tailGreedyWin >= band[0] && after.tailGreedyWin <= band[1];
  return { design: d2, before, after, band, inBand, edits: edits.slice(0, m), swaps: m, notes, gamble: gambleFacts(d2), closeTwins: SEP.summary(SEP.closeTwins(d2, geo)), validated, reached: inBand ? 'in band' : 'closest: ' + after.tailGreedyWin, ms: Date.now() - t0 };
}
// up to 3 rounds (a new tuning seed each): a round that ends outside the band on the fresh seed starts again from its result
function tune(design, opts = {}) {
  const t0 = Date.now(), wall = opts.wallMs ?? 40000; let cur = design, first = null, last = null, edits = [], notes = [];
  for (let r = 0; r < 3; r++) {
    const left = wall - (Date.now() - t0); if (r && left < 1500) break;
    const o = tuneOnce(cur, { ...opts, seed: (opts.seed ?? 1) + r * 17, wallMs: r ? left : Math.max(2000, wall * 0.5), validate: opts.validate }); first = first || o; last = o;
    notes.push(...o.notes.map(x => 'r' + r + ': ' + x)); edits = edits.concat(o.edits); cur = o.design; if (o.inBand || !o.swaps) break;
  }
  return { ...last, before: first.before, edits, swaps: edits.length, notes, ms: Date.now() - t0 };
}
function tuneScore(P, faces, seed, playouts, band) { const w = greedyWin(P, faces, seed, playouts) / playouts; return { w: +w.toFixed(3), d: +dist(w, band).toFixed(4) }; }


// ---------- tray pressure of the stored tail (Dennis 2026-11-14: "after the trap tray pressure may increase ... Dont overdo on tray pressure. 1 in tray is enough after a hard trap") ----------
// occupancy = tiles waiting in the tray BEFORE each tail step of the stored route. Every tap changes it by one, so about half of the steps sit on odd values; the aim is: 1 waiting common, 2 occasional, 3 rare or absent.
function occupancy(design) {
  const P = prepare(design), F = design.faces, tray = [], cnt = [0, 0, 0, 0]; let steps = 0, run = 0, longest = 0, sum = 0;
  P.sol.forEach((t, i) => {
    if (i > P.ci) { cnt[Math.min(tray.length, 3)]++; steps++; sum += tray.length; if (tray.length >= 2) { run++; longest = Math.max(longest, run); } else run = 0; }
    const q = tray.findIndex(x => F[x] === F[t]); if (q >= 0) tray.splice(q, 1); else tray.push(t);
  });
  return { steps, counts: cnt, share: cnt.map(c => steps ? +(c / steps).toFixed(3) : 0), longest2plus: longest, mean: steps ? +(sum / steps).toFixed(3) : 0 };
}
// the wish as a number (0 = as wished): too many 3s, too many 2s, too few 1s, long stretches with 2 or more waiting, a free run of ready pairs (0 waiting)
function pressureMiss(o, gentle) {
  const sh = o.share, want1 = gentle ? 0.35 : 0.42;
  return +(Math.max(0, want1 - sh[1]) * 2 + Math.max(0, sh[2] - 0.20) * 2 + Math.max(0, sh[3] - 0.03) * 6 + Math.max(0, o.longest2plus - 4) * 0.05 + Math.max(0, sh[0] - 0.42)).toFixed(4);
}
// a new stored order for the tail (the part up to and including the clock stays): a beam search over the tail moves (strict rules: ice, locks, 4 slots) that holds the tray near one waiting tile.
// Cost per step by waiting tiles (0, 1, 2, 3); a blind gamble (as gambleFacts counts it) costs a lot, and the result is kept only when it adds none. Same pictures, same face-down set: tailGreedyWin does not change.
function reroute(design, opts = {}) {
  const t0 = Date.now(), wall = opts.wallMs ?? 20000, W = opts.width ?? 200, gentle = !!opts.gentle, pen = opts.pen || [6, 60], cap0 = gentle ? 0.40 : 0.36, cap2 = gentle ? 0.12 : 0.17;   // running shares above the caps cost more: 1 waiting is free, 0 (ready pairs) and 2 only up to their cap, 3 and blind gambles always dear
  const P = prepare(design), F = design.faces, n = P.n, rand = rngOf((opts.seed ?? 1) * 7919 + 3), g0 = gambleFacts(design), o0 = occupancy(design), tray0 = trayAfter(P, F, P.ci + 1);
  if (!tray0) return { ok: false, why: 'storedTrayLost' };
  let beam = [{ alive: P.alive.slice(), tray: tray0.slice(), cost: 0, node: null, cnt: [0, 0, 0, 0], run: 0 }];
  for (let step = 0; step < P.tail.length; step++) {
    if (Date.now() - t0 > wall) return { ok: false, why: 'wall' };
    const next = new Map();
    for (const s of beam) {
      const free = []; for (let i = 0; i < n; i++) if (takeable(P, s.alive, i)) free.push(i);
      const vis = free.filter(i => !P.down[i]), trayF = new Set(s.tray.map(x => F[x]));
      const safe = vis.some(i => trayF.has(F[i])) || (s.tray.length <= 2 && vis.some((i, a) => vis.some((j, b) => b > a && F[i] === F[j])));
      for (const t of free) {
        const q = s.tray.findIndex(x => F[x] === F[t]); let tray;
        if (q >= 0) { tray = s.tray.slice(); tray.splice(q, 1); } else { if (s.tray.length >= SLOTS - 1) continue; tray = s.tray.concat([t]); }
        const o = Math.min(s.tray.length, 3), cnt = s.cnt.slice(); cnt[o]++; let c = s.cost;
        if (o === 0) c += cnt[0] / (step + 1) > cap0 ? 1.0 : 0.3; else if (o === 2) c += cnt[2] / (step + 1) > cap2 ? 1.2 : 0.3; else if (o === 3) c += pen[0];
        const run = o >= 2 ? s.run + 1 : 0; if (run > 3) c += 0.6;
        if (s.tray.length >= 2 && !safe && P.down[t]) c += pen[1];
        if (s.tray.length >= 2 && vis.length === 0) c += pen[1];
        const al = s.alive.slice(); al[t] = 0;
        const key = Buffer.from(al).toString('latin1') + '|' + tray.map(x => F[x]).sort((a, b) => a - b).join(','), old = next.get(key);
        if (!old || c < old.cost) next.set(key, { alive: al, tray, cost: c, node: { t, prev: s.node }, r: rand(), cnt, run });
      }
    }
    if (!next.size) return { ok: false, why: 'beamDied at step ' + step };
    beam = [...next.values()].sort((a, b) => (a.cost - b.cost) || (a.r - b.r)).slice(0, W);
  }
  const best = beam.find(s => s.tray.length === 0); if (!best) return { ok: false, why: 'trayNotEmpty' };
  const path = []; for (let nd = best.node; nd; nd = nd.prev) path.push(nd.t); path.reverse();
  const d2 = clone(design); d2.solution = P.sol.slice(0, P.ci + 1).concat(path);
  const o1 = occupancy(d2), g1 = gambleFacts(d2);
  if (g1.gamble > g0.gamble || g1.blindOnly > g0.blindOnly) return { ok: false, why: 'gamble ' + g1.gamble + '/' + g1.blindOnly };
  if (!E.replay(d2, d2.solution, { strict: true }).ok) return { ok: false, why: 'replay' };
  return { ok: true, design: d2, before: o0, after: o1, missBefore: pressureMiss(o0, gentle), missAfter: pressureMiss(o1, gentle), cost: best.cost, ms: Date.now() - t0 };
}
// more face-down tiles in the part after the trap only: tail tiles that are not protected (the caller names clock, locks, keys, ice, baits and their neighbourhood), up to the target share of the board (cap 0.30),
// at most one tile of a picture pair, none that adds a blind gamble. Returns the design and the tiles in the order they were added (the caller may keep a prefix).
function addFaceDown(design, opts = {}) {
  const P = prepare(design), rand = rngOf((opts.seed ?? 1) * 104729 + 9), protect = opts.protect || new Set(), cap = opts.cap ?? 0.30, n = P.n, have = (design.down || []).length;
  const want = Math.max(0, Math.min(Math.floor(cap * n), Math.ceil((opts.target ?? 0.265) * n)) - have), maxOut = opts.max ?? want, g0 = gambleFacts(design), F = design.faces;
  const pairOf = new Map(), tray = []; P.sol.forEach(t => { const q = tray.findIndex(x => F[x] === F[t]); if (q >= 0) { pairOf.set(t, tray[q]); pairOf.set(tray[q], t); tray.splice(q, 1); } else tray.push(t); });
  const geo = SEP.geometry(design), cands = P.tail.filter(t => !P.down[t] && !protect.has(t) && t !== design.clock.i);
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  cands.sort((a, b) => (geo.vis[a] ? 1 : 0) - (geo.vis[b] ? 1 : 0));   // covered tiles first (a face-down tile that lies open from the start reads as luck)
  const added = [], hiddenPair = new Set(); let cur = clone(design); cur.down = (design.down || []).slice();
  for (const t of cands) {
    if (added.length >= maxOut) break; const p = pairOf.get(t); if (p != null && (hiddenPair.has(p) || P.down[p])) continue;
    cur.down.push(t); const g1 = gambleFacts(cur);
    if (g1.gamble > g0.gamble || g1.blindOnly > g0.blindOnly) { cur.down.pop(); continue; }
    added.push(t); hiddenPair.add(t);
  }
  cur.down.sort((a, b) => a - b);
  return { design: cur, added, want };
}

// Exact, budgeted alternatives to occupancy (which describes only one route).
const { capped: cappedTail, forced: forcedPressure } = require('./tail_search.js');
module.exports = { measure, tune, gambleFacts, storedFacts, prepare, tailReplays, BAND, occupancy, pressureMiss, reroute, addFaceDown, cappedTail, forcedPressure };
