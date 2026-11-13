'use strict';
/* separate.js: "twins apart" - a bot-free pass that re-pairs pictures so that two tiles with the same picture do not lie next to or on
   each other (Dennis, 2026-11-13, lab 4, levels 281/282: "Pairs are too much together. Too obvious.").

     const S = require('./separate.js');
     S.closeTwins(design)  -> { n, pairs, close:[[a,b,why]...], closeVisible:[...], closeFour:[...], share, visible, fourGroups }
     S.separate(design, { seed, wallMs, protect, freeze, validate, k, solution })
         -> { design, before, after, edits:[[u,v]...], validated, wallHit, notes, remaining }

   Closeness, from the layout geometry as the player sees it (tile = 2 x 2 layout units, x and y in half tiles):
     touch     |dx| <= 2 and |dy| <= 2 on any layer: side by side, diagonal contact, or overlapping in the stack (any z)
     row       |dy| <= 1 (same row), 2 < |dx| <= 4 (one tile of space at most) and no tile at all lies between them
   Targets: no close twins among tiles whose picture is visible at move 0, at most 5% of the pairs close overall, and for a picture with
   four copies no two of the four close.

   Method: the tile swap between two pairs (smarten.js): swap the pictures of tile u (pair u,u') and tile v (pair v,v'):
   (u,u'),(v,v') -> (v,u'),(u,v'). Whole-pair relabelling cannot move twins, so it is not used here. A swap is kept when
     1. it lowers the weighted closeness (visible close twins 10, close twins of a four-copy picture 5, any other close pair 1),
     2. the stored solution still replays strictly,
     3. the caller's `validate(design)` (clock k unchanged, static gates, the trap's own story proof ...) holds for the state.
   Cheap checks (1, 2) run per proposal; `validate` runs on the accumulated state, with a binary search over the edit prefix when it
   fails (and the failing edit is not tried again). Deterministic for a seed; bounded by wallMs. Tiles in `protect` are never swapped;
   tiles in `freeze` and every tile of their pictures are never touched (so the pairs the trap proof uses stay twins).
   The default validate (no `validate` given) is the strict replay plus the unchanged clock minimum k.                                    */
const E = require('../engine.js');
const { tileVisibility } = require('../../sim/refit/human_board_visibility.js');

const clone = x => JSON.parse(JSON.stringify(x));
const rngOf = seed => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const W_VIS = 10, W_FOUR = 5, W_ANY = 1;

function geometry(design) {
  const T = design.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t), n = T.length;
  const close = Array.from({ length: n }, () => new Uint8Array(n));   // 0 no, 1 touch, 2 row
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const dx = Math.abs(T[a].x - T[b].x), dy = Math.abs(T[a].y - T[b].y); let r = 0;
    if (dx <= 2 && dy <= 2) r = 1;
    else if (dy <= 1 && dx <= 4) {
      const lo = Math.min(T[a].x, T[b].x), hi = Math.max(T[a].x, T[b].x), ym = (T[a].y + T[b].y) / 2;
      let between = false; for (let k = 0; k < n && !between; k++) if (k !== a && k !== b && T[k].x > lo && T[k].x < hi && Math.abs(T[k].y - ym) <= 1) between = true;
      if (!between) r = 2;
    }
    close[a][b] = close[b][a] = r;
  }
  const vis = tileVisibility(T, { alive: new Uint8Array(n).fill(1), down: Uint8Array.from({ length: n }, (_, i) => (design.down || []).includes(i) ? 1 : 0), openPeek: -1 }, null).tiles.map(v => !!v.picture);
  return { T, n, close, vis };
}
const groupsOf = faces => { const g = new Map(); faces.forEach((f, t) => { if (!g.has(f)) g.set(f, []); g.get(f).push(t); }); return g; };
// close pairs inside one picture group
function groupClose(geo, tiles) { const out = []; for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) { const w = geo.close[tiles[i]][tiles[j]]; if (w) out.push([tiles[i], tiles[j], w === 1 ? 'touch' : 'row']); } return out; }
function groupCost(geo, tiles) {
  let c = 0; for (const [a, b] of groupClose(geo, tiles)) c += geo.vis[a] && geo.vis[b] ? W_VIS : tiles.length >= 4 ? W_FOUR : W_ANY;
  return c;
}
function closeTwins(design, geo = geometry(design)) {
  const g = groupsOf(design.faces), close = [], closeVisible = [], closeFour = [];
  for (const tiles of g.values()) for (const p of groupClose(geo, tiles)) { close.push(p); if (geo.vis[p[0]] && geo.vis[p[1]]) closeVisible.push(p); if (tiles.length >= 4) closeFour.push(p); }
  const pairs = design.tiles.length / 2;
  return { n: design.tiles.length, pairs, close, closeVisible, closeFour, count: close.length, share: +(close.length / pairs).toFixed(4),
    visible: closeVisible.length, four: closeFour.length, fourGroups: [...g.values()].filter(t => t.length >= 4).length,
    meets: closeVisible.length === 0 && closeFour.length === 0 && close.length / pairs <= 0.05 };
}
const summary = c => ({ close: c.count, share: c.share, visible: c.visible, four: c.four, meets: c.meets });

function defaultValidator(design, k) {
  const kk = Number.isInteger(k) ? k : (() => { const cs = E.clockShortest(E.game(clone(design))); return cs && !cs.unsure ? cs.k : null; })();
  return d => {
    if (!E.replay(d, d.solution, { strict: true }).ok) return { ok: false, why: 'replay' };
    const cs = E.clockShortest(E.game(clone(d)), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity });
    if (!cs || cs.unsure) return { ok: false, why: 'k unproven' };
    if (kk != null && cs.k !== kk) return { ok: false, why: 'k changed ' + kk + '->' + cs.k };
    return { ok: true };
  };
}
function swapped(d, edits) { const c = clone(d); for (const [u, v] of edits) { const t = c.faces[u]; c.faces[u] = c.faces[v]; c.faces[v] = t; } return c; }

function swapStage(design, opts = {}) {
  const t0 = Date.now(), wallMs = opts.wallMs ?? 60000, rand = rngOf((opts.seed ?? 1) * 104729 + 7), notes = [];
  const protect = new Set(opts.protect || []), parent = clone(design), geo = geometry(parent);
  const freezeFaces = new Set((opts.freeze || []).map(t => parent.faces[t]));
  const validate = opts.validate || defaultValidator(parent, opts.k);
  const out = { design: parent, before: closeTwins(parent, geo), edits: [], validated: true, wallHit: false, notes, proposals: 0, validations: 0 };
  const over = () => Date.now() - t0 > wallMs;
  const bad = new Set();   // edits rejected by validate
  let cur = clone(parent), edits = [];
  const key = (u, v) => u < v ? u + ',' + v : v + ',' + u;
  const movable = t => !protect.has(t) && !freezeFaces.has(cur.faces[t]);
  const solOk = d => E.replay(d, d.solution, { strict: true }).ok;
  const totalCost = faces => { let c = 0; for (const tiles of groupsOf(faces).values()) c += groupCost(geo, tiles); return c; };

  for (let round = 0; round < 12 && !over(); round++) {
    // ---- greedy cheap phase on the current state
    let faces = cur.faces.slice(), grp = groupsOf(faces), accepted = [], costs = [];
    const cost0 = totalCost(faces);
    if (cost0 === 0) break;
    let cost = cost0, bestCost = cost0, bestLen = 0, stall = 0;
    const budget = t0 + wallMs * (round === 0 ? 0.55 : 0.2) ;
    for (let it = 0; it < 6000 && Date.now() < Math.min(budget, t0 + wallMs) && stall < 250 && cost > 0; it++) {
      // a close pair, the heavier ones more often
      const list = []; for (const tiles of grp.values()) for (const p of groupClose(geo, tiles)) list.push({ p, w: (geo.vis[p[0]] && geo.vis[p[1]] ? W_VIS : tiles.length >= 4 ? W_FOUR : W_ANY) });
      if (!list.length) break;
      let tot = 0; for (const x of list) tot += x.w; let r = rand() * tot, pick = list[0]; for (const x of list) { r -= x.w; if (r <= 0) { pick = x; break; } }
      const [a, b] = pick.p, us = [a, b].filter(movable); if (!us.length) { stall++; continue; }
      const u = us[Math.floor(rand() * us.length)], fu = faces[u], gu = grp.get(fu);
      const props = [];
      for (let v = 0; v < parent.tiles.length; v++) {
        if (v === u || faces[v] === fu || !movable(v) || bad.has(key(u, v))) continue;
        const fv = faces[v], gv = grp.get(fv);
        const delta = groupCost(geo, gu.filter(t => t !== u).concat(v)) + groupCost(geo, gv.filter(t => t !== v).concat(u)) - groupCost(geo, gu) - groupCost(geo, gv);
        props.push({ v, delta, k: delta + rand() * 0.9 });
      }
      props.sort((x, y) => x.k - y.k);
      let done = false;
      for (const pr of props) {
        if (pr.delta > 0 && !(pr.delta <= 1 && rand() < 0.04)) break;
        if (pr.delta === 0 && rand() < 0.7) continue;
        out.proposals++;
        const v = pr.v, fv = faces[v], gv = grp.get(fv);
        faces[u] = fv; faces[v] = fu;
        if (!solOk({ ...cur, faces })) { faces[u] = fu; faces[v] = fv; continue; }
        grp.set(fu, gu.filter(t => t !== u).concat(v)); grp.set(fv, gv.filter(t => t !== v).concat(u));
        accepted.push([u, v]); cost += pr.delta; costs.push(cost);
        if (cost < bestCost) { bestCost = cost; bestLen = accepted.length; stall = 0; }
        done = true; break;
      }
      stall++;
    }
    accepted.length = bestLen;
    if (!accepted.length) { notes.push('round ' + round + ': no improving swap'); break; }
    // ---- validate the accumulated state; binary search the longest valid prefix when it fails
    const tryPrefix = m => { const d = swapped(cur, accepted.slice(0, m)); out.validations++; const v = validate(d); return v === true || (v && v.ok) ? { d, v } : { v }; };
    let m = accepted.length, r = tryPrefix(m);
    if (!r.d) {
      let lo = 0, hi = m - 1, best = 0, bestD = null;   // largest valid prefix (validity is assumed monotone enough; a valid one is verified anyway)
      while (lo <= hi && !over()) { const mid = (lo + hi) >> 1; if (mid === 0) { lo = 1; continue; } const q = tryPrefix(mid); if (q.d) { best = mid; bestD = q.d; lo = mid + 1; } else hi = mid - 1; }
      notes.push(`round ${round}: ${m} swaps rejected (${r.v && r.v.why}), kept ${best}`);
      if (best < accepted.length) bad.add(key(...accepted[best]));
      if (!best) { if (accepted.length === 1) bad.add(key(...accepted[0])); continue; }
      cur = bestD; edits = edits.concat(accepted.slice(0, best));
    } else { cur = r.d; edits = edits.concat(accepted); notes.push(`round ${round}: ${accepted.length} swaps validated`); }
  }
  out.wallHit = over();
  out.design = cur; out.edits = edits; out.after = closeTwins(cur, geo);
  const fin = validate(cur); out.validated = fin === true || !!(fin && fin.ok);
  if (!out.validated) { out.design = parent; out.edits = []; out.after = out.before; notes.push('final state not valid, parent returned'); }
  out.remaining = out.after.count;
  out.ms = Date.now() - t0;
  return out;
}

// ======================================================================================================
// Stage 'prefix' and 'tail': re-pair along the stored removal order (no change of the order in the prefix).
// The stored witness takes most pairs as two consecutive tiles, which lie side by side. Pairs only have to be twins in the TRAY:
// a pairing of the removal order is legal when the tray never holds more than before (the profile of waiting tiles).
//   prefix  = the stored solution up to the first moment after the clock where the tray is empty again (the dig, the orphans and their twins).
//             Its tiles are re-matched among themselves by a branch-and-bound over pairings whose tray profile equals (or does not exceed)
//             the stored one; the tray pressure of the dig - the thing the traps are built on - is kept.
//   tail    = everything after: rebuilt as a new witness. Repeatedly two tiles that can go (the second one may come free by taking the
//             first) and are NOT close are taken as a pair; faces are then dealt to the pairs (a picture with four copies gets
//             two pairs that are far from each other). A rebuilt tail is a new stored solution; it is validated like any other edit.
// ======================================================================================================
const Lay = global.Layouts || (global.Layouts = require('../../../www/layouts.js'));
const wPair = (geo, a, b) => geo.close[a][b] ? (geo.vis[a] && geo.vis[b] ? W_VIS : W_ANY) : 0;
// who matches whom, and the tray length after every step of the stored order
function trayWalk(design, sol) {
  const F = design.faces, tray = [], pairOf = new Map(), occ = [];
  for (const t of sol) { const q = tray.findIndex(x => F[x] === F[t]); if (q >= 0) { pairOf.set(t, tray[q]); pairOf.set(tray[q], t); tray.splice(q, 1); } else tray.push(t); occ.push(tray.length); }
  return { pairOf, occ };
}
const gameOf = design => E.game(clone(design), { strict: true });
const canTakeG = (g, alive, i) => !!alive[i] && (g.rules ? Lay.takeable(i, alive, g.nb, g.rules, new Uint8Array(g.n).fill(1)) : Lay.isFree(i, alive, g.nb));
// close cost of a whole face assignment (groups of 2 and 4)
function facesCost(geo, faces) { let c = 0; for (const tiles of groupsOf(faces).values()) c += groupCost(geo, tiles); return c; }
// deal the faces of `poolFaces` (one per pair) to `pairs` (arrays [a,b]); hill-climb the picture swaps between pairs
function dealFaces(geo, faces, pairs, poolFaces, rand, iters = 400) {
  const f = faces.slice(), pool = poolFaces.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  pairs.forEach((p, k) => { f[p[0]] = pool[k]; f[p[1]] = pool[k]; });
  let cost = facesCost(geo, f);
  for (let it = 0; it < iters && cost > 0 && pairs.length > 1; it++) {
    const i = Math.floor(rand() * pairs.length), j = Math.floor(rand() * pairs.length); if (i === j || f[pairs[i][0]] === f[pairs[j][0]]) continue;
    const fi = f[pairs[i][0]], fj = f[pairs[j][0]];
    for (const t of pairs[i]) f[t] = fj; for (const t of pairs[j]) f[t] = fi;
    const c2 = facesCost(geo, f); if (c2 <= cost) cost = c2; else { for (const t of pairs[i]) f[t] = fi; for (const t of pairs[j]) f[t] = fj; }
  }
  return f;
}
function firstEmptyAfter(occ, ci) { for (let p = ci; p < occ.length; p++) if (occ[p] === 0) return p; return -1; }
// branch and bound over the pairings of the prefix; the tray profile after each step is occ[p] (relax: at most occ[p])
function matchPrefix(geo, tiles, occ, forced, relax, limit) {
  const Lp = tiles.length, open = [], pairs = [], res = []; let nodes = 0, bound = Infinity; const K = 30;
  const rec = c => { res.push({ c, pairs: pairs.map(p => p.slice()) }); res.sort((a, b) => a.c - b.c); if (res.length > K) res.pop(); if (res.length === K) bound = res[K - 1].c; };
  (function dfs(p, cost) {
    if (nodes++ > limit || cost > bound) return;
    if (p === Lp) { if (!open.length) rec(cost); return; }
    const t = tiles[p], f = forced.get(t), need = occ[p];
    const okLen = n => relax ? n <= need : n === need;
    if (f !== undefined && open.includes(f)) {
      const i = open.indexOf(f); open.splice(i, 1);
      if (okLen(open.length)) { pairs.push([f, t]); dfs(p + 1, cost + wPair(geo, f, t)); pairs.pop(); }
      open.splice(i, 0, f); return;
    }
    if (f === undefined) for (let i = 0; i < open.length; i++) {
      const o = open[i]; if (forced.has(o)) continue;
      open.splice(i, 1);
      if (okLen(open.length)) { pairs.push([o, t]); dfs(p + 1, cost + wPair(geo, o, t)); pairs.pop(); }
      open.splice(i, 0, o);
    }
    open.push(t); if (okLen(open.length)) dfs(p + 1, cost); open.pop();
  })(0, 0);
  return res;
}
// rebuild the tail from the state after `prefix`: greedy pairs of tiles that are not close, with restarts
function buildTail(design, geo, prefix, rand, tries, wallAt, forced = new Map()) {
  const g = gameOf(design), n = g.n, base = new Uint8Array(n).fill(1); for (const t of prefix) base[t] = 0;
  let best = null;
  for (let a = 0; a < tries && Date.now() < wallAt; a++) {
    const alive = base.slice(), seq = [], pairs = []; let left = 0, closeN = 0; for (let i = 0; i < n; i++) left += alive[i];
    let stuck = false;
    while (left > 0) {
      const free = []; for (let i = 0; i < n; i++) if (canTakeG(g, alive, i)) free.push(i);
      if (!free.length) { stuck = true; break; }
      // pairs whose faces must stay (bait twins): taken as soon as both can go (the first, then the second once it is free)
      let fp = null;
      for (const x of free) { const y = forced.get(x); if (y == null || !alive[y]) continue; alive[x] = 0; const ok = canTakeG(g, alive, y); alive[x] = 1; if (ok) { fp = [x, y]; break; } }
      if (fp) { alive[fp[0]] = 0; alive[fp[1]] = 0; seq.push(fp[0], fp[1]); pairs.push(fp); left -= 2; continue; }
      free.splice(0, free.length, ...free.filter(x => !forced.has(x)));
      if (!free.length) { stuck = true; break; }
      // the tile with the fewest far partners goes first (it is the hardest to place later)
      const opts = [];
      for (const x of free) {
        alive[x] = 0; const ps = []; for (let y = 0; y < n; y++) if (!forced.has(y) && canTakeG(g, alive, y)) ps.push(y); alive[x] = 1;
        const far = ps.filter(y => !geo.close[x][y]);
        opts.push({ x, ps, far });
      }
      const withFar = opts.filter(o => o.far.length);
      let a1, b1;
      if (withFar.length) {
        const m = Math.min(...withFar.map(o => o.far.length)), pool = withFar.filter(o => o.far.length <= m + 1), pick = pool[Math.floor(rand() * pool.length)];
        a1 = pick.x; b1 = pick.far[Math.floor(rand() * pick.far.length)];
      } else {
        const cand = opts.filter(o => o.ps.length); if (!cand.length) { stuck = true; break; }
        const pick = cand[Math.floor(rand() * cand.length)]; a1 = pick.x; b1 = pick.ps.slice().sort((p, q) => geo.close[a1][p] - geo.close[a1][q])[0]; closeN++;
      }
      alive[a1] = 0; alive[b1] = 0; seq.push(a1, b1); pairs.push([a1, b1]); left -= 2;
    }
    if (stuck) continue;
    if (!best || closeN < best.closeN) best = { seq, pairs, closeN }; if (best.closeN === 0) break;
  }
  return best;
}
function applyFaces(d, faces, solution) { const c = clone(d); c.faces = faces; if (solution) c.solution = solution; return c; }

function prefixTailStage(design, opts, state) {
  const { geo, rand, notes, wallAt, validate } = state, parent = design, sol = parent.solution, ci = sol.indexOf(parent.clock.i);
  const walk = trayWalk(parent, sol), qEnd = firstEmptyAfter(walk.occ, ci);
  const freezeT = new Set(opts.freeze || []), frozenFaces = new Set([...freezeT].map(t => parent.faces[t]));
  let cur = parent, edits = [];
  if (qEnd < 0 || !Array.isArray(sol) || sol.length !== design.tiles.length) { notes.push('no empty tray after the clock: prefix/tail skipped'); return { design: cur, edits }; }
  const prefix = sol.slice(0, qEnd + 1), occ = walk.occ.slice(0, qEnd + 1), forced = new Map();
  for (const t of prefix) if (frozenFaces.has(parent.faces[t])) forced.set(t, walk.pairOf.get(t));
  const before = facesCost(geo, parent.faces);
  // ---- prefix
  if (opts.prefix !== false && prefix.length <= 40 && Date.now() < wallAt) {
    for (const relax of [false, true]) {
      if (Date.now() >= wallAt) break;
      const cands = matchPrefix(geo, prefix, occ, forced, relax, relax ? 400000 : 250000);
      const baseCost = (() => { let c = 0; const seen = new Set(); for (const t of prefix) { const o = walk.pairOf.get(t); if (o != null && !seen.has(t)) { seen.add(t); seen.add(o); c += wPair(geo, t, o); } } return c; })();
      let tried = 0, ok = false;
      for (const cd of cands) {
        if (cd.c >= baseCost || tried >= (opts.prefixTries || 10) || Date.now() >= wallAt) break; tried++;
        const frozenPairs = cd.pairs.filter(p => forced.has(p[0])), movePairs = cd.pairs.filter(p => !forced.has(p[0]));
        const poolFaces = []; const seen = new Set(); for (const t of prefix) { const o = walk.pairOf.get(t); if (seen.has(t)) continue; seen.add(t); seen.add(o); if (!forced.has(t)) poolFaces.push(parent.faces[t]); }
        if (poolFaces.length !== movePairs.length) continue;
        const faces = dealFaces(geo, cur.faces, movePairs, poolFaces, rand, 300), d2 = applyFaces(cur, faces);
        const v = validate(d2); state.validations++;
        if (v === true || (v && v.ok)) { cur = d2; edits.push(['prefix', relax ? 'relaxed' : 'exact', baseCost + '->' + cd.c]); ok = true; notes.push(`prefix (${prefix.length} tiles, ${relax ? 'relaxed' : 'exact'} tray profile): close weight ${baseCost} -> ${cd.c}`); break; }
        notes.push('prefix candidate rejected: ' + (v && v.why));
      }
      if (ok) break;
    }
  }
  // ---- tail (new witness)
  if (opts.tail !== false && Date.now() < wallAt) {
    let accepted = false;
    for (let round = 0; round < (opts.tailRounds || 10) && !accepted && Date.now() < wallAt; round++) {
      const w0 = trayWalk(cur, cur.solution), forcedT = new Map(); for (const x of cur.solution.slice(qEnd + 1)) if (frozenFaces.has(cur.faces[x])) forcedT.set(x, w0.pairOf.get(x));
      const sub = Math.min(wallAt, Date.now() + 4000), t = buildTail(cur, geo, prefix, rand, 40, sub, forcedT);
      if (!t) { notes.push('tail: no rebuild found'); continue; }
      const movePairs = t.pairs.filter(p => !forcedT.has(p[0])), pool = []; { const seen = new Set(); const w2 = trayWalk(cur, cur.solution); for (const x of cur.solution.slice(qEnd + 1)) { const o = w2.pairOf.get(x); if (o == null || seen.has(x) || forcedT.has(x)) continue; seen.add(x); seen.add(o); pool.push(cur.faces[x]); } }
      if (pool.length !== movePairs.length) { notes.push('tail: pair count mismatch'); continue; }
      const faces = dealFaces(geo, cur.faces, movePairs, pool, rand, 1500), d2 = applyFaces(cur, faces, prefix.concat(t.seq));
      const c0 = SEPCOST(geo, cur), c1 = SEPCOST(geo, d2);
      state.validations++; const v = validate(d2);
      if (v === true || (v && v.ok)) { cur = d2; edits.push(['tail', t.pairs.length + ' pairs', 'forced close ' + t.closeN]); accepted = true; notes.push(`tail rebuilt (${t.pairs.length} pairs, ${t.closeN} forced close): close weight ${c0} -> ${c1}`); }
      else notes.push('tail rejected: ' + (v && v.why));
    }
  }
  return { design: cur, edits, before };
}
const SEPCOST = (geo, d) => facesCost(geo, d.faces);

// the whole pass: prefix + tail re-pairing, then the picture-swap search for what is left. Deterministic from opts.seed, bounded by opts.wallMs.
function separate(design, opts = {}) {
  const t0 = Date.now(), wallMs = opts.wallMs ?? 60000, wallAt = t0 + wallMs, rand = rngOf((opts.seed ?? 1) * 7919 + 13), notes = [];
  const parent = clone(design), geo = geometry(parent), validate0 = opts.validate || defaultValidator(parent, opts.k);
  const state = { geo, rand, notes, wallAt, validations: 0, validate: d => { const v = validate0(d); return v === true ? { ok: true } : v; } };
  const out = { design: parent, before: closeTwins(parent, geo), edits: [], validated: true, wallHit: false, notes, proposals: 0, validations: 0 };
  let cur = parent, edits = [];
  if (opts.pass !== 'swap') {
    const r = prefixTailStage(cur, opts, state); cur = r.design; edits = edits.concat(r.edits);
  }
  const mid = closeTwins(cur, geo); notes.push('after prefix/tail: ' + mid.count + ' close (visible ' + mid.visible + ', four ' + mid.four + ')');
  if (!mid.meets && opts.swap !== false && Date.now() < wallAt) {
    const sw = swapStage(cur, { ...opts, validate: state.validate, wallMs: Math.max(1500, wallAt - Date.now()), k: opts.k });
    out.proposals = sw.proposals; state.validations += sw.validations; notes.push(...sw.notes);
    if (sw.validated && sw.edits.length) { cur = sw.design; edits = edits.concat(sw.edits.map(e => ['swap', ...e])); }
  }
  out.wallHit = Date.now() > wallAt;
  const fin = state.validate(cur); out.validated = !!(fin && fin.ok);
  if (!out.validated) { cur = parent; edits = []; notes.push('final state not valid, parent returned'); }
  out.design = cur; out.edits = edits; out.after = closeTwins(cur, geo); out.remaining = out.after.count; out.validations = state.validations; out.ms = Date.now() - t0;
  return out;
}

module.exports = { separate, swapStage, closeTwins, geometry, summary, defaultValidator, trayWalk, matchPrefix };
