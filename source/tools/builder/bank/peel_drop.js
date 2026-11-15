#!/usr/bin/env node
'use strict';
/* peel_drop.js: narrow a released pile by PEELING its outer edge and DROPPING those tiles (Dennis 2026-11-15: "Dropping finish tiles ...
   Then use it. Also peel the lower layers since they will be mostly used for after trap finish." and "The check shouldnt require the
   same pictures only the pictures that interconnect with the trap or are in some other way connected." 6.5 wide is fine (58+ px);
   no nine rows).
   For a side that makes the pile too wide (or a ninth row): the lowest tiles of that edge (kind "base": the bottom layer of the outer
   column/row; kind "band": every layer of the outer column/row) go, plus whatever then rests on nothing. Nothing of the trap may go:
   not the clock, a lock, key or ice, not their thawing neighbours or covers, not the route to the clock, not a bait, and no tile whose
   picture any of those tiles shows. The dropped tiles are made into pairs by exchanging pictures with other tiles outside the trap
   (an odd count drops one more loose tile from the top). Nothing moves; the remaining pile only gets re-centred.
   Checks against the released board (tile numbers mapped): a strict winning route that starts with the released route to the clock;
   the same shortest clock route and spare; the same cover/thaw relations between trap tiles; the same special tiles needed before each
   special; the same effect of removing each lock or ice on the shortest clock route; every authored wrong move priced the same
   (verify_trap_mixes.reprice); readable special badges stay readable; no new visible twins; at least 58 px, at most 6.5 wide, 8 rows.
     node source/tools/builder/loop/heavy.js --label peel --cores 8 -- node source/tools/builder/bank/peel_drop.js --levels 251,253 [--workers 8]
   Output: source/analysis/builder/footprint60/peel-drop/level-<n>.json, report.jsonl */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const E = require('../engine.js'), F = require('../footprint.js'), I = require('../preserve_intent.js'), P = require('./narrow_proof.js'), SEP = require('./separate.js'), Tl = require('./tail.js');
const SR = require('../chained_special_readability.js'), V = require('../verify_trap_mixes.js'), Mo = require('./narrow_placement_model.js');
const OUT = path.join(P.DIR, '../peel-drop');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const clone = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ext = T => { const X = T.map(p => p[0]), Y = T.map(p => p[1]); return { x0: Math.min(...X), x1: Math.max(...X), y0: Math.min(...Y), y1: Math.max(...Y) }; };

function variants(a, M, protectedFaces, special) {
  const n = a.tiles.length, e = ext(a.tiles), wide = e.x1 - e.x0 + 2 > 13, tall = e.y1 - e.y0 + 2 > 16, out = [];
  const sides = [];
  const W = wide ? [['left', p => p[0] === e.x0, p => p[0] <= e.x0 + 1], ['right', p => p[0] === e.x1, p => p[0] >= e.x1 - 1]] : [null];
  const H = tall ? [['top', p => p[1] === e.y0, p => p[1] <= e.y0 + 1], ['bottom', p => p[1] === e.y1, p => p[1] >= e.y1 - 1]] : [null];
  for (const w of W) for (const h of H) for (const kind of ['base', 'band']) {
    const pick = new Set();
    for (const s of [w, h]) if (s) a.tiles.forEach((p, i) => { if (kind === 'base' ? s[1](p) && p[2] === 0 : s[2](p)) pick.add(i); });
    // also everything resting on a dropped tile, layer by layer
    for (let ch = true; ch;) { ch = false; const rest = a.tiles.filter((p, i) => !pick.has(i)); a.tiles.forEach((p, i) => { if (!pick.has(i) && p[2] > 0 && !Mo.supported(rest.filter(q => q !== p), p)) { pick.add(i); ch = true; } }); }
    out.push({ name: [w && w[0], h && h[0]].filter(Boolean).join('+') + ' ' + kind, drop: [...pick] });
  }
  return out.filter(v => v.drop.length).sort((p, q) => p.drop.length - q.drop.length);
}

// SHIFT: per base line, one ordinary tile is dropped and the tiles between it and the edge slide half a tile inward, so the edge
// column (row) is empty and the pile is 6.5 wide (8 rows). The layers above do not move. A base tile of the trap only slides when the
// same trap tiles lie on it afterwards.
function variantsShift(a, M, protectedFaces, special) {
  const n = a.tiles.length, e = ext(a.tiles), out = [];
  const plan = [];
  const small = !F.measure(a, { minimum: 58 }).ok;
  if (e.x1 - e.x0 + 2 > 13 || (small && e.x1 - e.x0 + 2 > 11)) plan.push([[0, +1, e.x0], [0, -1, e.x1]]);
  if (e.y1 - e.y0 + 2 > 16) plan.push([[1, +1, e.y0], [1, -1, e.y1]]);
  const ups = (T, i, v, ax) => T.map((q, j) => q[2] === 1 && M.has(j) && Math.abs(q[ax] - v) < 2 && Math.abs(q[1 - ax] - T[i][1 - ax]) < 2 ? j : -1).filter(j => j >= 0).join(',');
  let pickOf = () => 0, lineNo = 0;
  const lo = [e.x0, e.y0], hi = [e.x1, e.y1];
  const sideOpts = ([ax, dir, edge], T0) => {
    const lines = new Map(); T0.forEach((p, i) => { if (p[2] === 0) { const k = p[1 - ax]; if (!lines.has(k)) lines.set(k, []); lines.get(k).push(i); } });
    const moves = new Map(), drop = [];
    for (const ids of lines.values()) {
      ids.sort((i, j) => dir * (T0[i][ax] - T0[j][ax]));                     // from the edge inward
      if (T0[ids[0]][ax] !== edge) continue;                                  // this line does not reach the edge
      const opts = [];
      for (let k = 0; k <= ids.length; k++) {
        // tiles ids[0..k-1] slide inward; then either a gap is reached or ids[k] is dropped
        const run = ids.slice(0, k);
        if (run.some(i => { const v = T0[i][ax] + dir; return v < lo[ax] || v > hi[ax]; })) break;
        if (!run.every(i => !M.has(i) || ups(T0, i, T0[i][ax] + dir, ax) === ups(T0, i, T0[i][ax], ax))) break;
        if (k === ids.length || (k > 0 && Math.abs(T0[ids[k]][ax] - T0[ids[k - 1]][ax]) >= 3)) { opts.push({ slide: run, drop: [] }); if (k < ids.length) continue; break; }
        const o = ids[k];
        if (!M.has(o) && !special.has(o) && !protectedFaces.has(a.faces[o])) opts.push({ slide: run, drop: [o] });
      }
      // keep the first option under which every tile resting on this line stays supported
      const lineSet = new Set(ids), above = T0.map((q, j) => j).filter(j => T0[j][2] === 1 && ids.some(i => Math.abs(T0[j][0] - T0[i][0]) < 2 && Math.abs(T0[j][1] - T0[i][1]) < 2));
      const good = [];
      for (const o of opts) {
        const T = T0.map(p => p.slice()); for (const i of o.slide) T[i][ax] += dir;
        const live = T.filter((p, j) => !o.drop.includes(j) && p[2] === 0);
        if (above.every(j => o.drop.includes(j) || Mo.supported(live, T[j]))) good.push(o);
      }
      if (!good.length) return null;
      const best = good[pickOf(lineNo++, good.length)];
      for (const i of best.slide) moves.set(i, ax); drop.push(...best.drop);
    }
    return { moves, drop, dir };
  };
  if (!plan.length) return out;
  const per = plan.map(p => [[p[0]], [p[1]], [p[0], p[1]]]);
  const combos = per.length === 2 ? per[0].flatMap(x => per[1].map(y => x.concat(y))) : per[0];
  for (const sides of combos) {
   for (let combo = 0; combo < 24; combo++) {
    let r = combo * 2654435761 >>> 0; pickOf = (li, c) => combo === 0 ? 0 : combo <= 8 ? (li === combo - 1 ? Math.min(1, c - 1) : 0) : ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) % c); lineNo = 0;
    let T = a.tiles.map(p => p.slice()), drop = [], ok = true, moved = 0;
    for (const sd of sides) { const o = sideOpts(sd, T); if (!o) { ok = false; break; } for (const [i, ax] of o.moves) T[i][ax] += sd[1]; moved += o.moves.size; drop.push(...o.drop); }
    if (!ok) continue;
    // everything still standing on something, nothing overlapping
    const keep = [...Array(n).keys()].filter(i => !drop.includes(i));
    if (keep.some(i => T[i][2] > 0 && !Mo.supported(keep.filter(j => j !== i).map(j => T[j]), T[i]))) continue;
    if (keep.some(i => keep.some(j => j < i && T[i][2] === T[j][2] && Math.abs(T[i][0] - T[j][0]) < 2 && Math.abs(T[i][1] - T[j][1]) < 2))) continue;
    if (out.some(o => same(o.tiles, T) && same(o.drop, drop))) continue;
    out.push({ name: 'slide ' + sides.map(([ax, dir]) => ax ? (dir > 0 ? 'top' : 'bottom') : (dir > 0 ? 'left' : 'right')).join('+') + ' edge inward', drop, tiles: T, moved });
   }
  }
  return out.sort((p, q) => p.drop.length + p.moved / 4 - q.drop.length - q.moved / 4);
}

function attempt(before, v0, base, protectedFaces, special, seed = 0) {
  const v = { ...v0, seed };
  const a0 = before.design, a = v.tiles ? { ...a0, tiles: v.tiles } : a0, n = a.tiles.length, M = base.M, D = new Set(v.drop);
  if ([...D].some(i => M.has(i) || special.has(i))) return { why: 'trap tile on the edge' };
  if ([...D].some(i => protectedFaces.has(a.faces[i]))) return { why: 'trap picture on the edge' };
  const faces = a.faces.slice(), free = i => !D.has(i) && !M.has(i) && !special.has(i) && !protectedFaces.has(faces[i]);
  // an odd count: one more loose tile (nothing on it), nearest to the edge
  if (D.size % 2) {
    const onTop = i => a.tiles.some((q, j) => j !== i && !D.has(j) && q[2] === a.tiles[i][2] + 1 && Math.abs(q[0] - a.tiles[i][0]) < 2 && Math.abs(q[1] - a.tiles[i][1]) < 2);
    const c = [...Array(n).keys()].filter(i => free(i) && !onTop(i));
    if (!c.length) return { why: 'no loose tile for an odd count' };
    const ex = ext([...D].map(i => a.tiles[i])), cx = (ex.x0 + ex.x1) / 2, cy = (ex.y0 + ex.y1) / 2;
    c.sort((i, j) => Math.hypot(a.tiles[i][0] - cx, a.tiles[i][1] - cy) - Math.hypot(a.tiles[j][0] - cx, a.tiles[j][1] - cy)); D.add(c[0]);
  }
  // pair the dropped tiles up by exchanging pictures with tiles outside the trap
  for (let guard = 0; guard < 200; guard++) {
    const cnt = new Map(); for (const i of D) cnt.set(faces[i], (cnt.get(faces[i]) || 0) + 1);
    const odd = [...cnt].filter(([f, c]) => c % 2).map(([f]) => f); if (!odd.length) break;
    const f1 = odd[0], f2 = odd[1], d2 = [...D].find(i => faces[i] === f2), ts = [...Array(n).keys()].filter(i => !D.has(i) && faces[i] === f1 && free(i)), t = ts[(v.seed || 0) % Math.max(1, ts.length)];
    if (t == null) return { why: 'no free picture to pair the dropped tiles' };
    [faces[d2], faces[t]] = [faces[t], faces[d2]];
  }
  // the new board: kept tiles in their order
  const keep = [...Array(n).keys()].filter(i => !D.has(i)), map = new Map(keep.map((o, k) => [o, k])), mp = i => map.get(i);
  const ex = ext(keep.map(i => a.tiles[i]));
  const b = { tiles: keep.map(i => [a.tiles[i][0] - ex.x0, a.tiles[i][1] - ex.y0, a.tiles[i][2]]), faces: keep.map(i => faces[i]), down: (a.down || []).filter(i => map.has(i)).map(mp), gold: (a.gold || []).filter(i => map.has(i)).map(mp),
    obst: { ice: Object.fromEntries(Object.entries(a.obst.ice || {}).map(([k, h]) => [mp(+k), h])), locks: (a.obst.locks || []).map(mp), keys: (a.obst.keys || []).map(mp) }, clock: { i: mp(a.clock.i), n: a.clock.n } };
  const e2 = ext(b.tiles); if (e2.x1 - e2.x0 + 2 > 13) return { why: 'still wider than 6.5' }; if (e2.y1 - e2.y0 + 2 > 16) return { why: 'still nine rows' };
  const fp = F.measure(b, { minimum: 58 }); if (!fp.ok) return { why: 'footprint ' + fp.tilePx.toFixed(1) };
  // the winning route: the released route to the clock, then an exact search for the rest
  const A = before.design;
  const prefix = A.solution.slice(0, A.solution.indexOf(A.clock.i) + 1).map(mp), rest = a.solution.filter(i => map.has(i) && !prefix.includes(mp(i))).map(mp);
  const x = { ...b, solution: prefix.concat(rest) }, r = Tl.cappedTail(x, 3, { peek: false, nodes: 1500000, ms: 20000 });
  if (r.result !== 'win') return { why: 'finish ' + r.result };
  b.solution = r.solution;
  if (!E.replay(b, b.solution, { strict: true }).ok) return { why: 'strict replay' };
  // the trap, compared through the tile map
  const why = [], core = [...M].sort((p, q) => p - q), coreB = core.map(mp);
  const relA = P.relations(E.game(A), core).map(r0 => r0.slice(2)), relB = P.relations(E.game(b), coreB).map(r0 => r0.slice(2));
  if (!same(relA, relB)) why.push('trapRelations');
  const k = P.kOf(b); if (k !== base.k) why.push('clockMinimum ' + base.k + ' -> ' + k);
  const ablB = P.ablations(b).map(([kind, i, kk]) => [kind, i, kk]), ablA = base.abl.map(([kind, i, kk]) => [kind, mp(i), kk]);
  if (!same(ablA, ablB)) why.push('specialEffects');
  const depsB = I.prepare({ design: b, card: before.card }).roleDependencies, depsA = base.prep.roleDependencies.map(([g, ps]) => [mp(g), ps.map(mp).sort((p, q) => p - q)]);
  const norm = L => L.map(([g, ps]) => [g, ps.slice().sort((p, q) => p - q)]).sort((p, q) => p[0] - q[0]);
  if (!same(norm(depsA), norm(depsB))) why.push('specialRoleOrder');
  const prices = [];
  for (const bait of (before.card && before.card.trap && before.card.trap.baits) || []) {
    const o = V.reprice(A, base.k, bait.tiles, { nodes: 1000000, callMs: 10000 }), nx = V.reprice(b, base.k, bait.tiles.map(mp), { nodes: 1000000, callMs: 10000 });
    prices.push({ tiles: bait.tiles, before: o, after: nx });
    // Dennis 2026-11-15: the trap has to work, the finish may change. A wrong move must still be wrong at the real clock: it loses, or it
    // needs more moves than the spare, exactly as before (the exact number of extra moves may change with the finish).
    const spare = A.clock.n - base.k, bites = q => q.result === 'lose' || (q.result === 'win' && q.cost > spare);
    if (!o.exact || !nx.exact || bites(o) !== bites(nx)) why.push('baitPrice ' + bait.tiles.join(','));
  }
  const ra = SR.measure(A), rb = SR.measure(b);
  for (const q of ra.rows.filter(q => q.clear)) if (!rb.rows.some(z => z.tile === mp(q.tile) && z.kind === q.kind && z.clear)) why.push('badge ' + q.kind);
  if (SEP.closeTwins(b).visible > base.twins) why.push('visibleTwins');
  if (why.length) return { why: why.join(', ') };
  return { design: b, dropped: [...D], moved: v.moved || 0, picturesExchanged: faces.filter((f, i) => f !== a.faces[i]).length / 2, footprint: fp, prices, k, map: keep };
}

function one(level) {
  const before = P.original(level), a = before.design, base = P.prepare(before), f0 = F.measure(a, { minimum: 58 }), e0 = ext(a.tiles);
  if (f0.ok && e0.x1 - e0.x0 + 2 <= 13) return { level, ok: true, unchanged: true, px: f0.tilePx };
  const special = new Set([a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice || {}).map(Number)]);
  const protectedFaces = new Set([...base.M].map(i => a.faces[i]));
  const fails = {};
  for (const v of [...variantsShift(a, base.M, protectedFaces, special), ...variants(a, base.M, protectedFaces, special)]) {
    let r = null; for (let sd = 0; sd < 3; sd++) { r = attempt(before, v, base, protectedFaces, special, sd); if (r.design || /trap|footprint|wider|nine/.test(r.why)) break; }
    if (r.design) return { level, ok: true, how: v.name, dropped: r.dropped.length, moved: r.moved, picturesExchanged: r.picturesExchanged, before: f0.tilePx, footprint: r.footprint, design: r.design, prices: r.prices };
    const key = v.name + ' (' + v.drop.length + ')'; fails[key] = fails[key] ? fails[key] : r.why;
  }
  return { level, ok: false, fails, before: f0.tilePx };
}
module.exports = { one, attempt, variants };
if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  if (arg('one', null)) {
    let r; try { r = one(+arg('one')); } catch (e) { r = { level: +arg('one'), ok: false, error: String(e.stack || e).slice(0, 400) }; }
    if (r.ok && r.design) fs.writeFileSync(path.join(OUT, `level-${r.level}.json`), JSON.stringify(r));
    const { design, ...row } = r; fs.appendFileSync(path.join(OUT, 'report.jsonl'), JSON.stringify(row) + '\n');
    console.log(r.level, r.ok ? (r.unchanged ? 'already fits' : `NARROWED ${r.how}: ${r.before.toFixed(1)} -> ${r.footprint.tilePx.toFixed(1)} px, ${r.footprint.rows} rows, ${r.moved} tiles slid, ${r.dropped} tiles dropped, ${r.picturesExchanged} picture exchanges`) : 'no: ' + (r.error || JSON.stringify(r.fails)).slice(0, 400));
  } else {
    const levels = String(arg('levels', '')).split(',').filter(Boolean), W = +arg('workers', 8); let next = 0, run = 0;
    const go = () => { while (run < W && next < levels.length) { const lv = levels[next++]; run++; const c = cp.spawn(process.execPath, [__filename, '--one', lv], { stdio: 'inherit' });
      const tm = setTimeout(() => c.kill(), 900000); c.on('exit', () => { clearTimeout(tm); run--; go(); }); } }; go();
  }
}
