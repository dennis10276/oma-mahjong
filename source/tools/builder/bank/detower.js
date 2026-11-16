#!/usr/bin/env node
'use strict';
/* detower.js: take the towers out of the narrowed 251-299 boards (Dennis 2026-11-15, lab 8280: "No towers", "make it as
   mirrored as possible", "place the penguin on a logical spot"). The released boards never stack a tile straight on another
   tile (always half-offset or pyramid); Codex's narrowed candidates (wip/codex-refit-release) do on 22 levels.

   Per level: start from the candidate board and its tile map (Codex's records), move only finish tiles (not a special, not
   an authored wrong move, not on the stored route to the clock, nothing lying on them) to free spots inside the pile's
   outline: fully supported, no overlap, nothing above the spot, no higher than the released board. Moves are chosen
   greedily by a shape score: no straight stacks, no stray tiles (a parity or row its layer does not use), no upper tile
   on an outermost base tile, more mirror pairs, then the fewest and shortest moves. Then a fresh full winning route
   (stored clock route + an exact tail search) and Codex's own Task 20 certificate (finish_ten_proof.certify,
   MECH=1 NARROW_TRAP=core: same clock minimum and spare, special effects and prerequisites, wrong moves, own proof,
   badges, twins, footprint).

     MECH=1 NARROW_TRAP=core node detower.js --levels 256,282 [--grow 269:72]
   writes source/analysis/builder/footprint60/detower/level-<n>.json  */
const fs = require('fs'), path = require('path');
const CF = path.resolve(__dirname, '../../../../../codex-finish-ten/source/tools/builder/bank') + '/';
const P = require('./finish_all_sources'), Q = require(CF + 'finish_ten_proof'), R = require(CF + 'finish_ten_records');
const G = require(CF + 'narrow_methods'), E = require(CF + '../engine'), Tl = require(CF + 'tail'), F = require(CF + '../footprint');
const CFA = path.resolve(CF, '../../../analysis/builder/finish-ten');
const OUT = path.resolve(__dirname, process.env.FINISH_ALL ? '../../../analysis/builder/finish-all/same' : '../../../analysis/builder/footprint60/detower');
const clone = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- the candidate and its map to the released (source) board ----------
function candidate(level) {
  if(level>300){const d=P.original(level).design;return{level,source:level,d,keep:d.tiles.map((_,i)=>i)};}
  const swap = { 262: 'compact-260-final.json', 277: 'compact-280-final.json' }[level];
  if (swap) { const j = JSON.parse(fs.readFileSync(path.join(CFA, 'swap-260-280', swap))); return { level, source: j.sourceLevel || j.level, d: j.design, keep: j.keep }; }
  const pack = JSON.parse(fs.readFileSync(path.join(CFA, 'proposed/pack.json'))), row = pack.rows.find(r => r.level === level);
  const before = P.original(row.sourceLevel || level), map = R.mapping(before, row.draft.design, R.record(row));
  if (map.error) throw Error(level + ': ' + map.error);
  return { level, source: row.sourceLevel || level, d: row.draft.design, keep: map.keep };
}

// ---------- shape ----------
const over = (a, b) => a[2] === b[2] && Math.abs(a[0] - b[0]) < 2 && Math.abs(a[1] - b[1]) < 2;
function shape(T) {
  const key = t => t.join(','), S = new Set(T.map(key));
  const xs = T.map(t => t[0]), m = Math.min(...xs) + Math.max(...xs);
  const straightT = T.map(t => t[2] > 0 && S.has(key([t[0], t[1], t[2] - 1])));
  const strayT = T.map(t => { const lay = T.filter(q => q !== t && q[2] === t[2]); const ypar = lay.some(q => (q[1] - t[1]) % 2 === 0); const row = lay.filter(q => q[1] === t[1]); return !ypar || (row.length > 0 && row.every(q => (q[0] - t[0]) % 2 !== 0)); });
  const edgeT = T.map(t => { if (!t[2]) return false; const row = T.filter(q => q[2] === 0 && Math.abs(q[1] - t[1]) < 2); if (!row.length) return false; const lo = Math.min(...row.map(q => q[0])), hi = Math.max(...row.map(q => q[0])); return t[0] <= lo || t[0] >= hi; });
  const mirrorT = T.map(t => S.has(key([m - t[0], t[1], t[2]])));
  const n = k => k.filter(Boolean).length;
  return { straight: n(straightT), stray: n(strayT), edge: n(edgeT), mirror: +(n(mirrorT) / T.length).toFixed(2), straightT, strayT, edgeT, mirrorT };
}
const score = (T, moved) => { const s = shape(T); return s.straight * 100 + s.stray * 30 + s.edge * 12 - s.mirror * 60 + moved * 0.5; };

function supportedAt(T, p, skip) {
  if (p[2] === 0) return true;
  for (const a of [p[0], p[0] + 1]) for (const b of [p[1], p[1] + 1])
    if (!T.some((q, j) => j !== skip && q[2] === p[2] - 1 && q[0] <= a && q[0] + 2 > a && q[1] <= b && q[1] + 2 > b)) return false;
  return true;
}
const freeSpot = (T, p, skip) => !T.some((q, j) => j !== skip && (over(q, p) || (q[2] === p[2] + 1 && Math.abs(q[0] - p[0]) < 2 && Math.abs(q[1] - p[1]) < 2)));

// ---------- route and proof ----------
function route(d) {
  const ci = d.solution.indexOf(d.clock.i); let prefix = d.solution.slice(0, ci + 1);
  const plays = () => { const g = E.game(clone({ ...d, solution: [] }), { strict: true }); let st = E.start(g);
    for (const t of prefix) { if (!E.legal(g, st).includes(t)) return false; st = E.step(g, st, t); if (!st) return false; } return true; };
  if (!plays()) { const cs = E.clockShortest(E.game(clone(d), { strict: true }), { nodes: 1000000, ms: 15000 }); if (!cs || cs.unsure) return null; const f = E.flatten(cs.path); prefix = f.slice(0, f.indexOf(d.clock.i) + 1); if (!prefix.length || !plays()) return null; }
  const ci2 = prefix.length - 1;
  const x = { ...d, solution: prefix.concat(d.solution.filter(i => !prefix.includes(i))) }; void ci2;
  let r; try { r = Tl.cappedTail(x, 3, { peek: false, nodes: 1500000, ms: 20000 }); } catch (e) { return null; }
  if (!r || r.result !== 'win') return null;
  return E.replay({ ...d, solution: r.solution }, r.solution, { strict: true }).ok ? r.solution : null;
}

function run(level, opts = {}) {
  const c = candidate(level), before = P.original(c.source), a = before.design, base = P.prepare(before);
  const ids = new Map(c.keep.map((id, i) => [id, i])), mp = i => ids.get(i);
  let d = clone(c.d), keep = c.keep.slice();
  // tiles that must not move: specials, authored wrong moves, the stored route to the clock
  const fixed = new Set([d.clock.i, ...d.obst.keys, ...d.obst.locks, ...Object.keys(d.obst.ice).map(Number)]);
  for (const b of before.card?.trap?.baits || []) for (const t of b.tiles) if (mp(t) != null) fixed.add(mp(t));
  for (const t of d.solution.slice(0, d.solution.indexOf(d.clock.i) + 1)) fixed.add(t);
  // a stricter first pass also keeps every tile touching a special or a wrong move where it is
  const g0 = E.game(clone(d)), touch = new Set(fixed);
  for (const s of fixed) for (const k of ['above', 'left', 'right']) for (const u of g0.nb[k][s] || []) touch.add(u);
  for (let i = 0; i < d.tiles.length; i++) for (const k of ['above']) for (const u of g0.nb[k][i] || []) if (fixed.has(u)) touch.add(i);
  const xs = d.tiles.map(t => t[0]), ys = d.tiles.map(t => t[1]);
  const X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys), ZMAX = Math.max(...a.tiles.map(t => t[2]));
  const s0 = shape(d.tiles), tried = [];
  for (const banned of opts.loose ? [fixed] : [touch, fixed]) {
    let T = clone(d.tiles), moves = [];
    const movable = i => !banned.has(i) && !T.some((q, j) => j !== i && q[2] === T[i][2] + 1 && Math.abs(q[0] - T[i][0]) < 2 && Math.abs(q[1] - T[i][1]) < 2);
    for (let it = 0; it < 40; it++) {
      const cur = score(T, moves.length); let best = null;
      for (let i = 0; i < T.length; i++) {
        if (!movable(i)) continue;
        for (let z = 0; z <= ZMAX; z++) for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
          const p = [x, y, z]; if (same(p, T[i])) continue;
          if (!freeSpot(T, p, i) || !supportedAt(T, p, i)) continue;
          const U = T.slice(); U[i] = p;
          if (U.some((q, j) => j !== i && q[2] > 0 && !supportedAt(U, q, j))) continue;   // nothing may rest on the old spot (movable() already ensures it)
          const sc = score(U, moves.length + 1) + (Math.abs(x - T[i][0]) + Math.abs(y - T[i][1]) + Math.abs(z - T[i][2]) * 2) * 0.05;
          if (sc < cur - 1 && (!best || sc < best.sc)) best = { i, p, sc };
        }
      }
      if (!best) break;
      moves.push([best.i, T[best.i], best.p]); T[best.i] = best.p;
    }
    const s1 = shape(T), cand = { ...clone(d), tiles: T };
    if (!G.valid(T)) { tried.push({ pass: banned === touch ? 'strict' : 'loose', why: 'invalid geometry' }); continue; }
    const sol = route(cand); if (!sol) { tried.push({ pass: banned === touch ? 'strict' : 'loose', moves: moves.length, shape: s1, why: 'no full winning route' }); continue; }
    cand.solution = sol;
    const cert = Q.certify(before, cand, keep, base);
    const rec = { pass: banned === touch ? 'strict' : 'loose', moves: moves.map(([i, f, t]) => ({ tile: i, from: f, to: t, face: d.faces[i] })), shape: { before: strip(s0), after: strip(s1) }, ok: cert.ok, errors: cert.errors };
    tried.push(rec);
    if (cert.ok && s1.straight === 0) return save({ level, ok: true, source: c.source, design: cand, keep, ...rec, certificate: cert, tried });
  }
  return save({ level, ok: false, source: c.source, tried });
}
// ---------- pictures: no more visible close twins than the released board ----------
// Exchange the pictures of two ordinary finish tiles (never a special or a wrong move, nor a tile showing one of their
// pictures) until the board shows no more close twins than before. Counts per picture stay the same.
const SEP = require(CF + 'separate');
function untwin(d, limit, fixedT) {
  const ok = i => !fixedT.has(i);
  let swaps = 0;
  for (let it = 0; it < 40; it++) {
    const tw = SEP.closeTwins(d); if (tw.visible <= limit) return { d, swaps };
    const pair = tw.closeVisible.find(q => ok(q[0]) || ok(q[1])); if (!pair) return { d, swaps, stuck: true };
    const i = ok(pair[0]) ? pair[0] : pair[1]; let best = null;
    for (let t = 0; t < d.faces.length; t++) {
      if (t === i || !ok(t) || d.faces[t] === d.faces[i]) continue;
      const e = { ...d, faces: d.faces.slice() }; [e.faces[i], e.faces[t]] = [e.faces[t], e.faces[i]];
      const v = SEP.closeTwins(e).visible; if (!best || v < best.v) best = { t, v, e };
    }
    if (!best || best.v >= tw.visible) return { d, swaps, stuck: true };
    d = best.e; swaps++;
  }
  return { d, swaps };
}

// ---------- trim and use the middle (from the released board) ----------
// Dennis 2026-11-15 on 288: "trim and use the middle". The outer columns beyond a centred window of 12 (or 13) half-units
// come off together with everything that rested on them; those tiles go back inside the pile on brick spots: fully supported,
// half-offset (never straight on one tile), on the parity its layer and row already use, nothing above the spot, no higher than
// the released board; mirror pairs first, then low and central. Specials, wrong moves and the released route to the clock stay.
function brickSpot(T, p, opts = {}) {
  if (!freeSpot(T, p, -1) || !supportedAt(T, p, -1)) return false;
  const K = new Set(T.map(t => t.join(',')));
  if (p[2] > 0 && K.has([p[0], p[1], p[2] - 1].join(','))) return false;                       // straight on a tile
  if (opts.halfRows) return true; // supported half-row staircases (Task 24)
  const lay = T.filter(q => q[2] === p[2]);
  if (lay.length && !lay.some(q => (q[1] - p[1]) % 2 === 0)) return false;                        // a row height its layer does not use
  const row = lay.filter(q => q[1] === p[1]);
  if (row.length && row.every(q => (q[0] - p[0]) % 2 !== 0)) return false;                        // off the row's parity
  return true;
}
function trimRun(level, opts = {}) {
  const c = candidate(level), before = P.original(c.source), a = before.design, base = P.prepare(before);
  const n = a.tiles.length, fixed = new Set([a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number)]);
  for (const b of before.card?.trap?.baits || []) for (const t of b.tiles) fixed.add(t);
  if (!opts.routeMoves) for (const t of a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1)) fixed.add(t);
  const xs = a.tiles.map(t => t[0]), ys = a.tiles.map(t => t[1]), X0 = Math.min(...xs), X1 = Math.max(...xs) + 2, Y0 = Math.min(...ys), Y1 = Math.max(...ys) + 2;
  const ZMAX = Math.min(Math.max(...a.tiles.map(t => t[2])), Math.max(2, Math.max(...a.tiles.map(t => t[2]))));
  const tried = [];
  const windows = [];
  for (const W of [12, 13]) { const span = X1 - X0, cut = span - W; if (cut <= 0) { windows.push([X0, X1]); continue; }
    const l = Math.floor(cut / 2); windows.push([X0 + l, X0 + l + W]); if (cut % 2 || W === 13) windows.push([X0 + cut - l, X0 + cut - l + W]); }
  const rowsWin = Y1 - Y0 > 16 ? [[Y0 + 2, Y1], [Y0, Y1 - 2], [Y0 + 1, Y1 - 1]] : [[Y0, Y1]];
  for (const [L, Rr] of windows) for (const [T0, B0] of rowsWin) {
    const inside = t => t[0] >= L && t[0] + 2 <= Rr && t[1] >= T0 && t[1] + 2 <= B0;
    const loose = new Set(a.tiles.map((t, i) => inside(t) ? null : i).filter(i => i != null));
    // cascade: whatever rests on a loose tile is loose too
    for (let ch = true; ch;) { ch = false; for (let i = 0; i < n; i++) { if (loose.has(i) || !a.tiles[i][2]) continue; const rest = a.tiles.filter((q, j) => !loose.has(j)); if (!supportedAt(rest, a.tiles[i], -1)) { loose.add(i); ch = true; } } }
    const hit = [...loose].filter(i => fixed.has(i));
    if (hit.length) { tried.push({ window: [L, Rr, T0, B0], why: 'a special, wrong move or clock-route tile is outside: ' + hit.join(',') }); continue; }
    // place the loose tiles back, best spot first; mirror axis = window centre
    const T = a.tiles.map((t, i) => loose.has(i) ? null : t.slice()), m = L + Rr - 2, left = [...loose];
    // never put a tile on, or right beside, a special, a wrong move or a tile of the released route to the clock
    const guardT = [...new Set([a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number), ...(before.card?.trap?.baits || []).flatMap(b => b.tiles), ...a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1)])].filter(i => !loose.has(i)).map(i => a.tiles[i]);
    const nearGuard = p => guardT.some(q => (p[2] === q[2] + 1 && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2) || (p[2] === q[2] && Math.abs(p[1] - q[1]) < 2 && Math.abs(p[0] - q[0]) === 2));
    const placed = () => T.filter(Boolean);
    // tiles of the route to the clock go back last, on a spot that is free from the start (nothing on it, one side open),
    // and are then guarded like the others, so the clock stays as near as it was
    const routeSet = new Set(a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1));
    left.sort((i, j) => (routeSet.has(i) - routeSet.has(j)) || (a.tiles[i][2] - a.tiles[j][2]));
    const openSide = (cur, p) => !cur.some(q => q[2] === p[2] && Math.abs(q[1] - p[1]) < 2 && q[0] - p[0] === -2) || !cur.some(q => q[2] === p[2] && Math.abs(q[1] - p[1]) < 2 && q[0] - p[0] === 2);
    let guard = 0;
    while (left.length && guard++ < 400) {
      const cur = placed(), isRoute = routeSet.has(left[0]); let best = null;
      for (let z = 0; z <= ZMAX; z++) for (let y = T0; y + 2 <= B0; y++) for (let x = L; x + 2 <= Rr; x++) {
        const p = [x, y, z]; if (!brickSpot(cur, p) || nearGuard(p) || (isRoute && !openSide(cur, p))) continue;
        const mp_ = [m - x, y, z], mirrorTaken = cur.some(q => same(q, mp_)), selfMirror = m - x === x;
        const edge = z > 0 && (() => { const row = cur.filter(q => q[2] === 0 && Math.abs(q[1] - y) < 2); if (!row.length) return true; return x <= Math.min(...row.map(q => q[0])) || x >= Math.max(...row.map(q => q[0])); })();
        const sc = (mirrorTaken || selfMirror ? -40 : 0) + z * 6 + Math.abs(x + 1 - (L + Rr) / 2) * 0.6 + (edge ? 25 : 0) + (opts.prefer ? opts.prefer(p) : 0);
        if (!best || sc < best.sc) best = { p, sc };
      }
      if (!best) break;
      const i = left.shift(); T[i] = best.p; if (isRoute) guardT.push(best.p);
    }
    if (left.length) { tried.push({ window: [L, Rr, T0, B0], loose: loose.size, why: 'no brick spot for ' + left.length + ' tiles' }); continue; }
    let d = { ...clone(a), tiles: T };
    if (!G.valid(T)) { tried.push({ window: [L, Rr, T0, B0], why: 'invalid geometry' }); continue; }
    const fixedT = new Set([a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number), ...(before.card?.trap?.baits || []).flatMap(b => b.tiles)]);
    if (SEP.closeTwins(d).visible > base.twins) d = untwin(d, base.twins, fixedT).d;
    const s1 = shape(T);
    const sol = route(d); if (!sol) { tried.push({ window: [L, Rr, T0, B0], loose: loose.size, shape: strip(s1), why: 'no full winning route', design: process.env.DEBUG ? d : undefined }); continue; }
    d.solution = sol;
    const keep = Array.from({ length: n }, (_, i) => i), cert = Q.certify(before, d, keep, base);
    const rec = { window: [L, Rr, T0, B0], loose: loose.size, moved: [...loose].map(i => ({ tile: i, from: a.tiles[i], to: T[i], face: a.faces[i] })), shape: strip(s1), ok: cert.ok && s1.straight === 0, errors: cert.errors, footprint: cert.footprint && +cert.footprint.tilePx.toFixed(1) };
    tried.push(rec);
    if (rec.ok) return save({ level, ok: true, method: 'trim and use the middle', source: c.source, design: d, keep, ...rec, certificate: cert, tried });
  }
  return save({ level, ok: false, method: 'trim and use the middle', source: c.source, tried });
}
// upper layers are drawn leaning up-left (footprint.js: x/2 - z*0.14); a put-back tile must not stick out further than the pile does
const leanOk = (cur, p) => { const lx = t => t[0] / 2 - t[2] * 0.14, ly = t => t[1] / 2 * 1.24 - t[2] * 0.14; return lx(p) >= Math.min(...cur.map(lx)) - 1e-9 && ly(p) >= Math.min(...cur.map(ly)) - 1e-9; };
// ---------- cut a strip out of the middle and use the hollow (from the released board) ----------
// Dennis on 288: "trim and use the middle". A strip one tile wide is cut out of the middle, the right part slides left onto
// the left part (every relation inside each half stays), and the cut tiles go back brick-wise, into the hollow middle first.
// Where two half-offset tiles straddle the strip, one of them is cut. A trap tile in the strip: try the next strip.
function cutMiddleRun(level, opts = {}) {
  const c = candidate(level), before = P.original(c.source), a = before.design, base = P.prepare(before), n = a.tiles.length;
  const sp = [a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number)], bait = (before.card?.trap?.baits || []).flatMap(b => b.tiles);
  const g = E.game(clone(a)), core = new Set([...sp, ...bait, ...a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1)]);
  for (const s of [...sp, ...bait]) { for (const k of ['above', 'left', 'right']) for (const u of g.nb[k][s] || []) core.add(u); if (g.iceH && g.iceH[s]) for (const u of g.iceNb[s]) core.add(u); }
  const xs = a.tiles.map(t => t[0]), X0 = Math.min(...xs), X1 = Math.max(...xs) + 2, ys = a.tiles.map(t => t[1]), Y0 = Math.min(...ys), Y1 = Math.max(...ys) + 2;
  const ZMAX = Math.max(...a.tiles.map(t => t[2])), mid = Math.floor((X0 + X1) / 2) - 1, tried = [];
  for (const s of [mid, mid - 1, mid + 1, mid - 2, mid + 2]) {
    const loose = new Set();
    a.tiles.forEach((t, i) => { if (t[0] >= s && t[0] + 2 <= s + 2) loose.add(i); });
    // half-offset pairs straddling the strip: one goes
    a.tiles.forEach((t, i) => { if (t[0] !== s - 1) return; const j = a.tiles.findIndex(q => q[2] === t[2] && q[1] === t[1] && q[0] === s + 1); if (j >= 0) loose.add(core.has(i) && !core.has(j) ? j : (!core.has(i) ? i : j)); });
    const T = a.tiles.map((t, i) => loose.has(i) ? null : (t[0] >= s + 1 ? [t[0] - 2, t[1], t[2]] : t.slice()));
    // overlaps after closing (rows that used both parities near the strip): the overlapping one goes too
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (T[i] && T[j] && over(T[i], T[j])) { const k = core.has(i) ? j : i; loose.add(k); T[k] = null; }
    for (let ch = true; ch;) { ch = false; for (let i = 0; i < n; i++) if (T[i] && T[i][2] && !supportedAt(T.filter((q, j) => q && j !== i), T[i], -1)) { loose.add(i); T[i] = null; ch = true; } }
    const hit = [...loose].filter(i => core.has(i));
    if (hit.length) { tried.push({ strip: s, why: 'trap tile in the strip: ' + hit.join(',') }); continue; }
    const W0 = X0, W1 = X1 - 2, m = W0 + W1 - 2, left = [...loose].sort((i, j) => a.tiles[i][2] - a.tiles[j][2]);
    const guardT = [...core].map(i => T[i]).filter(Boolean);
    const nearGuard = p => guardT.some(q => (p[2] === q[2] + 1 && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2) || (p[2] === q[2] && Math.abs(p[1] - q[1]) < 2 && Math.abs(p[0] - q[0]) === 2));
    for (let guard = 0; left.length && guard < 400; guard++) {
      const cur = T.filter(Boolean), i = left[0]; let best = null;
      for (let z = 0; z <= ZMAX; z++) { if (z > 2 && z > a.tiles[i][2]) continue; for (let y = Y0; y + 2 <= Y1; y++) for (let x = W0; x + 2 <= W1; x++) {
        const p = [x, y, z]; if (!brickSpot(cur, p) || nearGuard(p) || !leanOk(cur, p)) continue;
        const mir = cur.some(q => same(q, [m - x, y, z])) || m - x === x;
        const sc = z * 10 - (mir ? 30 : 0) + Math.abs(x + 1 - (W0 + W1) / 2) * 0.5;
        if (!best || sc < best.sc) best = { p, sc };
      } }
      if (!best) break;
      T[left.shift()] = best.p;
    }
    if (left.length) { tried.push({ strip: s, loose: loose.size, why: 'no brick spot for ' + left.length + ' tiles' }); continue; }
    if (!G.valid(T)) { tried.push({ strip: s, why: 'invalid geometry' }); continue; }
    let d = { ...clone(a), tiles: T };
    if (SEP.closeTwins(d).visible > base.twins) d = untwin(d, base.twins, new Set([...sp, ...bait, ...a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1)])).d;
    const s1 = shape(T);
    const sol = route(d); if (!sol) { tried.push({ strip: s, loose: loose.size, shape: strip(s1), why: 'no full winning route' }); continue; }
    d.solution = sol;
    const keep = Array.from({ length: n }, (_, i) => i), cert = Q.certify(before, d, keep, base);
    const rec = { strip: s, loose: loose.size, moved: [...loose].map(i => ({ tile: i, from: a.tiles[i], to: T[i], face: a.faces[i] })), shape: strip(s1), ok: cert.ok && s1.straight === 0, errors: cert.errors, footprint: cert.footprint && +cert.footprint.tilePx.toFixed(1) };
    tried.push(rec);
    if (rec.ok) return save({ level, ok: true, method: 'cut the middle strip and use the hollow', source: c.source, design: d, keep, ...rec, certificate: cert, tried });
  }
  return save({ level, ok: false, method: 'cut the middle strip', source: c.source, tried });
}

// ---------- slide the bands (from the released board; Dennis's editor work of 2026-11-16) ----------
// 288: "move the second to lowest row to the right"; 278: two bottom-left tiles into the hollow, "then move the pile to the
// middle". The board is split into horizontal bands that no tile crosses (all layers). Sliding a whole band sideways keeps
// every relation inside it (on, beside, thaws), and bands do not touch each other, so the game is the same. A band wider than
// the window loses its outer tiles on the side without trap tiles (with whatever rests on them); those go back brick-wise,
// into the hollow middle first. Every band is then centred. Rows may end up lined up under each other (as in Dennis's 288);
// nothing is stacked straight on a tile.
function bandRun(level, opts = {}) {
  const c = candidate(level), before = P.original(c.source), a = before.design, base = P.prepare(before), n = a.tiles.length;
  const sp = [a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number)], bait = (before.card?.trap?.baits || []).flatMap(b => b.tiles);
  const g = E.game(clone(a)), core = new Set([...sp, ...bait, ...a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1)]);
  for (const s of [...sp, ...bait]) { for (const k of ['above', 'left', 'right']) for (const u of g.nb[k][s] || []) core.add(u); if (g.iceH && g.iceH[s]) for (const u of g.iceNb[s]) core.add(u); }
  const hard = new Set([...sp, ...bait]);   // relaxed: only specials and wrong moves may never be cut
  // bands: merge overlapping y-intervals
  const iv = [...new Set(a.tiles.map(t => t[1]))].sort((p, q) => p - q), bands = [];
  for (const y of iv) { const last = bands[bands.length - 1]; if (last && y < last.y1) last.y1 = Math.max(last.y1, y + 2); else bands.push({ y0: y, y1: y + 2 }); }
  // ice counts neighbours in the rows just above and below (same layer): bands linked that way slide together
  for (let ch = true; ch;) { ch = false; const bo = t => bands.findIndex(b => t[1] >= b.y0 && t[1] < b.y1);
    for (const i of Object.keys(a.obst.ice).map(Number)) for (const j of g.iceNb[i] || []) { const p = bo(a.tiles[i]), q = bo(a.tiles[j]); if (p !== q) { const lo = Math.min(p, q), hi = Math.max(p, q); bands[lo].y1 = bands[hi].y1; bands.splice(lo + 1, hi - lo); ch = true; break; } } }
  const bandOf = t => bands.findIndex(b => t[1] >= b.y0 && t[1] < b.y1);
  const members = bands.map((_, k) => a.tiles.map((t, i) => bandOf(t) === k ? i : null).filter(i => i != null));
  const tried = [], ZMAX = Math.max(...a.tiles.map(t => t[2]));
  // per band, the ways to make it fit: trim 0..2 half-units on the left and/or right (with cascade), no trap tile cut
  const trims = (k, W) => {
    const ids = members[k], xs = ids.map(i => a.tiles[i][0]), lo = Math.min(...xs), hi = Math.max(...xs) + 2, out = [];
    for (let tl = 0; tl <= 3; tl++) for (let tr = 0; tr <= 3; tr++) {
      const cut = new Set(ids.filter(i => a.tiles[i][0] < lo + tl || a.tiles[i][0] + 2 > hi - tr));
      for (let ch = true; ch;) { ch = false; for (const i of ids) { if (cut.has(i) || !a.tiles[i][2]) continue; const rest = ids.filter(j => !cut.has(j)).map(j => a.tiles[j]); if (!supportedAt(rest, a.tiles[i], -1)) { cut.add(i); ch = true; } } }
      const left = ids.filter(i => !cut.has(i)); if (!left.length || [...cut].some(i => (opts.relaxed ? hard : core).has(i))) continue;
      // groups inside the band that do not touch (any layer): their gaps may close to half a tile, nothing gains a neighbour
      const segs = []; for (const i of left.slice().sort((p, q) => a.tiles[p][0] - a.tiles[q][0])) { const t = a.tiles[i], s = segs[segs.length - 1]; if (s && t[0] <= s.hi) { s.ids.push(i); s.hi = Math.max(s.hi, t[0] + 2); } else segs.push({ ids: [i], lo: t[0], hi: t[0] + 2 }); }
      // merge groups that overlap after sorting by lo (a later tile may reach back)
      for (let ch = true; ch;) { ch = false; for (let s = 0; s + 1 < segs.length; s++) if (segs[s + 1].lo < segs[s].hi) { segs[s].ids.push(...segs[s + 1].ids); segs[s].hi = Math.max(segs[s].hi, segs[s + 1].hi); segs.splice(s + 1, 1); ch = true; break; } }
      const w0 = segs[segs.length - 1].hi - segs[0].lo, gaps = segs.slice(1).map((s, j) => s.lo - segs[j].hi), slack = gaps.reduce((p, q) => p + q - 1, 0);
      let need = Math.max(0, w0 - W); if (need > slack) continue;
      // close the gaps evenly, middle ones first
      const red = gaps.map(() => 0), order = gaps.map((_, j) => j).sort((p, q) => Math.abs(p - (gaps.length - 1) / 2) - Math.abs(q - (gaps.length - 1) / 2));
      while (need > 0) { let moved = false; for (const j of order) { if (need && gaps[j] - red[j] > 1) { red[j]++; need--; moved = true; } } if (!moved) break; }
      const shift = new Map(); let acc = 0; segs.forEach((s, j) => { if (j) acc += red[j - 1]; for (const i of s.ids) shift.set(i, -acc); });
      const nx = left.map(i => a.tiles[i][0] + shift.get(i)), lo2 = Math.min(...nx), w = Math.max(...nx) + 2 - lo2;
      if (w > W) continue;
      out.push({ cut: [...cut], lo: lo2, w, shift });
    }
    const best = new Map(); for (const o of out) { const key = o.cut.slice().sort((p, q) => p - q).join(','); if (!best.has(key)) best.set(key, o); }
    const cost = o => o.cut.length + 10 * o.cut.filter(i => core.has(i)).length;   // cut ordinary tiles before route or neighbour tiles
    const side = o => o.cut.reduce((sum,i) => sum + a.tiles[i][0], 0);
    return [...best.values()].sort((p, q) => cost(p) - cost(q) || (opts.trimOrder === 'right' ? side(q)-side(p) : 0)).slice(0, opts.trimOptions || 4);
  };
  for (const W of opts.widths || [12, 13]) {
    const opt = bands.map((_, k) => trims(k, W));
    if (opt.some(o => !o.length)) { tried.push({ W, why: 'band ' + opt.findIndex(o => !o.length) + ' cannot fit without cutting a trap tile' }); continue; }
    // combinations, fewest cut tiles first (capped)
    let combos = [[]]; for (const o of opt) { const next = []; for (const cmb of combos) for (const x of o) next.push(cmb.concat([x])); combos = next.sort((p, q) => p.reduce((s, x) => s + x.cut.length + 10 * x.cut.filter(i => core.has(i)).length, 0) - q.reduce((s, x) => s + x.cut.length + 10 * x.cut.filter(i => core.has(i)).length, 0)).slice(0, 24); }
    for (const cmb of combos.slice(0, opts.tries || 8)) for (const parity of [0, 1]) {
      const T = a.tiles.map(t => t.slice()), loose = new Set();
      cmb.forEach((o, k) => { for (const i of o.cut) { loose.add(i); T[i] = null; } let sh = Math.floor((W - o.w) / 2) - o.lo; if ((W - o.w) % 2 && parity) sh += 1; for (const i of members[k]) if (T[i]) T[i] = [T[i][0] + (o.shift.get(i) || 0) + sh, T[i][1], T[i][2]]; });
      const m = W - 2, left = [...loose].sort((i, j) => a.tiles[i][2] - a.tiles[j][2]);
      const guardT = [...core].map(i => T[i]).filter(Boolean);
      const nearGuard = p => guardT.some(q => (p[2] === q[2] + 1 && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2) || (p[2] === q[2] && Math.abs(p[1] - q[1]) < 2 && Math.abs(p[0] - q[0]) === 2));
      const Y0 = Math.min(...a.tiles.map(t => t[1])), Y1 = Math.max(...a.tiles.map(t => t[1])) + 2;
      for (let guard = 0; left.length && guard < 400; guard++) {
        const cur = T.filter(Boolean), i = left[0]; let best = null;
        for (let z = 0; z <= ZMAX; z++) { if (z > 2 && z > a.tiles[i][2]) continue; for (let y = Y0; y + 2 <= Y1; y++) for (let x = 0; x + 2 <= W; x++) {
          const p = [x, y, z]; if (!brickSpot(cur, p) || nearGuard(p) || !leanOk(cur, p)) continue;
          const mir = cur.some(q => same(q, [m - x, y, z])) || m - x === x;
          const sc = z * 10 - (mir ? 30 : 0) + Math.abs(x + 1 - W / 2) * 0.5 + Math.abs(y - a.tiles[i][1]) * 0.2;
          if (!best || sc < best.sc) best = { p, sc };
        } }
        if (!best) break;
        T[left.shift()] = best.p;
      }
      const tag = { W, parity, cut: cmb.map(o => o.cut.length) };
      if (left.length) { tried.push({ ...tag, why: 'no brick spot for ' + left.length + ' tiles' }); continue; }
      if (!G.valid(T)) { tried.push({ ...tag, why: 'invalid geometry' }); continue; }
      let d = { ...clone(a), tiles: T };
      if (SEP.closeTwins(d).visible > base.twins) d = untwin(d, base.twins, new Set([...sp, ...bait, ...a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1)])).d;
      const s1 = shape(T);
      const sol = route(d); if (!sol) { tried.push({ ...tag, shape: strip(s1), why: 'no full winning route', design: process.env.DEBUG ? d : undefined }); continue; }
      d.solution = sol;
      const keep = Array.from({ length: n }, (_, i) => i), cert = Q.certify(before, d, keep, base);
      const rec = { ...tag, design: process.env.DEBUG ? d : undefined, loose: loose.size, moved: [...loose].map(i => ({ tile: i, from: a.tiles[i], to: T[i], face: a.faces[i] })), shape: strip(s1), ok: cert.ok && s1.straight === 0, errors: cert.errors, footprint: cert.footprint && +cert.footprint.tilePx.toFixed(1) };
      tried.push(rec);
      if (rec.ok) return save({ level, ok: true, method: 'bands slid to the middle, outer tiles into the hollow', source: c.source, keep, ...rec, design: d, certificate: cert, tried });
    }
  }
  return save({ level, ok: false, method: 'bands', source: c.source, tried });
}

// ---------- restack the finish tiles (from the candidate board) ----------
// The candidate's base layer and its whole trap stay as they are: specials, wrong moves, the route to the clock, the tiles
// on, beside or thawing a special or a wrong move, and everything that holds those up. Every other upper tile is lifted
// off and stacked back brick-wise (see brickSpot): mirror pairs first, then low and central, never on or beside the trap.
function restackRun(level, opts = {}) {
  const c = candidate(level), before = P.original(c.source), base = P.prepare(before), d0 = c.d, n = d0.tiles.length;
  const ids = new Map(c.keep.map((id, i) => [id, i])), g = E.game(clone(d0));
  const sp = [d0.clock.i, ...d0.obst.keys, ...d0.obst.locks, ...Object.keys(d0.obst.ice).map(Number)];
  const bait = (before.card?.trap?.baits || []).flatMap(b => b.tiles).map(t => ids.get(t)).filter(x => x != null);
  const routeT = d0.solution.slice(0, d0.solution.indexOf(d0.clock.i) + 1);
  const core = new Set([...sp, ...bait, ...routeT]);
  for (const s of [...sp, ...bait]) { for (const k of ['above', 'left', 'right']) for (const u of g.nb[k][s] || []) core.add(u); if (g.iceH && g.iceH[s]) for (const u of g.iceNb[s]) core.add(u); }
  const keepT = new Set(core);
  // whatever holds a kept tile up stays too
  for (let ch = true; ch;) { ch = false; for (const i of [...keepT]) { const t = d0.tiles[i]; if (!t[2]) continue; d0.tiles.forEach((q, j) => { if (!keepT.has(j) && q[2] === t[2] - 1 && Math.abs(q[0] - t[0]) < 2 && Math.abs(q[1] - t[1]) < 2) { keepT.add(j); ch = true; } }); } }
  const loose = d0.tiles.map((t, i) => (t[2] > 0 && !keepT.has(i)) ? i : null).filter(i => i != null);
  const xs = d0.tiles.map(t => t[0]), ys = d0.tiles.map(t => t[1]);
  const L = Math.min(...xs), Rr = Math.max(...xs) + 2, T0 = Math.min(...ys), B0 = Math.max(...ys) + 2, m = L + Rr - 2;
  const ZMAX = Math.max(...d0.tiles.map(t => t[2]));
  const tried = [];
  for (const variant of [0, 1, 2]) {
    const T = d0.tiles.map((t, i) => loose.includes(i) ? null : t.slice()), left = loose.slice().sort((i, j) => d0.tiles[i][2] - d0.tiles[j][2]);
    const guardT = [...core].map(i => d0.tiles[i]);
    const nearGuard = p => guardT.some(q => (p[2] === q[2] + 1 && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2) || (p[2] === q[2] && Math.abs(p[1] - q[1]) < 2 && Math.abs(p[0] - q[0]) === 2));
    let guard = 0;
    while (left.length && guard++ < 400) {
      const cur = T.filter(Boolean); let best = null;
      for (let z = 1; z <= ZMAX; z++) for (let y = T0; y + 2 <= B0; y++) for (let x = L; x + 2 <= Rr; x++) {
        const p = [x, y, z]; if (!brickSpot(cur, p) || nearGuard(p)) continue;
        const mirrorTaken = cur.some(q => same(q, [m - x, y, z])), selfMirror = m - x === x;
        const edge = (() => { const row = cur.filter(q => q[2] === 0 && Math.abs(q[1] - y) < 2); if (!row.length) return true; return x <= Math.min(...row.map(q => q[0])) || x >= Math.max(...row.map(q => q[0])); })();
        const orig = d0.tiles[left[0]], dist = Math.abs(x - orig[0]) + Math.abs(y - orig[1]);
        const sc = (mirrorTaken || selfMirror ? -40 : 0) + z * [6, 3, 10][variant] + Math.abs(x + 1 - (L + Rr) / 2) * [0.6, 0.2, 0.6][variant] + (edge ? 25 : 0) + dist * [0.3, 1, 0][variant];
        if (!best || sc < best.sc) best = { p, sc };
      }
      if (!best) break;
      T[left.shift()] = best.p;
    }
    if (left.length) { tried.push({ variant, loose: loose.length, why: 'no brick spot for ' + left.length + ' tiles' }); continue; }
    if (!G.valid(T)) { tried.push({ variant, why: 'invalid geometry' }); continue; }
    let d = { ...clone(d0), tiles: T };
    const fixedT = new Set([...sp, ...bait]); if (SEP.closeTwins(d).visible > base.twins) d = untwin(d, base.twins, fixedT).d;
    const s1 = shape(T);
    const sol = route(d); if (!sol) { tried.push({ variant, loose: loose.length, shape: strip(s1), why: 'no full winning route' }); continue; }
    d.solution = sol;
    const cert = Q.certify(before, d, c.keep, base);
    const rec = { variant, loose: loose.length, moved: loose.filter(i => !same(T[i], d0.tiles[i])).map(i => ({ tile: i, from: d0.tiles[i], to: T[i], face: d0.faces[i] })), shape: strip(s1), ok: cert.ok && s1.straight === 0, errors: cert.errors, footprint: cert.footprint && +cert.footprint.tilePx.toFixed(1), pictureSwaps: d.faces.filter((f, i) => f !== d0.faces[i]).length / 2 };
    tried.push(rec);
    if (rec.ok) return save({ level, ok: true, method: 'restack the finish tiles', source: c.source, design: d, keep: c.keep, ...rec, certificate: cert, tried });
  }
  return save({ level, ok: false, method: 'restack the finish tiles', source: c.source, tried });
}
const strip = s => ({ straight: s.straight, stray: s.stray, edge: s.edge, mirror: s.mirror });
function save(r) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `level-${r.level}.json`), JSON.stringify(r, null, 1)); return r; }

module.exports = { candidate, shape, run, trimRun, restackRun, cutMiddleRun, bandRun, route, brickSpot, supportedAt, freeSpot, untwin, strip: s => ({ straight: s.straight, stray: s.stray, edge: s.edge, mirror: s.mirror }), CF };
if (require.main === module) {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  for (const lv of (arg('--levels') || '').split(',').filter(Boolean).map(Number)) {
    const t0 = Date.now();
    if (process.argv.includes('--restack')) {
      const r = restackRun(lv);
      console.log(JSON.stringify({ level: lv, ok: r.ok, method: 'restack', loose: r.loose, moved: r.moved && r.moved.length, swaps: r.pictureSwaps, shape: r.shape, px: r.footprint, tried: r.ok ? undefined : r.tried.map(t => t.variant + ' ' + (t.why || (t.errors || []).join(',') + ' ' + JSON.stringify(t.shape))), s: Math.round((Date.now() - t0) / 1000) }));
      continue;
    }
    if (process.argv.includes('--trim')) {
      let r = trimRun(lv); if (!r.ok) { const r2 = trimRun(lv, { routeMoves: true }); r2.tried = r.tried.concat(r2.tried); r = r2; }
      console.log(JSON.stringify({ level: lv, ok: r.ok, method: 'trim', window: r.window, loose: r.loose, shape: r.shape, px: r.footprint, tried: r.ok ? undefined : r.tried.map(t => (t.window || []).join('/') + ' ' + (t.why || (t.errors || []).join(',') + ' ' + JSON.stringify(t.shape))), s: Math.round((Date.now() - t0) / 1000) }));
      continue;
    }
    const r = run(lv, { loose: process.argv.includes('--loose') });
    const last = r.tried[r.tried.length - 1] || {};
    console.log(JSON.stringify({ level: lv, ok: r.ok, pass: r.pass, moves: r.moves && r.moves.length, shape: r.shape || strip(last.shape || {}), errors: r.ok ? [] : r.tried.map(t => t.pass + ': ' + (t.why || (t.errors || []).join(','))), s: Math.round((Date.now() - t0) / 1000) }));
  }
}
