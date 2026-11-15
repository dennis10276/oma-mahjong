#!/usr/bin/env node
'use strict';
/* narrow.js: make a released pile one tile narrower (7 -> 6 wide) and at most eight rows, as a designed-looking shape, trap untouched.
   Dennis 2026-11-15: about 60 px tiles for 250-300 "without changing the levels too much especially the traps cant be changed",
   "The shape shouldnt be weird ... weirdly placed tiles" (on a freely repacked draft), then: "Do 3 and search for more ways to narrow
   it without changing too much". The tens stay as released.
   Why anything has to move: a pile 7 tiles wide is 54.5 px on the 392 px reference phone; 60 px needs 6 wide and at most 8 rows.

   GEOMETRY (no free repacking):
     1. one whole column of the pile is taken out and the part right of it slides one tile to the left; for a nine-row pile one whole
        row goes too and the part below slides up. Every column and row is tried; a column or row holding a tile of the trap is not
        used. Both parts keep every tile in place, so the shape stays the designed shape, only narrower.
     2. the tiles that were taken out (and tiles that collide or lose their support at the seam) go back as straight stacks on the
        pile, lowest first, nearest to the middle first, never on or beside a tile of the trap.
     The trap = clock, locks, keys, ice, their thawing neighbours, what lies on them, the baits, the route to the clock.
   PROOF (finish): a strict winning route with the same shortest clock route and spare (trap_mixes.retime; pictures of tiles outside
     the trap may be re-paired when the moved tiles would strand a picture), every special tile with the same special tiles on/under/
     thawing it and needing the same special tiles gone first (as preserve_intent.js), removing any single lock or ice has the same
     effect on the shortest clock route as before, the board's own trap proof where it has one (trap_stories / trap_mixes), no new
     visible twins together, and the 60 px footprint (58 px floor with eight rows).
     node source/tools/builder/loop/heavy.js --label narrow --cores 8 -- node source/tools/builder/bank/narrow.js --levels 251,252 [--workers 8] [--ms 240000]
   Output: source/analysis/builder/footprint60/narrow/level-<n>.json and report.jsonl */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const E = require('../engine.js'), I = require('../preserve_intent.js'), F = require('../footprint.js');
const ROOT = path.resolve(__dirname, '../../../..'), OUT = path.join(ROOT, 'source/analysis/builder/footprint60/narrow');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const clone = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function trapSet(before, prep) {
  const a = before.design, g0 = prep.g, M = new Set(prep.roles), ci = a.solution.indexOf(a.clock.i);
  for (const r of prep.roles) { for (const u of g0.nb.above[r]) M.add(u); if (g0.iceH[r]) for (const u of g0.iceNb[r]) M.add(u); }
  for (const t of a.solution.slice(0, ci + 1)) M.add(t);
  const b = (before.roles && before.roles.bait) || (before.card && before.card.trap && before.card.trap.bait) || {};
  for (const k of ['tiles', 'twins', 'wrong', 'single']) for (const t of (b[k] || [])) if (Number.isInteger(t)) M.add(t);
  for (const p of (b.pairs || [])) for (const t of p) M.add(t);
  for (const t of ((b.repeat && b.repeat.copies) || [])) M.add(t);
  return M;
}
const ext = ts => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; for (const [x, y] of ts) { l = Math.min(l, x); r = Math.max(r, x + 2); t0 = Math.min(t0, y); b = Math.max(b, y + 2); } return { l, r, t: t0, b }; };

// take out column `col` (x of its cells) and/or row `row` (null = leave), re-place the removed tiles as a cap
function squeeze(a, M, col, row) {
  const n = a.tiles.length, T = a.tiles.map(t => t.slice()), removed = [];
  for (const [axis, c] of [[0, col], [1, row]]) { if (c == null) continue; for (let i = 0; i < n; i++) { if (removed.includes(i)) continue; const v = T[i][axis]; if (v === c) removed.push(i); else if (v > c) T[i][axis] = v - 2; } }
  if (removed.some(i => M.has(i))) return { why: 'trapInLine' };
  const alive = () => { const s = new Set(removed), o = []; for (let i = 0; i < n; i++) if (!s.has(i)) o.push(i); return o; };
  const overlap = (p, q) => p[2] === q[2] && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2;
  let live = alive();
  for (const i of live) for (const j of live) if (i < j && !removed.includes(i) && !removed.includes(j) && overlap(T[i], T[j])) { const out = M.has(j) ? i : j; if (M.has(out)) return { why: 'trapCollides' }; removed.push(out); }
  const cover = (x, y, z, list) => { for (const cx of [x, x + 1]) for (const cy of [y, y + 1]) if (!list.some(j => T[j][2] === z && T[j][0] <= cx && cx < T[j][0] + 2 && T[j][1] <= cy && cy < T[j][1] + 2)) return false; return true; };
  for (let ch = true; ch;) { ch = false; live = alive(); for (const i of live) if (T[i][2] > 0 && !cover(T[i][0], T[i][1], T[i][2] - 1, live.filter(j => j !== i))) { if (M.has(i)) return { why: 'trapUnsupported' }; removed.push(i); ch = true; } }
  const placed = alive(), e1 = ext(placed.map(i => T[i])), mx = (e1.l + e1.r) / 2 - 1, my = (e1.t + e1.b) / 2 - 1;
  const nearM = (x, y, z) => { for (const m of M) { if (removed.includes(m)) continue; const p = T[m]; if ((p[2] === z && Math.abs(p[0] - x) <= 2 && Math.abs(p[1] - y) < 2) || (p[2] === z - 1 && Math.abs(p[0] - x) < 2 && Math.abs(p[1] - y) < 2)) return true; } return false; };
  for (const t of removed.slice()) {
    let best = null;
    for (const j of placed) { const [x, y, z0] = T[j], z = z0 + 1; if (z > 6 || placed.some(q => overlap(T[q], [x, y, z])) || nearM(x, y, z)) continue;
      const cost = z * 100 + Math.abs(x - mx) * 3 + Math.abs(y - my) * 2; if (!best || cost < best.cost) best = { cost, pos: [x, y, z] }; }
    if (!best) return { why: 'noPlaceForCap' };
    T[t] = best.pos; placed.push(t);
  }
  return { tiles: T, moved: removed };
}
// A SECOND WAY, changing less: the outermost column (row) "hops" onto the column (row) next to it. Each edge stack is lifted, in its
// own order, onto the stack beside it. An edge tile was free on its outer side and is free on top afterwards; the tile beside it
// needed the edge tile gone before and still does (it now lies under it), so who-frees-whom stays almost the same and the stored
// route usually still plays. Special tiles (clock, lock, key, ice) never hop: then that side cannot be used.
function hop(a, roles, sides) {
  const n = a.tiles.length, T = a.tiles.map(t => t.slice()), moved = [], R = new Set(roles);
  const overlapXY = (p, x, y) => Math.abs(p[0] - x) < 2 && Math.abs(p[1] - y) < 2;
  const cover = (x, y, z, skip) => { for (const cx of [x, x + 1]) for (const cy of [y, y + 1]) if (!T.some((p, j) => j !== skip && p[2] === z && p[0] <= cx && cx < p[0] + 2 && p[1] <= cy && cy < p[1] + 2)) return false; return true; };
  for (const [axis, side] of sides) {
    const e = ext(T), edge = axis === 0 ? (side > 0 ? e.r - 2 : e.l) : (side > 0 ? e.b - 2 : e.t), dir = side > 0 ? -1 : 1;
    // every tile that reaches into the outermost cell line, lowest first
    const line = [...Array(n).keys()].filter(i => side > 0 ? T[i][axis] > edge - 2 : T[i][axis] < edge + 2).sort((p, q) => T[p][2] - T[q][2]);
    if (line.some(i => R.has(i))) return { why: 'specialOnEdge' };
    for (const i of line) {
      const p = T[i].slice(); p[axis] = edge + dir * 2;                                      // the cell beside the edge, same row/column
      if (T[i][axis] !== edge) p[axis] = T[i][axis] + dir * 2;                               // a half-offset tile keeps its offset
      let z = 0; for (let j = 0; j < n; j++) if (j !== i && overlapXY(T[j], p[0], p[1])) z = Math.max(z, T[j][2] + 1);
      if (z > 0 && !cover(p[0], p[1], z - 1, i)) return { why: 'hopUnsupported' };
      if (z > 7) return { why: 'tooHigh' };
      T[i] = [p[0], p[1], z]; moved.push(i);
    }
    // nothing may be left hanging where the edge was
    for (let i = 0; i < n; i++) if (T[i][2] > 0 && !cover(T[i][0], T[i][1], T[i][2] - 1, i)) return { why: 'leftUnsupported' };
  }
  const l = Math.min(...T.map(t => t[0])), t0 = Math.min(...T.map(t => t[1])); for (const t of T) { t[0] -= l; t[1] -= t0; }
  return { tiles: T, moved };
}
function candidates(before, prep, floor) {
  const a = before.design, M = trapSet(before, prep), e = ext(a.tiles), out = [], why = {};
  const cols = (e.r - e.l) / 2 > 6.5 ? [] : [null], rows = (e.b - e.t) / 2 > 8 ? [] : [null];
  if (!cols.length) for (let v = e.l; v <= e.r - 2; v++) if (a.tiles.some(t => t[0] === v)) cols.push(v);
  if (!rows.length) for (let v = e.t; v <= e.b - 2; v++) if (a.tiles.some(t => t[1] === v)) rows.push(v);
  if (cols[0] === null && rows[0] === null) return { out, why: { nothingToNarrow: 1 }, M };
  const midx = (e.l + e.r) / 2 - 1, midy = (e.t + e.b) / 2 - 1;
  for (const c of cols) for (const r of rows) {
    const s = squeeze(a, M, c, r); if (!s.tiles) { why[s.why] = (why[s.why] || 0) + 1; continue; }
    const d = { ...clone(a), tiles: s.tiles }, fp = F.measure(d, { minimum: floor });
    if (!fp.ok) { why['px ' + Math.floor(fp.tilePx)] = (why['px ' + Math.floor(fp.tilePx)] || 0) + 1; continue; }
    out.push({ design: d, moved: s.moved, footprint: fp, col: c, row: r, cost: s.moved.length + (c == null ? 0 : Math.abs(c - midx) * 0.4) + (r == null ? 0 : Math.abs(r - midy) * 0.2) });
  }
  // the hop: every combination of sides that is needed
  const needX = cols[0] !== null, needY = rows[0] !== null, combos = [];
  for (const sx of needX ? [1, -1] : [0]) for (const sy of needY ? [1, -1] : [0]) combos.push([...(sx ? [[0, sx]] : []), ...(sy ? [[1, sy]] : [])]);
  for (const sides of combos) {
    const h = hop(a, prep.roles, sides); if (!h.tiles) { why['hop:' + h.why] = (why['hop:' + h.why] || 0) + 1; continue; }
    const d = { ...clone(a), tiles: h.tiles }, fp = F.measure(d, { minimum: floor });
    if (!fp.ok) { why['hop px ' + Math.floor(fp.tilePx)] = (why['hop px ' + Math.floor(fp.tilePx)] || 0) + 1; continue; }
    out.push({ design: d, moved: h.moved, footprint: fp, hop: sides.map(([ax, sd]) => (ax ? (sd > 0 ? 'bottom' : 'top') : (sd > 0 ? 'right' : 'left'))).join('+'), cost: h.moved.length * 0.5 });
  }
  out.sort((p, q) => p.cost - q.cost);
  return { out, why, M };
}

// ---- proof of one candidate
function relations(g, roles) { const rel = (i, j) => [g.nb.above[i].includes(j), g.nb.above[j].includes(i), !!g.iceH[i] && g.iceNb[i].includes(j), !!g.iceH[j] && g.iceNb[j].includes(i)]; const o = []; for (const i of roles) for (const j of roles) if (i < j) o.push(rel(i, j)); return o; }
function deps(d, roles) {
  const g = E.game(clone(d), { strict: true }), memo = new Map();
  const cl = pin => { if (!memo.has(pin)) { const s = E.start(g); for (let ch = true; ch;) { ch = false; for (const i of E.legal(g, s)) if (i !== pin && typeof i === 'number') { s.alive[i] = 0; ch = true; } } memo.set(pin, s.alive); } return memo.get(pin); };
  return roles.map(goal => [goal, roles.filter(pin => pin !== goal && cl(pin)[goal]).sort((x, y) => x - y)]);
}
const kOf = d => { const r = E.clockShortest(E.game(clone(d)), { nodes: 600000, ms: 6000 }); return r && !r.unsure ? r.k : null; };
function ablations(d) {
  const out = [];
  for (const i of Object.keys(d.obst.ice || {})) { const x = clone(d); delete x.obst.ice[i]; out.push(['ice', +i, kOf(x)]); }
  for (const i of (d.obst.locks || [])) { const x = clone(d); x.obst.locks = x.obst.locks.filter(q => q !== i); out.push(['lock', i, kOf(x)]); }
  return out;
}
function context(before) {
  const SP = require('./save_pair.js');
  try { if (before.brief && before.roles) return SP.mixCtx(before); if (before.card && before.card.poolId) return SP.chainCtx(before); } catch (e) { return { error: String(e.message || e).slice(0, 120) }; }
  return null;
}
// a full strict winning route for a narrowed board: the released route to the clock when it still plays (else the engine's shortest
// one), then the rest by exact search
function resolve(d, k) {
  const Tl = require('./tail.js'), g = E.game(clone(d), { strict: true }), ci = d.solution.indexOf(d.clock.i);
  let s = E.start(g), prefix = d.solution.slice(0, ci + 1), ok = true;
  for (const t of prefix) { if (!E.legal(g, s).includes(t)) { ok = false; break; } s = E.step(g, s, t); if (!s) { ok = false; break; } }
  if (!ok) { const cs = E.clockShortest(E.game(clone(d), { strict: true }), { nodes: 600000, ms: 6000 }); if (!cs || cs.unsure) return { why: 'clockUnproven' }; if (cs.k !== k) return { why: 'k ' + cs.k }; prefix = E.flatten(cs.path); }
  const rest = d.solution.filter(t => !prefix.includes(t)), x = { ...clone(d), solution: prefix.concat(rest) };
  const r = Tl.cappedTail(x, 3, { peek: false, nodes: 600000, ms: 8000 });
  if (r.result !== 'win') return { why: 'tail ' + r.result };
  return { design: { ...x, solution: r.solution }, keptClockRoute: ok };
}
function finish(before, cand, base, opts = {}) {
  const M = require('../trap_mixes.js'), SEP = require('./separate.js'), a = before.design, t0 = Date.now(), wall = opts.ms ?? 120000;
  const spare = a.clock.n - base.k, trap = base.M, why = {};
  let seed = (opts.seed ?? 1) >>> 0; const rnd = m => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * m); };
  const core = d => {
    if (!same(relations(E.game(clone(d)), base.roles), base.rel)) return 'roleLink';
    if (!same(deps(d, base.roles), base.deps)) return 'roleOrder';
    return null;
  };
  const c0 = core(cand.design); if (c0) return { why: c0 };                           // geometry alone decides these two
  const free = [...Array(a.tiles.length).keys()].filter(i => !trap.has(i) && !trap.has(a.faces.findIndex((f, j) => j !== i && f === a.faces[i])));
  let d = clone(cand.design), swaps = 0;
  const asIs = E.replay(d, d.solution, { strict: true }).ok;
  for (let tries = 0; Date.now() - t0 < wall; tries++) {
    const rt = asIs && tries === 0 ? { design: d } : resolve(d, base.k);
    if (rt.design) { d = rt.design; break; }
    why[rt.why] = (why[rt.why] || 0) + 1;
    if (tries > 60 || free.length < 4) return { why: 'noWinningRoute', detail: why };
    // re-pair: exchange the pictures of a moved tile and another tile outside the trap
    d = clone(cand.design); swaps = 1 + (tries >> 3);
    for (let s = 0; s < swaps; s++) { const u = cand.moved[rnd(cand.moved.length)], v = free[rnd(free.length)]; if (!trap.has(u) && d.faces[u] !== d.faces[v] && free.includes(u)) [d.faces[u], d.faces[v]] = [d.faces[v], d.faces[u]]; }
  }
  if (!E.replay(d, d.solution, { strict: true }).ok) return { why: 'noWinningRoute', detail: why };
  if (kOf(d) !== base.k || d.clock.n !== a.clock.n) return { why: 'clockChanged' };
  if (!same(ablations(d), base.abl)) return { why: 'specialEffectChanged' };
  const ct = SEP.closeTwins(d); if (ct.visible > base.twins) return { why: 'twins' };
  let proof = null;
  if (base.ctx && !base.ctx.error) { proof = base.ctx.prove(d, base.k); if (!proof.ok) return { why: 'trapProof:' + proof.why }; }
  return { design: d, storedRoutePlays: asIs, facePairsChanged: d.faces.filter((f, i) => f !== a.faces[i]).length / 2, proof: base.ctx ? (base.ctx.error ? 'context failed: ' + base.ctx.error : 'own trap proof holds') : 'no authored proof (older board): special-tile relations, order, clock and effects checked' };
}
function one(level, opts = {}) {
  const R = JSON.parse(fs.readFileSync(path.join(ROOT, 'source/analysis/builder/footprint60/range-250-300.json'), 'utf8')), before = R.rows.find(r => r.level === level).before;
  const prep = I.prepare(before), a = before.design, floor = opts.floor ?? 58, c = candidates(before, prep, floor);
  const fp0 = F.measure(a, { minimum: floor });
  if (fp0.ok) return { level, ok: true, unchanged: true, footprint: fp0, note: 'already ' + fp0.tilePx.toFixed(1) + ' px' };
  if (!c.out.length) return { level, ok: false, why: 'no column/row can be taken out', detail: c.why, before: fp0.tilePx };
  const SEP = require('./separate.js');
  const base = { M: c.M, roles: prep.roles, rel: relations(prep.g, prep.roles), deps: prep.roleDependencies, k: prep.clock && !prep.clock.unsure ? prep.clock.k : null, abl: ablations(a), twins: SEP.closeTwins(a).visible, ctx: context(before) };
  if (base.k == null) return { level, ok: false, why: 'released clock minimum unproven' };
  const fails = {};
  for (const cand of c.out.slice(0, opts.tryCandidates ?? 8)) {
    const r = finish(before, cand, base, { ms: (opts.ms ?? 240000) / 4, seed: opts.seed });
    if (r.design) return { level, ok: true, design: r.design, moved: cand.moved, movedCount: cand.moved.length, column: cand.col, row: cand.row, hop: cand.hop || null, footprint: F.measure(r.design, { minimum: floor }), before: fp0.tilePx, facePairsChanged: r.facePairsChanged, storedRoutePlays: r.storedRoutePlays, proof: r.proof, candidates: c.out.length };
    fails[r.why] = (fails[r.why] || 0) + 1;
  }
  return { level, ok: false, why: 'no candidate passed the proof', detail: fails, geometric: c.out.length, before: fp0.tilePx };
}
module.exports = { squeeze, candidates, finish, one, trapSet };
if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  if (arg('one', null)) {
    let r; try { r = one(+arg('one'), { ms: +arg('ms', 240000), seed: +arg('seed', 1), floor: +arg('floor', 58) }); } catch (e) { r = { level: +arg('one'), ok: false, why: String(e.stack || e).slice(0, 300) }; }
    if (r.ok && r.design) fs.writeFileSync(path.join(OUT, `level-${r.level}.json`), JSON.stringify({ level: r.level, design: r.design, moved: r.moved, column: r.column, row: r.row, hop: r.hop, footprint: r.footprint, before: r.before, facePairsChanged: r.facePairsChanged, proof: r.proof }));
    const { design, moved, ...row } = r; fs.appendFileSync(path.join(OUT, 'report.jsonl'), JSON.stringify(row) + '\n');
    console.log(r.level, r.ok ? (r.unchanged ? r.note : `NARROWED ${r.hop ? 'hop ' + r.hop : 'column/row out'}: ${r.before.toFixed(1)} -> ${r.footprint.tilePx.toFixed(1)} px, ${r.footprint.rows} rows, ${r.movedCount} tiles moved, ${r.facePairsChanged} picture pairs changed, stored route ${r.storedRoutePlays ? 'still plays' : 'replaced'}; ${r.proof}`) : 'no: ' + r.why + ' ' + JSON.stringify(r.detail || {}));
  } else {
    const levels = String(arg('levels', '')).split(',').filter(Boolean), W = +arg('workers', 8); let next = 0, run = 0;
    const go = () => { while (run < W && next < levels.length) { const lv = levels[next++]; run++; const c = cp.spawn(process.execPath, [__filename, ...process.argv.slice(2), '--one', lv], { stdio: 'inherit' });
      const tm = setTimeout(() => c.kill(), +arg('ms', 240000) + 300000); c.on('exit', () => { clearTimeout(tm); run--; go(); }); } }; go();
  }
}
