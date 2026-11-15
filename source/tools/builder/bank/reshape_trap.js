#!/usr/bin/env node
'use strict';
/* reshape_trap.js: rebuild a 251-299 board at most 6.5 wide and 8 rows around its trap, without towers (Dennis 2026-11-15:
   "No towers", "make it as mirrored as possible", "same mechanics maybe just from different positions", "Maybe with new
   improvements we CAN reshape the level").

   Why a rebuild: half-offset stacking makes every layer below half a tile wider on each side, so a trap that spans the
   width high up needs a base wider than 6.5 tiles; narrowing it in place leaves either towers (tiles straight on one tile)
   or a broken trap.

   1. The trap is lifted out as one rigid piece: specials, authored wrong moves, the released route to the clock, every
      tile on, beside or thawing a special or a wrong move, and everything lying on those. Inside the piece every relation
      (on, beside, thaws) stays exactly as released.
   2. The piece goes into a window 12 or 13 half-units wide and at most 16 high, centred, possibly one or two layers lower.
   3. Supports are built under it brick-wise (half-offset under the tile above, on the row parity the layer uses).
   4. All other tiles are laid brick-wise around it: base layer first, mirror pairs first, then low and central; never on or
      beside the trap piece; never higher than layer 3 unless the tile was higher before.
   5. Same tiles, same pictures, same face-down tiles (tile identities kept: low tiles stay low). A fresh full winning route,
      then Codex's Task 20 certificate (MECH=1 NARROW_TRAP=core).

     MECH=1 NARROW_TRAP=core node reshape_trap.js 292,288   -> footprint60/reshape/level-<n>.json */
const fs = require('fs'), path = require('path');
const D = require('./detower.js'), CF = D.CF;
const P = require(CF + 'narrow_proof'), Q = require(CF + 'finish_ten_proof'), G = require(CF + 'narrow_methods'), E = require(CF + '../engine'), SEP = require(CF + 'separate');
const OUT = path.resolve(__dirname, '../../../analysis/builder/footprint60/reshape');
const clone = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const overlap = (a, b) => a[2] === b[2] && Math.abs(a[0] - b[0]) < 2 && Math.abs(a[1] - b[1]) < 2;

function trapPiece(before, small) {
  const a = before.design, g = E.game(clone(a));
  const sp = [a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number)];
  const bait = (before.card?.trap?.baits || []).flatMap(b => b.tiles);
  const route = a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1);
  const core = new Set(small ? [...sp, ...bait] : [...sp, ...bait, ...route]);
  for (const s of [...sp, ...bait]) { for (const k of small ? ['above'] : ['above', 'left', 'right']) for (const u of g.nb[k][s] || []) core.add(u); if (g.iceH && g.iceH[s]) for (const u of g.iceNb[s]) core.add(u); }
  for (let ch = true; ch;) { ch = false; for (const i of [...core]) for (const u of g.nb.above[i] || []) if (!core.has(u)) { core.add(u); ch = true; } }
  return { core, sp, bait, route };
}

function build(before, piece, W, H, dz, shiftX, shiftY, opts = {}) {
  const a = before.design, n = a.tiles.length, core = piece.core;
  const pos = new Array(n).fill(null);
  for (const i of core) { const t = a.tiles[i]; pos[i] = [t[0] + shiftX, t[1] + shiftY, t[2] + dz]; }
  if (pos.some(p => p && (p[0] < 0 || p[0] + 2 > W || p[1] < 0 || p[1] + 2 > H || p[2] < 0))) return { why: 'piece outside the window' };
  const placed = () => pos.filter(Boolean);
  const free = [...Array(n).keys()].filter(i => !core.has(i)).sort((i, j) => a.tiles[i][2] - a.tiles[j][2] || a.tiles[i][1] - a.tiles[j][1] || a.tiles[i][0] - a.tiles[j][0]);
  const take = () => free.shift();
  const zOk = (i, z) => z <= 2 || z <= a.tiles[i][2];
  // supports, top layer down
  const maxZ = Math.max(...placed().map(p => p[2]));
  for (let z = maxZ; z >= 1; z--) {
    for (let guard = 0; guard < 200; guard++) {
      const cur = placed(), need = [];
      for (const t of cur.filter(t => t[2] === z)) for (const cx of [t[0], t[0] + 1]) for (const cy of [t[1], t[1] + 1])
        if (!cur.some(q => q[2] === z - 1 && q[0] <= cx && q[0] + 2 > cx && q[1] <= cy && q[1] + 2 > cy)) need.push([cx, cy, t]);
      if (!need.length) break;
      const [cx, cy, above] = need[0]; let best = null;
      for (const px of [cx - 1, cx]) for (const py of [cy - 1, cy]) {
        const p = [px, py, z - 1]; if (px < 0 || px + 2 > W || py < 0 || py + 2 > H) continue;
        if (cur.some(q => overlap(q, p))) continue;
        const straightUnder = cur.some(q => q[2] === z && q[0] === px && q[1] === py);
        const row = cur.filter(q => q[2] === z - 1 && q[1] === py), par = row.length && row.every(q => (q[0] - px) % 2 !== 0);
        const sc = (straightUnder ? 100 : 0) + (par ? 20 : 0) + (py !== above[1] ? 5 : 0) + Math.abs(px + 1 - W / 2) * 0.1;
        if (!best || sc < best.sc) best = { p, sc };
      }
      if (!best) return { why: 'no support under the piece' };
      const i = take(); if (i == null) return { why: 'not enough tiles for the supports' };
      pos[i] = best.p;
    }
  }
  // everything else, brick-wise, mirror pairs first, low and central, never on or beside the piece
  const guardT = [...core].map(i => pos[i]), m = W - 2;
  const nearGuard = p => guardT.some(q => (p[2] === q[2] + 1 && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2) || (p[2] === q[2] && Math.abs(p[1] - q[1]) < 2 && Math.abs(p[0] - q[0]) === 2));
  const ZMAX = Math.max(...a.tiles.map(t => t[2]));
  while (free.length) {
    const cur = placed(), i = free[0]; let best = null;
    for (let z = 0; z <= ZMAX; z++) { if (!zOk(i, z)) continue; for (let y = 0; y + 2 <= H; y++) for (let x = 0; x + 2 <= W; x++) {
      const p = [x, y, z]; if (!D.brickSpot(cur, p) || nearGuard(p)) continue;
      const mir = cur.some(q => same(q, [m - x, y, z])) || m - x === x;
      const sc = z * (opts.layerW || 12) - (mir ? 30 : 0) + Math.abs(x + 1 - W / 2) * (opts.centreW || 0.8) + Math.abs(y + 1 - H / 2) * (opts.centreW || 0.8) * 0.5;
      if (!best || sc < best.sc) best = { p, sc };
    } }
    if (!best) return { why: 'no brick spot for ' + free.length + ' tiles' };
    pos[free.shift()] = best.p;
  }
  return { tiles: pos };
}

function shapeOk(T) { const s = D.shape(T); return s; }

function run(level, opts = {}) {
  const c = D.candidate(level), before = P.original(c.source), a = before.design, base = P.prepare(before), piece = trapPiece(before, opts.small);
  const n = a.tiles.length, keep = Array.from({ length: n }, (_, i) => i), tried = [];
  const cxs = [...piece.core].map(i => a.tiles[i][0]), cys = [...piece.core].map(i => a.tiles[i][1]), czs = [...piece.core].map(i => a.tiles[i][2]);
  const pw = Math.max(...cxs) + 2 - Math.min(...cxs), ph = Math.max(...cys) + 2 - Math.min(...cys);
  const rows = Math.min(16, Math.max(...a.tiles.map(t => t[1])) + 2 - Math.min(...a.tiles.map(t => t[1])));
  const t0 = Date.now();
  for (const W of [12, 13]) for (const H of [rows, Math.min(16, rows + 2)]) for (let dz = 0; dz >= -Math.min(...czs); dz--) {
    if (pw > W || ph > H) { tried.push({ W, H, dz, why: 'trap piece ' + pw + ' x ' + ph + ' wider than the window' }); continue; }
    const baseX = Math.round((W - pw) / 2) - Math.min(...cxs), baseY = Math.round((H - ph) / 2) - Math.min(...cys);
    for (const sx of [baseX, baseX - 1, baseX + 1]) for (const sy of [baseY, baseY - 1, baseY + 1]) for (const variant of [{}, { layerW: 6 }, { centreW: 0.3 }]) {
      if (Date.now() - t0 > (opts.ms || 240000)) return save({ level, ok: false, tried, why: 'wall' });
      const b = build(before, piece, W, H, dz, sx, sy, variant);
      if (!b.tiles) { tried.push({ W, H, dz, sx, sy, why: b.why }); continue; }
      if (!G.valid(b.tiles)) { tried.push({ W, H, dz, sx, sy, why: 'invalid geometry' }); continue; }
      const s = D.shape(b.tiles); if (s.straight) { tried.push({ W, H, dz, sx, sy, why: 'straight ' + s.straight }); continue; }
      let d = { ...clone(a), tiles: b.tiles };
      const fixedT = new Set([...piece.sp, ...piece.bait]);
      if (SEP.closeTwins(d).visible > base.twins) d = D.untwin(d, base.twins, fixedT).d;
      const sol = D.route(d); if (!sol) { tried.push({ W, H, dz, sx, sy, why: 'no full winning route', shape: D.strip(s) }); continue; }
      d.solution = sol;
      const cert = Q.certify(before, d, keep, base);
      const rec = { W, H, dz, sx, sy, variant, shape: D.strip(s), ok: cert.ok, errors: cert.errors, px: cert.footprint && +cert.footprint.tilePx.toFixed(1) };
      tried.push(rec);
      if (cert.ok) return save({ level, ok: true, method: 'rebuilt around the trap', source: c.source, design: d, keep, ...rec, pieceSize: piece.core.size, certificate: cert, tried });
    }
  }
  return save({ level, ok: false, tried });
}
function save(r) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `level-${r.level}.json`), JSON.stringify(r, null, 1)); return r; }
module.exports = { run, build, trapPiece };
if (require.main === module) for (const lv of process.argv[2].split(',').map(Number)) {
  const t0 = Date.now(), r = run(lv, { small: process.argv.includes('--small') }), last = {};
  for (const t of r.tried) { const k = t.why || (t.errors || []).join(','); last[k] = (last[k] || 0) + 1; }
  console.log(JSON.stringify({ level: lv, ok: r.ok, shape: r.shape, px: r.px, W: r.W, dz: r.dz, piece: r.pieceSize, s: Math.round((Date.now() - t0) / 1000), why: r.ok ? undefined : last }));
}
