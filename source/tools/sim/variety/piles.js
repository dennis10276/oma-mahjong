/* Piles for the level-variety remake (offline only; the game reads the finished boards from
   levels-hard.js and never runs this). A copy of Layouts.buildPiles with a bigger shape library and
   the shape chosen by the caller, so every level can get a different pile. The game's own shape
   list is NOT changed: it also builds the classic levels 1-50 and 52 on every phone.
     const { pile, SHAPE_NAMES } = require('./piles'); pile({ shape, seed, target, layers, aspect, ... }) */
'use strict';
const path = require('path');
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const { rng, shuffleArr, neighbors } = L;
const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
const UV = (c, r, W, H) => [(c - (W - 1) / 2) / (W / 2), (r - (H - 1) / 2) / (H / 2)];
// u = -1..1 across, v = -1 (top) .. 1 (bottom); every shape is mirror-symmetric left/right
const SHAPES = {
  // the game's library (layouts.js)
  block: () => true,
  diamond: (u, v) => Math.abs(u) + Math.abs(v) <= 1.05,
  oval: (u, v) => u * u + v * v <= 1.1,
  octagon: (u, v) => Math.abs(u) + Math.abs(v) <= 1.42,
  cross: (u, v) => Math.abs(u) <= 0.38 || Math.abs(v) <= 0.3,
  hourglass: (u, v) => Math.abs(u) <= Math.abs(v) + 0.3,
  bowtie: (u, v) => Math.abs(v) <= Math.abs(u) * 0.9 + 0.32,
  heart: (u, v) => { const x = u * 1.25, y = -v * 1.25 + 0.2, q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0.02; },
  pyramid: (u, v) => Math.abs(u) <= (v + 1) / 2 + 0.2,
  tree: (u, v) => v < 0.45 ? Math.abs(u) <= (v + 1.1) / 1.55 : Math.abs(u) <= 0.26,
  house: (u, v) => v >= -0.25 ? Math.abs(u) <= 0.85 : Math.abs(u) <= (v + 1) / 0.75 * 0.95 + 0.05,
  arch: (u, v) => !(Math.abs(u) < 0.36 && v > 0.15),
  frame: (u, v) => !(Math.abs(u) < 0.42 && Math.abs(v) < 0.42),
  letterH: (u, v) => Math.abs(u) >= 0.4 || Math.abs(v) <= 0.26,
  crown: (u, v) => v > -0.35 || Math.abs(u) > 0.7 || Math.abs(u) < 0.14,
  butterfly: (u, v) => { const a = Math.abs(u); return a <= 0.18 || ((a - 0.15) ** 2 / 0.75 + (Math.abs(v + 0.15) - 0.05) ** 2 / 0.95 <= 0.85 && Math.abs(v) <= 0.95); },
  vase: (u, v) => Math.abs(u) <= (v < -0.5 ? 0.5 : v < 0 ? 0.35 + Math.abs(v + 0.5) * 0.5 : 0.95 - v * 0.35),
  // new shapes (variety remake)
  ring: (u, v) => { const d = u * u + v * v; return d <= 1.1 && d >= 0.3; },
  star: (u, v) => { const a = Math.atan2(v, u), d = Math.hypot(u, v); return d <= 0.45 + 0.55 * Math.abs(Math.cos(2.5 * (a + Math.PI / 2))); },
  wave: (u, v) => Math.abs(v - 0.45 * Math.cos(Math.PI * u * 1.5)) <= 0.42,
  steps: (u, v) => v >= Math.floor(Math.abs(u) * 3) / 3 * 1.6 - 1.05,
  twins: (u, v) => (Math.abs(u) - 0.52) ** 2 / 0.22 + v * v / 1.05 <= 1,
  arrow: (u, v) => v < 0.05 ? Math.abs(u) <= (v + 1) * 0.95 : Math.abs(u) <= 0.34,
  moon: (u, v) => u * u + v * v <= 1.05 && u * u + (v + 0.55) ** 2 >= 0.42,
  plus: (u, v) => Math.abs(u) <= 0.3 || Math.abs(v) <= 0.24 || Math.abs(u) + Math.abs(v) <= 0.75,
  xshape: (u, v) => Math.abs(Math.abs(u) - Math.abs(v)) <= 0.38,
  tshape: (u, v) => v <= -0.3 || Math.abs(u) <= 0.3,
  ushape: (u, v) => Math.abs(u) >= 0.45 || v >= 0.35,
  chevron: (u, v) => { const c = Math.abs(u) * 0.9 - 0.45; return v >= c - 0.45 && v <= c + 0.5; },
  kite: (u, v) => v < -0.2 ? Math.abs(u) <= (v + 1) * 1.1 : Math.abs(u) <= (1 - v) * 0.7,
  castle: (u, v) => v >= -0.45 ? Math.abs(u) <= 0.92 : (Math.abs(u) > 0.62 || Math.abs(u) < 0.2),
};
const SHAPE_NAMES = Object.keys(SHAPES);
function shapeCells(name, W, H, brick) {
  const f = SHAPES[name], cells = [];
  for (let r = 0; r < H; r++) {
    const odd = brick && r % 2 === 1;
    for (let c = 0; c < (odd ? W - 1 : W); c++) {
      const [u, v] = UV(odd ? c + 0.5 : c, r, W, H);
      if (f(u, v)) cells.push({ x: c * 2 + (odd ? 1 : 0), y: r * 2 });
    }
  }
  return cells;
}
// all sizes of one shape (base layer): cells, width and height in tiles
const BASES = {};
function basesOf(name) {
  if (BASES[name]) return BASES[name];
  const out = [];
  for (const brick of [false, true]) for (let W = 3; W <= 12; W++) for (let H = 3; H <= 12; H++) {
    const cells = shapeCells(name, W, H, brick);
    if (cells.length < 6) continue;
    const xs = cells.map(t => t.x), ys = cells.map(t => t.y);
    if (new Set(ys).size < Math.min(H, 3)) continue;
    // one piece only (the pile must hold together)
    const set = new Set(cells.map(t => t.x + ',' + t.y)), seen = new Set([cells[0].x + ',' + cells[0].y]), st = [cells[0]];
    while (st.length) { const p = st.pop(); for (const q of cells) { const k = q.x + ',' + q.y; if (!seen.has(k) && Math.abs(q.x - p.x) <= 2 && Math.abs(q.y - p.y) <= 2) { seen.add(k); st.push(q); } } }
    if (seen.size !== set.size) continue;
    out.push({ name, W, H, brick, n: cells.length, w: (Math.max(...xs) - Math.min(...xs)) / 2 + 1, h: (Math.max(...ys) - Math.min(...ys)) / 2 + 1 });
  }
  return (BASES[name] = out);
}
/* One pile. o: { shape, seed, target (tiles), layers, aspect, brick (true/false/undefined: either),
   stack (0..1: share of layers right on top = towers), keep [min, max] (share of a layer carried up),
   baseFrac, twin (0..1: chance of two mirrored hills) } */
function buildOnce(r, o, baseTarget) {
  const want = o.aspect / 1.24;
  const pool = basesOf(o.shape).filter(b => o.brick === undefined || b.brick === o.brick);
  if (!pool.length) return null;
  const scored = pool.map(b => ({ b, sc: Math.abs(b.n - baseTarget) / 2 + 6 * Math.abs(Math.log((b.h + 0.25) / (b.w + 0.35) / want)) }));
  const bestSc = Math.min(...scored.map(x => x.sc));
  const cands = scored.filter(x => x.sc <= bestSc + 1.2).map(x => x.b);
  const b = cands[Math.floor(r() * cands.length)];
  const tiles = shapeCells(b.name, b.W, b.H, b.brick).map(t => ({ ...t, z: 0 }));
  const S = Math.min(...tiles.map(t => t.x)) + Math.max(...tiles.map(t => t.x));
  const key = (x, y) => x + ',' + y;
  const cx = S / 2, cy = tiles.reduce((a, t) => a + t.y, 0) / tiles.length;
  const spanX = (Math.max(...tiles.map(t => t.x)) - Math.min(...tiles.map(t => t.x))) / 2;
  const twin = o.layers >= 3 && spanX >= 4 && r() < (o.twin ?? 0.3);
  const hy = cy + Math.round((r() - 0.5) * 2 * (o.hillShift || 1));
  const hd = twin ? Math.max(2, Math.round(spanX * 0.55)) : 0;
  const dist = p => { const dx = Math.abs(p.x - cx), d = twin ? Math.abs(dx - hd) : dx; return Math.hypot(d, (p.y - hy) * 0.9); };
  let remaining = o.target - tiles.length, prev = tiles.slice();
  const zMax = o.layers + (o.layers >= 3 ? 1 : 0);
  for (let z = 1; z < zMax && remaining > 0; z++) {
    const prevSet = new Set(prev.map(t => key(t.x, t.y))), has = (x, y) => prevSet.has(key(x, y));
    const OPS = {
      shiftX: () => prev.filter(t => has(t.x + 2, t.y)).map(t => ({ x: t.x + 1, y: t.y })),
      shiftY: () => prev.filter(t => has(t.x, t.y + 2)).map(t => ({ x: t.x, y: t.y + 1 })),
      shiftXY: () => prev.filter(t => has(t.x + 2, t.y) && has(t.x, t.y + 2) && has(t.x + 2, t.y + 2)).map(t => ({ x: t.x + 1, y: t.y + 1 })),
      stack: () => prev.map(t => ({ x: t.x, y: t.y })),
    };
    const keep = o.keep || [0.52, 0.72];
    const nWant = z >= o.layers - 1 ? remaining : Math.min(remaining, Math.max(2, Math.round(prev.length * (keep[0] + r() * (keep[1] - keep[0])))));
    const order = o.stack && r() < o.stack ? ['stack'] : ['shiftXY', ...shuffleArr(r, ['shiftX', 'shiftY'])];
    let cand = null;
    for (const op of order) { const c = OPS[op](); if (c.length >= Math.min(nWant, 2)) { cand = c; break; } }
    if (!cand || !cand.length) break;
    const seen = new Set(), groups = [], cset = new Map(cand.map(p => [key(p.x, p.y), p]));
    for (const p of cand) {
      const k = key(p.x, p.y); if (seen.has(k)) continue;
      const mk = key(S - p.x, p.y), g = [p]; seen.add(k);
      if (mk !== k && cset.has(mk)) { g.push(cset.get(mk)); seen.add(mk); } else if (mk !== k) continue;
      groups.push({ g, d: dist(p) + r() * 0.35 });
    }
    groups.sort((a, c) => a.d - c.d);
    const placed = [];
    for (const { g } of groups) {
      if (placed.length >= nWant) break;
      if (placed.length + g.length > nWant && placed.length >= nWant - 1 && nWant > 1) continue;
      if (g.some(p => placed.some(q => overlaps(p, q)))) continue;
      g.forEach(p => placed.push({ x: p.x, y: p.y, z }));
    }
    if (!placed.length) break;
    placed.forEach(t => tiles.push(t)); remaining -= placed.length; prev = placed;
  }
  const ox = Math.min(...tiles.map(t => t.x)), oy = Math.min(...tiles.map(t => t.y));
  tiles.forEach(t => { t.x -= ox; t.y -= oy; });
  const S2 = S - 2 * ox;
  if (tiles.length % 2) {
    const nb = neighbors(tiles);
    const mids = tiles.map((t, i) => i).filter(i => tiles[i].x * 2 === S2 && nb.above[i].length === 0);
    const pool2 = mids.length ? mids : tiles.map((t, i) => i).filter(i => nb.above[i].length === 0);
    const maxZ = Math.max(...pool2.map(i => tiles[i].z));
    const top = pool2.filter(i => tiles[i].z === maxZ);
    tiles.splice(top[Math.floor(r() * top.length)], 1);
  }
  return { tiles, base: { name: b.name, W: b.W, H: b.H, brick: b.brick }, twin };
}
function pile(o) {
  const layers = Math.max(1, o.layers);
  const baseFrac = o.baseFrac || (layers <= 2 ? 0.6 : layers === 3 ? 0.47 : layers === 4 ? 0.4 : 0.36);
  let bt = Math.round(o.target * baseFrac), best = null;
  const flat = res => Math.max(0, Math.min(layers, 4) - 1 - Math.max(...res.tiles.map(t => t.z)));
  const score = res => Math.abs(res.tiles.length - o.target) + 4 * flat(res);
  for (let k = 0; k < 12; k++) {
    const res = buildOnce(rng(o.seed + k * 101), o, bt);
    if (!res) return null;
    const n = res.tiles.length;
    if (!best || score(res) < score(best)) best = res;
    if (score(best) <= 1) break;
    if (Math.abs(n - o.target) > 1) bt = Math.max(4, Math.round(bt + (o.target - n) * (n < o.target ? 0.7 : 0.5)));
  }
  return best;
}
module.exports = { pile, SHAPE_NAMES, SHAPES, basesOf };
