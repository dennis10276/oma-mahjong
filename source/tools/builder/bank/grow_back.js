#!/usr/bin/env node
'use strict';
// grow_back.js: bring a narrowed board back to at least N tiles (Dennis 2026-11-15 on 269: "bring it back to at least 72 tiles").
// Tiles Codex dropped come back in pairs of one picture (each picture then shows 2 or 4 times), each on a brick spot (fully
// supported, half-offset, the row parity its layer uses, nothing above), never on or beside the trap, not sticking out of the
// pile's leaning outline, mirror pairs first, low first; face-down as they were. Then a full route and Codex's certificate.
//   MECH=1 NARROW_TRAP=core node grow_back.js 269 72
const fs = require('fs'), path = require('path'), D = require('./detower.js'), CF = D.CF;
const P = require(CF + 'narrow_proof'), Q = require(CF + 'finish_ten_proof'), G = require(CF + 'narrow_methods'), E = require(CF + '../engine'), SEP = require(CF + 'separate');
const clone = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lx = t => t[0] / 2 - t[2] * 0.14, ly = t => t[1] / 2 * 1.24 - t[2] * 0.14;
function grow(level, target, seed = 0) {
  const c = D.candidate(level), before = P.original(c.source), a = before.design, base = P.prepare(before);
  const d0 = c.d, keep0 = c.keep, kept = new Set(keep0), dropped = a.tiles.map((_, i) => i).filter(i => !kept.has(i));
  const cnt = new Map(); for (const f of d0.faces) cnt.set(f, (cnt.get(f) || 0) + 1);
  // pairs of dropped tiles (low ones first); each pair shows its own released picture when that leaves every picture at 2 or 4,
  // otherwise a picture the board does not show yet (never a picture of a special or a wrong move)
  const fixedF = new Set([a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number), ...(before.card?.trap?.baits || []).flatMap(b => b.tiles)].map(i => a.faces[i]));
  const need = Math.ceil((target - d0.tiles.length) / 2), pool = dropped.slice().sort((i, j) => a.tiles[i][2] - a.tiles[j][2] || ((i * 7 + seed) % 11) - ((j * 7 + seed) % 11));
  if (pool.length < need * 2) return { ok: false, why: 'only ' + pool.length + ' dropped tiles' };
  const use = pool.slice(0, need * 2), faceOf = new Map();
  for (let k = 0; k < use.length; k += 2) {
    const own = a.faces[use[k]], ok = f => !fixedF.has(f) && [0, 2].includes(cnt.get(f) || 0);
    let f = ok(own) ? own : ok(a.faces[use[k + 1]]) ? a.faces[use[k + 1]] : [...Array(36).keys()].find(q => ok(q) && !cnt.get(q));
    if (f == null) f = [...Array(36).keys()].find(ok); if (f == null) return { ok: false, why: 'no picture for a returning pair' };
    faceOf.set(use[k], f); faceOf.set(use[k + 1], f); cnt.set(f, (cnt.get(f) || 0) + 2);
  }
  const ids = new Map(keep0.map((id, i) => [id, i]));
  const sp = [d0.clock.i, ...d0.obst.keys, ...d0.obst.locks, ...Object.keys(d0.obst.ice).map(Number)];
  const bait = (before.card?.trap?.baits || []).flatMap(b => b.tiles).map(t => ids.get(t)).filter(x => x != null);
  const route = d0.solution.slice(0, d0.solution.indexOf(d0.clock.i) + 1), g = E.game(clone(d0));
  const core = new Set([...sp, ...bait, ...route]); for (const s of [...sp, ...bait]) for (const k of ['above', 'left', 'right']) for (const u of g.nb[k][s] || []) core.add(u);
  // also every tile that is free when the clock is taken: the finish starts from them (269 has no spare move)
  { const gs = E.game(clone(d0), { strict: true }); let st = E.start(gs); for (const t of route) st = E.step(gs, st, t); for (const i of E.legal(gs, st)) core.add(i); }
  const guardT = [...core].map(i => d0.tiles[i]);
  const nearGuard = p => guardT.some(q => (p[2] === q[2] + 1 && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2) || (p[2] === q[2] && Math.abs(p[1] - q[1]) < 2 && Math.abs(p[0] - q[0]) === 2));
  const T = d0.tiles.map(t => t.slice()), xs = T.map(t => t[0]), ys = T.map(t => t[1]);
  const X0 = Math.min(...xs), X1 = Math.max(...xs) + 2, Y0 = Math.min(...ys), Y1 = Math.max(...ys) + 2, m = X0 + X1 - 2, ZMAX = Math.max(...a.tiles.map(t => t[2]));
  const minX = Math.min(...T.map(lx)), minY = Math.min(...T.map(ly)), added = [];
  for (const i of use) {
    let best = null;
    for (let z = 0; z <= Math.min(ZMAX, Math.max(2, a.tiles[i][2])); z++) for (let y = Y0; y + 2 <= Y1; y++) for (let x = X0; x + 2 <= X1; x++) {
      const p = [x, y, z]; if (!D.brickSpot(T, p) || nearGuard(p) || lx(p) < minX - 1e-9 || ly(p) < minY - 1e-9) continue;
      const mir = T.some(q => same(q, [m - x, y, z])) || m - x === x;
      const sc = z * 10 - (mir ? 30 : 0) + Math.abs(x + 1 - (X0 + X1) / 2) * 0.4 + ((seed * 7 + x * 3 + y) % 5) * 0.01;
      if (!best || sc < best.sc) best = { p, sc };
    }
    if (!best) return { ok: false, why: 'no brick spot left for tile ' + i };
    T.push(best.p); added.push({ tile: i, at: best.p, face: faceOf.get(i), down: a.down.includes(i) });
  }
  const keep = keep0.concat(use), idn = new Map(keep.map((id, k) => [id, k]));
  let d = { ...clone(d0), tiles: T, faces: d0.faces.concat(use.map(i => faceOf.get(i))) };
  d.down = a.down.filter(i => idn.has(i)).map(i => idn.get(i));
  if (!G.valid(T)) return { ok: false, why: 'invalid geometry' };
  if (SEP.closeTwins(d).visible > base.twins) d = D.untwin(d, base.twins, new Set([...sp, ...bait])).d;
  d.solution = d0.solution.concat(use.map(i => idn.get(i)));
  const sol = D.route(d); if (!sol) return { ok: false, why: 'no full winning route', design: d };
  d.solution = sol;
  const cert = Q.certify(before, d, keep, base), s = D.shape(T);
  return { ok: cert.ok && s.straight === 0, level, target, design: d, keep, added, shape: D.strip(s), errors: cert.errors, certificate: cert, px: cert.footprint && +cert.footprint.tilePx.toFixed(1) };
}
module.exports = { grow };
if (require.main === module) {
  const lv = +process.argv[2], target = +process.argv[3] || 72; let r;
  for (let seed = 0; seed < 8; seed++) { r = grow(lv, target, seed); console.log(JSON.stringify({ seed, ok: r.ok, tiles: r.design && r.design.tiles.length, px: r.px, shape: r.shape, why: r.why || (r.errors || []).join(',') })); if (r.ok) break; }
  if (r.ok) { const OUT = path.resolve(__dirname, '../../../analysis/builder/footprint60/detower'); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `level-${lv}.json`), JSON.stringify({ level: lv, ok: true, method: 'grown back to ' + target + ' tiles', source: lv, ...r }, null, 1)); }
}
