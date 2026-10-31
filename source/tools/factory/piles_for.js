/* Level factory, step 1: a pile for every new level (Claude, 2026-10-28, for Dennis).
   Shapes: the 42 Dennis picked in the shape catalogue (2026-10-24), no towers, tiles at least 52 px
   (Dennis 2026-10-26: "52 is okay, less is not"). Variety: a shape (or a variation of it) is not reused within 10 levels, and
   at most 75% of the tile spots may be shared with any played level (70-164) or any level within 10.
   Dennis 2026-10-31: "get rid of the blob levels" / "I like the pile shape better than blobs": the blob
   shapes are out. With a keep file, its piles stay and only the blob ones get a new shape.
     node source/tools/factory/piles_for.js <from> <to> <out.json> [keep.json]                      */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js')); global.Layouts = L;
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const { pile } = require(path.join(ROOT, 'tools', 'sim', 'variety', 'piles.js'));
const MIN_PX = 52, MAX_SHARE = 0.75, PLAYED_TO = 164, KEEP_FROM = 165;

const tilePx = tiles => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; for (const t of tiles) { const x = t.x / 2 - t.z * 0.14, y = t.y / 2 * 1.24 - t.z * 0.14; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + 1.24); } return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16)); };
const towers = t => { const k = new Set(t.map(p => p.x + ',' + p.y + ',' + p.z)); return t.some(p => p.z > 0 && k.has(p.x + ',' + p.y + ',' + (p.z - 1))); };
const norm = t => { const mx = Math.min(...t.map(a => a[0])), my = Math.min(...t.map(a => a[1])); return t.map(([x, y, z]) => [x - mx, y - my, z]); };
const mir = t => { const w = Math.max(...t.map(a => a[0])); return t.map(([x, y, z]) => [w - x, y, z]); };
const spots = t => [new Set(norm(t).map(a => a.join())), new Set(norm(mir(t)).map(a => a.join()))];
const ov = (a, b) => { let c = 0; for (const k of a) if (b.has(k)) c++; return c / Math.max(a.size, b.size); };
const share = (t, q) => { const s = spots(t); return Math.max(ov(s[0], q), ov(s[1], q)); };

// Dennis's picks (shape catalogue, collection "picks"): every shape he saw, with its variation
const STD = { layers: [3, 4, 5, 6], base: [undefined, 0.3, 0.36, 0.42, 0.5] };
const SHAPES = [
  ...['arch', 'block', 'bowtie', 'butterfly', 'cross', 'crown', 'diamond', 'frame', 'heart', 'hourglass', 'house', 'letterH', 'octagon', 'oval', 'pyramid', 'vase',
    'castle', 'moon', 'star', 'steps', 'twins', 'ushape',
  ].map(s => ({ name: s, shape: s, ...STD })),
  { name: 'heart · flat', shape: 'heart', layers: [2, 3], base: [undefined, 0.55, 0.65, 0.75] },
  ...['octagon', 'pyramid'].map(s => ({ name: s + ' · tall', shape: s, layers: [6, 5, 7], base: [undefined, 0.22, 0.26, 0.3] })),
  ...['block', 'castle', 'oval'].map(s => ({ name: s + ' · two islands', shape: s, layers: [3, 4, 5], base: [undefined, 0.34, 0.42, 0.5], twin: 1, twinOnly: true })),
  ...['bowtie', 'hourglass', 'steps'].map(s => ({ name: s + ' · ridges', shape: s, layers: [3, 4, 5], base: [undefined, 0.36, 0.42, 0.5], keep: [0.8, 0.95] })),
];
const SIZES = [72, 76, 80, 82, 84, 86, 88];

function candidate(sh, N, seed, fits = () => true) {   // (the first pile that fits every rule)
  for (const ly of sh.layers) for (const bf of sh.base) for (const aspect of [1.6, 1.3, 2, 1.1]) for (const brick of [false, true]) {
    const p = pile({ shape: sh.shape, seed: seed + ly * 7 + Math.round((bf || 0) * 100), target: N, layers: ly, aspect, baseFrac: bf, stack: 0, keep: sh.keep || [0.55, 0.8], twin: sh.twin ?? 0.35, brick });
    if (!p || Math.abs(p.tiles.length - N) > 4 || p.tiles.length % 2 || tilePx(p.tiles) < MIN_PX || towers(p.tiles)) continue;
    if (sh.twinOnly && !p.twin) continue;
    const t = p.tiles.map(q => [q.x, q.y, q.z]);
    if (fits(t)) return t;
  }
  return null;
}

if (require.main === module) {
  const [from, to, out, keepFile] = [+process.argv[2], +process.argv[3], process.argv[4], process.argv[5]];
  const keep = keepFile ? Object.fromEntries(JSON.parse(fs.readFileSync(keepFile, 'utf8')).filter(k => !/^blob/.test(k.base)).map(k => [k.level, k])) : {};
  const played = []; for (let lv = 70; lv <= PLAYED_TO; lv++) played.push(spots(Hard.get(lv).tiles)[0]);
  const made = {};                        // level -> tiles (existing levels from KEEP_FROM count as neighbours)
  for (let lv = KEEP_FROM; lv < from; lv++) made[lv] = Hard.get(lv).tiles;
  for (const k of Object.values(keep)) made[k.level] = k.tiles;
  const result = [];
  for (let lv = from; lv <= to; lv++) {
    const r = L.rng(lv * 6151 + 17), order = L.shuffleArr(r, SHAPES.slice());
    if (keep[lv]) { result.push(keep[lv]); console.log(lv, keep[lv].shape, '(kept)'); continue; }
    // no shape (or a variation of it) twice within 10 levels (kept later levels count too)
    const recent = [...result.slice(-10).map(x => x.base), ...Object.values(keep).filter(k => k.level > lv && k.level - lv <= 10).map(k => k.base)];
    const N = lv % 10 === 0 ? 96 : SIZES[Math.floor(r() * SIZES.length)];
    let pick = null;
    for (const sh of order) {
      if (recent.includes(sh.shape)) continue;
      for (let s = 0; s < 4 && !pick; s++) {
        const near = Object.entries(made).filter(([k]) => Math.abs(+k - lv) <= 10).map(([, v]) => spots(v)[0]);
        const worstOf = t => Math.max(...played.map(q => share(t, q)), ...near.map(q => share(t, q)));
        let t = candidate(sh, N, lv * 101 + s * 9973, t => worstOf(t) <= MAX_SHARE);
        if (!t && N === 96) t = candidate(sh, 88, lv * 101 + s * 9973, t => worstOf(t) <= MAX_SHARE);
        if (!t) continue;
        const worst = worstOf(t);
        pick = { level: lv, shape: sh.name, base: sh.shape, tiles: t, n: t.length, px: +tilePx(t.map(([x, y, z]) => ({ x, y, z }))).toFixed(1), shared: +worst.toFixed(2) };
      }
      if (pick) break;
    }
    if (!pick) { console.log(lv, 'no pile found'); continue; }
    made[lv] = pick.tiles; result.push(pick);
    console.log(lv, pick.shape, pick.n, 'tiles', pick.px, 'px', 'shared', pick.shared);
  }
  fs.writeFileSync(out, JSON.stringify(result));
}
module.exports = { SHAPES, tilePx, towers, spots, share };
