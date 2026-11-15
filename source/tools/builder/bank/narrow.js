#!/usr/bin/env node
'use strict';
/* narrow.js: make a released pile one tile narrower (7 -> 6 wide) and at most eight rows, as a designed-looking shape.
   Dennis 2026-11-15: about 60 px tiles for 250-300 "without changing the levels too much especially the traps cant be changed", and
   "The shape shouldnt be weird ... weirdly placed tiles" (on a freely repacked draft).
   Why anything has to move: a pile 7 tiles wide is 54.5 px on the 392 px reference phone; 60 px needs 6 wide.
   How (no free repacking):
     1. the MIDDLE column of the pile is taken out and the right half slides one tile to the left; for a nine-row pile the middle row
        goes too and the lower half slides up. Both halves keep every tile in place relative to its half, so the shape stays the
        designed shape, only narrower.
     2. the tiles that were taken out go back as straight stacks on the middle of the pile, lowest first, nearest to the middle first,
        never on or beside a tile of the trap (clock, lock, key, ice, their thawing neighbours, what lies on them, the baits, the
        route to the clock).
     3. the engine then has to agree: same shortest route to the clock and same spare, every special tile with the same special tiles
        on/under/thawing it and needing the same special tiles gone first, a full strict winning route. Pictures of tiles outside the
        trap may be re-paired to keep the board winnable.
   narrow(design, mech) -> { ok, design, moved, why }   (mech: extra tile indices that belong to the trap) */
const E = require('../engine.js'), I = require('../preserve_intent.js'), F = require('../footprint.js');
const clone = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function narrow(before, opts = {}) {
  const a = before.design, n = a.tiles.length, prep = I.prepare(before), g0 = prep.g, roles = prep.roles;
  // the trap: specials, their thawing neighbours, covers, baits, the clock route
  const M = new Set(roles); const ci = a.solution.indexOf(a.clock.i);
  for (const r of roles) { for (const u of g0.nb.above[r]) M.add(u); if (g0.iceH[r]) for (const u of g0.iceNb[r]) M.add(u); }
  for (const t of a.solution.slice(0, ci + 1)) M.add(t);
  for (const t of (opts.mech || [])) M.add(t);
  const T = a.tiles.map(t => t.slice());
  const ext = ts => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; for (const [x, y] of ts) { l = Math.min(l, x); r = Math.max(r, x + 2); t0 = Math.min(t0, y); b = Math.max(b, y + 2); } return { l, r, t: t0, b }; };
  const removed = [];
  const squeeze = axis => {            // axis 0: take out the middle column; 1: the middle row
    const e = ext(T.filter((t, i) => !removed.includes(i))), lo = axis ? e.t : e.l, hi = axis ? e.b : e.r, mid = lo + Math.floor((hi - lo - 2) / 4) * 2;   // the middle cell [mid, mid+2)
    // the column (row) nearest to the middle that holds no tile of the trap; the middle itself when none is free
    const cells = []; for (let v = lo; v <= hi - 2; v += 2) cells.push(v); cells.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
    const c = cells.find(v => !T.some((t, i) => !removed.includes(i) && t[axis] === v && M.has(i))) ?? mid;
    for (let i = 0; i < n; i++) { if (removed.includes(i)) continue; const v = T[i][axis];
      if (v === c) removed.push(i); else if (v > c) T[i][axis] = v - 2; }
  };
  const e0 = ext(T);
  if ((e0.r - e0.l) / 2 > 6.5) squeeze(0);
  if ((e0.b - e0.t) / 2 > 8) squeeze(1);
  if (!removed.length) return { ok: false, why: 'nothing to narrow' };
  if (removed.some(i => M.has(i))) return { ok: false, why: 'a tile of the trap sits in the middle column or row', trapInMiddle: removed.filter(i => M.has(i)) };
  // tiles that now overlap in a layer (half-offset tiles from both sides of the seam): the later one goes to the cap too
  const alive = () => [...Array(n).keys()].filter(i => !removed.includes(i));
  const overlap = (p, q) => p[2] === q[2] && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2;
  for (const i of alive()) for (const j of alive()) if (i < j && !removed.includes(i) && !removed.includes(j) && overlap(T[i], T[j])) { const out = M.has(j) ? i : j; if (M.has(out)) return { ok: false, why: 'trap tiles collide at the seam' }; removed.push(out); }
  // unsupported tiles drop to the cap as well
  const cover = (x, y, z, list) => { for (const cx of [x, x + 1]) for (const cy of [y, y + 1]) if (!list.some(j => T[j][2] === z && T[j][0] <= cx && cx < T[j][0] + 2 && T[j][1] <= cy && cy < T[j][1] + 2)) return false; return true; };
  for (let ch = true; ch;) { ch = false; for (const i of alive()) if (T[i][2] > 0 && !cover(T[i][0], T[i][1], T[i][2] - 1, alive().filter(j => j !== i))) { if (M.has(i)) return { ok: false, why: 'a trap tile loses its support' }; removed.push(i); ch = true; } }
  // the cap: straight stacks, lowest and nearest to the middle first
  const placed = alive(), e1 = ext(placed.map(i => T[i])), mx = (e1.l + e1.r) / 2 - 1, my = (e1.t + e1.b) / 2 - 1;
  const nearM = (x, y, z) => [...M].some(m => !removed.includes(m) && ((T[m][2] === z && Math.abs(T[m][0] - x) <= 2 && Math.abs(T[m][1] - y) < 2) || (T[m][2] === z - 1 && Math.abs(T[m][0] - x) < 2 && Math.abs(T[m][1] - y) < 2)));
  for (const t of removed.slice()) {
    let best = null;
    for (const j of placed) { const [x, y, z0] = T[j], z = z0 + 1;                                  // on top of tile j
      if (placed.some(q => overlap(T[q], [x, y, z])) || nearM(x, y, z)) continue;
      const cost = z * 100 + Math.abs(x - mx) * 3 + Math.abs(y - my);
      if (!best || cost < best.cost) best = { cost, pos: [x, y, z] }; }
    if (!best) return { ok: false, why: 'no place for the cap' };
    T[t] = best.pos; placed.push(t);
  }
  const d = { ...clone(a), tiles: T };
  const fp = F.measure(d, { minimum: opts.floor ?? 58 });
  return { ok: true, design: d, moved: removed.slice(), footprint: fp, mechanism: [...M] };
}
module.exports = { narrow };
if (require.main === module) {
  const fs = require('fs'), path = require('path'), R = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/builder/footprint60/range-250-300.json'), 'utf8'));
  for (const lv of process.argv.slice(2).map(Number)) {
    const before = R.rows.find(r => r.level === lv).before, res = narrow(before);
    console.log(lv, res.ok ? `narrowed: ${res.moved.length} tiles to the cap, ${res.footprint.tilePx.toFixed(1)} px, ${res.footprint.rows} rows` : 'no: ' + res.why + (res.trapInMiddle ? ' ' + res.trapInMiddle.length : ''));
  }
}
