/* Symmetric pile layouts + deals that are always solvable with the 4-slot tray.
   Coordinates are in half-tile units: a tile at (x,y,z) covers x..x+2, y..y+2 on layer z. */
const Layouts = (() => {
  const SLOTS = 4;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function shuffleArr(r, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

  // ---------- base shapes ----------
  /* Every shape is mirror-symmetric left/right, like the boards in Vita Mahjong.
     u = -1..1 across, v = -1 (top) .. 1 (bottom); c may be fractional (brick rows). */
  const UV = (c, r, W, H) => [(c - (W - 1) / 2) / (W / 2), (r - (H - 1) / 2) / (H / 2)];
  const SHAPES = {
    block:     () => true,
    diamond:   (u, v) => Math.abs(u) + Math.abs(v) <= 1.05,
    oval:      (u, v) => u * u + v * v <= 1.1,
    octagon:   (u, v) => Math.abs(u) + Math.abs(v) <= 1.42,
    cross:     (u, v) => Math.abs(u) <= 0.38 || Math.abs(v) <= 0.3,
    hourglass: (u, v) => Math.abs(u) <= Math.abs(v) + 0.3,
    bowtie:    (u, v) => Math.abs(v) <= Math.abs(u) * 0.9 + 0.32,
    heart:     (u, v) => { const x = u * 1.25, y = -v * 1.25 + 0.2, q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0.02; },
    pyramid:   (u, v) => Math.abs(u) <= (v + 1) / 2 + 0.2,
    tree:      (u, v) => v < 0.45 ? Math.abs(u) <= (v + 1.1) / 1.55 : Math.abs(u) <= 0.26,
    house:     (u, v) => v >= -0.25 ? Math.abs(u) <= 0.85 : Math.abs(u) <= (v + 1) / 0.75 * 0.95 + 0.05,
    arch:      (u, v) => !(Math.abs(u) < 0.36 && v > 0.15),
    frame:     (u, v) => !(Math.abs(u) < 0.42 && Math.abs(v) < 0.42),
    letterH:   (u, v) => Math.abs(u) >= 0.4 || Math.abs(v) <= 0.26,
    crown:     (u, v) => v > -0.35 || Math.abs(u) > 0.7 || Math.abs(u) < 0.14,
    butterfly: (u, v) => { const a = Math.abs(u); return a <= 0.18 || ((a - 0.15) ** 2 / 0.75 + (Math.abs(v + 0.15) - 0.05) ** 2 / 0.95 <= 0.85 && Math.abs(v) <= 0.95); },
    vase:      (u, v) => Math.abs(u) <= (v < -0.5 ? 0.5 : v < 0 ? 0.35 + Math.abs(v + 0.5) * 0.5 : 0.95 - v * 0.35),
  };
  // early levels get calm, simple shapes; the fancy ones come later
  const EASY = ['block', 'oval', 'diamond', 'octagon', 'cross', 'pyramid'];
  const NAMES = Object.keys(SHAPES);

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
  let BASES = null;
  function bases() {
    if (BASES) return BASES;
    BASES = [];
    for (const name of NAMES)
      for (const brick of [false, true])
        for (let W = 3; W <= 11; W++)
          for (let H = 3; H <= 11; H++) {
            const cells = shapeCells(name, W, H, brick);
            if (cells.length < 4) continue;
            const xs = cells.map(t => t.x), ys = cells.map(t => t.y);
            // real occupied size in tiles (some shapes leave empty rows or columns)
            const w = (Math.max(...xs) - Math.min(...xs)) / 2 + 1, h = (Math.max(...ys) - Math.min(...ys)) / 2 + 1;
            // skip shapes that fall apart into a thin mess at this size
            const rowsUsed = new Set(ys).size;
            if (rowsUsed < Math.min(H, 3)) continue;
            BASES.push({ name, W, H, brick, n: cells.length, w, h });
          }
    return BASES;
  }

  /* Neat, symmetric piles: a base shape, then each higher layer sits exactly on top,
     or half a tile shifted so it bridges the tiles below (the "stepped" look).
     Layers shrink towards one hill in the middle, or two mirrored hills.
     aspect = height / width of the free screen area: the pile takes the same shape. */
  function buildPiles(seed, target, maxLayers, aspect = 1.55, level = 99) {
    const layers = Math.max(1, maxLayers);
    const baseFrac = layers === 1 ? 1 : layers === 2 ? 0.6 : layers === 3 ? 0.47 : layers === 4 ? 0.4 : 0.36;
    // upper layers can run out of room on some shapes: then try again with a bigger base
    let bt = Math.round(target * baseFrac), best = null;
    for (let k = 0; k < 7; k++) {
      const res = buildOnce(rng(seed + k * 101), target, layers, aspect, level, bt);
      const n = res.tiles.length;
      if (!best || Math.abs(n - target) < Math.abs(best.tiles.length - target)) best = res;
      if (Math.abs(n - target) <= 2) break;
      bt = Math.max(4, Math.round(bt + (target - n) * (n < target ? 0.7 : 0.5)));
    }
    return best;
  }
  function buildOnce(r, target, layers, aspect, level, baseTarget) {
    const want = aspect / 1.24; // rows per column that fill the area exactly
    const pool = level < 8 ? bases().filter(b => EASY.includes(b.name)) : bases();
    const scored = pool.map(b => ({ b, sc: Math.abs(b.n - baseTarget) / 2 + 6 * Math.abs(Math.log((b.h + 0.25) / (b.w + 0.35) / want)) }));
    const bestSc = Math.min(...scored.map(x => x.sc));
    const cands = scored.filter(x => x.sc <= bestSc + 1.2).map(x => x.b);
    const names = [...new Set(cands.map(c => c.name))];
    const nm = pick(r, names);
    const b = pick(r, cands.filter(c => c.name === nm));
    const tiles = shapeCells(b.name, b.W, b.H, b.brick).map(t => ({ ...t, z: 0 }));

    const S = Math.min(...tiles.map(t => t.x)) + Math.max(...tiles.map(t => t.x)); // mirror: x -> S - x
    const key = (x, y) => x + ',' + y;
    const cx = S / 2, cy = tiles.reduce((a, t) => a + t.y, 0) / tiles.length;
    // the top of the pile: one hill in the middle, or two mirrored hills (now and then)
    const spanX = (Math.max(...tiles.map(t => t.x)) - Math.min(...tiles.map(t => t.x))) / 2;
    const twin = layers >= 3 && spanX >= 4 && r() < 0.3;
    const hy = cy + Math.round((r() - 0.5) * 2) * 1;
    const hd = twin ? Math.max(2, Math.round(spanX * 0.55)) : 0;
    const dist = p => {
      const dx = Math.abs(p.x - cx), d = twin ? Math.abs(dx - hd) : dx;
      return Math.hypot(d * 1.0, (p.y - hy) * 0.9);
    };

    let remaining = target - tiles.length;
    let prev = tiles.slice();
    let lastOp = '';
    // the planned number of layers; if the top ran out of room, one extra small layer
    const zMax = layers + (layers >= 3 ? 1 : 0);
    for (let z = 1; z < zMax && remaining > 0; z++) {
      const prevSet = new Set(prev.map(t => key(t.x, t.y)));
      const has = (x, y) => prevSet.has(key(x, y));
      const OPS = {
        stack: () => prev.map(t => ({ x: t.x, y: t.y })),
        shiftX: () => prev.filter(t => has(t.x + 2, t.y)).map(t => ({ x: t.x + 1, y: t.y })),
        shiftY: () => prev.filter(t => has(t.x, t.y + 2)).map(t => ({ x: t.x, y: t.y + 1 })),
        shiftXY: () => prev.filter(t => has(t.x + 2, t.y) && has(t.x, t.y + 2) && has(t.x + 2, t.y + 2)).map(t => ({ x: t.x + 1, y: t.y + 1 })),
      };
      const nWant = z >= layers - 1 ? remaining : Math.min(remaining, Math.max(2, Math.round(prev.length * (0.52 + r() * 0.2))));
      // pick a way of stacking that has room for this layer; vary it from layer to layer
      const order = shuffleArr(r, ['stack', 'shiftX', 'shiftXY', 'shiftY', 'shiftX']).filter((o, k, a) => a.indexOf(o) === k);
      order.sort((a, c) => (a === lastOp) - (c === lastOp));
      let cand = null, op = '';
      for (const o of order) { const c = OPS[o](); if (c.length >= Math.min(nWant, 2)) { cand = c; op = o; break; } }
      if (!cand || !cand.length) break;
      lastOp = op;
      // group mirror twins so the layer stays symmetric, then fill from the hilltop outwards
      const seen = new Set(), groups = [];
      const cset = new Map(cand.map(p => [key(p.x, p.y), p]));
      for (const p of cand) {
        const k = key(p.x, p.y); if (seen.has(k)) continue;
        const mk = key(S - p.x, p.y);
        const g = [p]; seen.add(k);
        if (mk !== k && cset.has(mk)) { g.push(cset.get(mk)); seen.add(mk); }
        else if (mk !== k) continue; // no mirror partner: leave it out
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
      placed.forEach(t => tiles.push(t));
      remaining -= placed.length;
      prev = placed;
    }
    // normalise so coordinates start at 0
    const ox = Math.min(...tiles.map(t => t.x)), oy = Math.min(...tiles.map(t => t.y));
    tiles.forEach(t => { t.x -= ox; t.y -= oy; });
    const S2 = S - 2 * ox;
    if (tiles.length % 2) {
      // an odd count always has a tile on the middle line: take the highest uncovered one off
      const nb = neighbors(tiles);
      const mids = tiles.map((t, i) => i).filter(i => tiles[i].x * 2 === S2 && nb.above[i].length === 0);
      const pool2 = mids.length ? mids : tiles.map((t, i) => i).filter(i => nb.above[i].length === 0);
      const maxZ = Math.max(...pool2.map(i => tiles[i].z));
      tiles.splice(pick(r, pool2.filter(i => tiles[i].z === maxZ)), 1);
    }
    return { tiles, shape: b.name };
  }

  // ---------- difficulty ramp ----------
  /* Like Vita Mahjong: even level 1 is a big, full board, it is just easy to match
     (few different pictures, so almost every free tile has a free twin). */
  function targetFor(level) {
    if (level <= 10) return 56 + Math.round((level - 1) * 2 / 2) * 2;     // 56 .. 74
    if (level <= 26) return 74 + Math.round((level - 10) / 2) * 2;        // .. 90
    if (level % 10 === 0) return 96;                                      // a big "party" board every 10 levels
    const r = rng(level * 31 + 7);
    return 72 + Math.floor(r() * 12) * 2;                                 // 72 .. 94
  }
  function layersFor(level) { return level < 2 ? 2 : level < 14 ? 3 : level < 25 ? 4 : 5; }
  /* cap  = how many slots the intended solution needs at its tightest moment
     open = how eagerly the deal "parks" tiles whose partner is still buried */
  function difficultyFor(level) {
    const t = Math.min(1, Math.max(0, (level - 3) / 17));   // 0 up to level 3, 1 from level 20
    return {
      cap: level < 4 ? 2 : 3,   // never needs more than 3 waiting tiles (the 4th slot ends the level)
      open: 0.15 + 0.75 * t,
      // share of pictures that appear only twice instead of four times (rarer = harder)
      rare: Math.min(0.9, Math.max(0, (level - 4) / 16)),
      // share of tiles lying face down
      down: level < 5 ? 0 : Math.min(0.4, 0.08 + (level - 5) * 0.013),
      // how often a sensible player should clear the board first try
      target: level <= 3 ? 1 : level <= 6 ? 0.95 : level < 10 ? 0.85 : level < 20 ? 0.75 - (level - 10) * 0.015 : Math.max(0.42, 0.6 - (level - 20) * 0.01),
    };
  }
  function kindsFor(pairs, level, diff) {
    // first levels: every picture 6 times (level 1-3) or 4 times (level 4-6): lots of easy matches
    if (level <= 3) return Math.max(4, Math.round(pairs / 3));
    if (level <= 6) return Math.max(4, Math.ceil(pairs / 2));
    // pairs = 2*k4 + k2 ; kinds = k4 + k2 ; k2 share grows with level
    const k = Math.round(pairs / 2 + pairs / 2 * diff.rare);
    return Math.max(3, Math.min(36, k));
  }

  /* Gentler curve: after level 6 the difficulty climbs at half speed
     (level 26 now plays like the old level 16). */
  const effLevel = level => level <= 6 ? level : 6 + (level - 6) / 2;
  function forLevel(level, aspect, scale = 1) {
    const e = effLevel(level);
    let target = targetFor(Math.round(e));
    if (e > 26) target = targetFor(level);           // keep variety in the endless levels
    target = Math.max(8, Math.round(target * scale));
    target -= target % 2;
    const res = buildPiles(level * 7919 + 13, target, layersFor(e), aspect, level);
    const diff = difficultyFor(e);
    return { ...res, kinds: kindsFor(res.tiles.length / 2, e, diff), seed: level * 104729 + 1, diff };
  }
  function forDate(ymd, aspect, scale = 1) {
    const r0 = rng(ymd);
    let target = Math.round((60 + Math.floor(r0() * 11) * 2) * scale); target -= target % 2; // 60..80
    const res = buildPiles(ymd * 13 + 5, target, 4, aspect);
    const diff = { ...difficultyFor(10), target: 0.75, down: 0.15 };
    return { ...res, kinds: kindsFor(res.tiles.length / 2, 10, diff), seed: ymd * 7 + 3, diff };
  }

  /* Gentler deals for grandma (see careMode): the same pile, but more matching pictures.
     ez 1 = always for her: fewer rare pictures and face-down tiles, an easier deal;
     ez 2 = after 2 failed tries: every picture 4 times, half the face-down tiles;
     ez 3 = after 4 failed tries: every picture about 6 times, no face-down tiles. */
  function ease(spec, ez) {
    if (!ez) return spec;
    const pairs = spec.tiles.length / 2, d = spec.diff;
    let kinds, diff;
    if (ez >= 3) { kinds = Math.max(4, Math.round(pairs / 3)); diff = { ...d, rare: 0, down: 0, open: 0.15, cap: 2, target: 1 }; }
    else if (ez === 2) { kinds = Math.max(4, Math.ceil(pairs / 2)); diff = { ...d, rare: 0, down: d.down / 2, open: d.open * 0.5, target: Math.max(d.target, 0.95) }; }
    else { const rare = d.rare / 2; kinds = Math.round(pairs / 2 + pairs / 2 * rare); diff = { ...d, rare, down: d.down * 0.6, open: d.open * 0.75, target: Math.max(d.target, 0.9) }; }
    return { ...spec, kinds: Math.min(kinds, spec.kinds), diff, seed: spec.seed + ez * 7777 };
  }

  // ---------- rules ----------
  function neighbors(tiles) {
    const n = tiles.length;
    const above = [], left = [], right = [];
    for (let i = 0; i < n; i++) { above.push([]); left.push([]); right.push([]); }
    for (let i = 0; i < n; i++) {
      const a = tiles[i];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b = tiles[j];
        if (Math.abs(a.y - b.y) >= 2) continue;
        if (b.z > a.z && Math.abs(a.x - b.x) < 2) above[i].push(j);
        else if (b.z === a.z) {
          if (b.x === a.x - 2) left[i].push(j);
          else if (b.x === a.x + 2) right[i].push(j);
        }
      }
    }
    return { above, left, right };
  }
  function isFree(i, alive, nb) {
    if (!alive[i]) return false;
    for (const j of nb.above[i]) if (alive[j]) return false;
    let l = true;
    for (const j of nb.left[i]) if (alive[j]) { l = false; break; }
    if (l) return true;
    for (const j of nb.right[i]) if (alive[j]) return false;
    return true;
  }

  /* Deal pictures so that a solution exists with the 4-slot tray.
     We pick a random order in which tiles can be taken off the board, then walk that order:
     a tile either "parks" a new picture in the tray (its partner comes later) or closes a parked one.
     At most `cap` pictures are ever parked, so following that order never needs more than `cap` slots.
     `openFaces` = pictures already sitting in the tray (used when shuffling mid-game). */
  function deal(tiles, nb, pairFaces, r, opts = {}) {
    const n = tiles.length;
    const cap = Math.max(opts.cap || 3, (opts.openFaces || []).length);
    const pOpen = opts.open ?? 0.3;
    const idx = [];
    for (let i = 0; i < n; i++) if (!opts.alive || opts.alive[i]) idx.push(i);
    for (let attempt = 0; attempt < 60; attempt++) {
      const alive = new Uint8Array(n);
      idx.forEach(i => alive[i] = 1);
      const order = [];
      let ok = true;
      for (let k = 0; k < idx.length; k++) {
        const free = idx.filter(i => isFree(i, alive, nb));
        if (!free.length) { ok = false; break; }
        const i = free[Math.floor(r() * free.length)];
        alive[i] = 0; order.push(i);
      }
      if (!ok) continue;
      const faces = new Array(n).fill(-1);
      const open = (opts.openFaces || []).slice();
      const pool = shuffleArr(r, pairFaces.slice());
      for (let k = 0; k < order.length; k++) {
        const i = order[k];
        const after = order.length - k - 1;
        const canOpen = pool.length > 0 && open.length < cap && after >= open.length + 1;
        if (canOpen && (open.length === 0 || r() < pOpen)) {
          let pi = pool.findIndex(f => !open.includes(f));
          if (pi < 0) pi = 0;
          const f = pool.splice(pi, 1)[0];
          faces[i] = f; open.push(f);
        } else if (open.length) {
          const j = Math.floor(r() * open.length);
          faces[i] = open[j]; open.splice(j, 1);
        } else { ok = false; break; }
      }
      if (ok && open.length === 0) return faces;
    }
    // fallback (practically never): random
    const faces = new Array(n).fill(-1);
    const flat = shuffleArr(r, pairFaces.flatMap(f => [f, f]).concat(opts.openFaces || []));
    idx.forEach((i, k) => faces[i] = flat[k]);
    return faces;
  }

  /* A sensible simulated player: takes a tray match, else a visible free pair,
     else digs where it uncovers the most. Returns the share of runs that clear the board. */
  function botWinRate(tiles, nb, faces, runs = 8, seed = 1) {
    const n = tiles.length;
    const covers = new Array(n).fill(0);
    for (let j = 0; j < n; j++) for (const i of nb.above[j]) covers[i]++;
    let wins = 0;
    for (let k = 0; k < runs; k++) {
      const r = rng(seed * 991 + k * 7919);
      const alive = new Uint8Array(n).fill(1);
      const tray = [];
      let ok = true;
      for (let step = 0; step < n; step++) {
        const fr = [];
        for (let i = 0; i < n; i++) if (isFree(i, alive, nb)) fr.push(i);
        let m = fr.find(i => tray.includes(faces[i]));
        if (m === undefined) {
          if (tray.length >= SLOTS - 1) { ok = false; break; }  // a 4th unmatched tile ends the level
          const cnt = {};
          fr.forEach(i => cnt[faces[i]] = (cnt[faces[i]] || 0) + 1);
          const pr = fr.filter(i => cnt[faces[i]] >= 2);
          if (pr.length) m = pr[Math.floor(r() * pr.length)];
          else {
            let best = -1; let bs = [];
            for (const i of fr) { const c = covers[i] + r() * 0.9; if (c > best) { best = c; bs = [i]; } }
            m = bs[0];
          }
        }
        alive[m] = 0;
        const ti = tray.indexOf(faces[m]);
        if (ti >= 0) tray.splice(ti, 1); else tray.push(faces[m]);
      }
      if (ok && tray.length === 0) wins++;
    }
    return wins / runs;
  }

  /* Try several deals for a level and keep the one whose difficulty is closest to the level's target. */
  function makeDeal(spec, tries = 28) {
    const tiles = spec.tiles, nb = neighbors(tiles);
    let best = null;
    for (let k = 0; k < tries; k++) {
      const r = rng(spec.seed + k * 31337);
      const pf = pairFacesFor(tiles.length / 2, spec.kinds, r);
      const faces = deal(tiles, nb, pf, r, spec.diff);
      const w = botWinRate(tiles, nb, faces, 8, spec.seed + k);
      const score = Math.abs(w - spec.diff.target);
      if (!best || score < best.score) best = { faces, w, score };
      if (score < 0.04) break;
    }
    const r2 = rng(spec.seed + 777);
    const nDown = Math.round(tiles.length * (spec.diff.down || 0));
    best.down = shuffleArr(r2, tiles.map((t, i) => i)).slice(0, nDown);
    return best;
  }

  function pairFacesFor(pairs, kinds, r) {
    const chosen = shuffleArr(r, [...Array(36).keys()]).slice(0, kinds);
    const out = [];
    const doubles = Math.max(0, pairs - kinds); // pictures that appear 4x
    chosen.forEach((f, i) => { out.push(f); if (i < doubles) out.push(f); });
    while (out.length < pairs) out.push(chosen[out.length % kinds]);
    return out.slice(0, pairs);
  }

  /* Small depth-first solver: finds a next move that still leads to a full clear (used by the hint). */
  function solve(tiles, nb, faces, alive0, tray0, limit = 25000) {
    const n = tiles.length;
    const alive = Uint8Array.from(alive0);
    let nodes = 0;
    const dead = new Set();
    const key = (tray) => { let s = ''; for (let i = 0; i < n; i++) s += alive[i]; return s + '|' + tray.map(t => faces[t]).sort((a, b) => a - b).join(','); };
    function moves(tray) {
      const fr = [];
      for (let i = 0; i < n; i++) if (isFree(i, alive, nb)) fr.push(i);
      const tf = new Set(tray.map(t => faces[t]));
      const match = fr.filter(i => tf.has(faces[i]));
      const cnt = {};
      fr.forEach(i => cnt[faces[i]] = (cnt[faces[i]] || 0) + 1);
      const pair = fr.filter(i => !tf.has(faces[i]) && cnt[faces[i]] >= 2);
      const rest = fr.filter(i => !tf.has(faces[i]) && cnt[faces[i]] < 2);
      if (match.length) return [match[0]];           // taking a match is always safe
      if (tray.length >= SLOTS - 1) return [];  // only 3 unmatched tiles may wait in the tray
      return [...pair.slice(0, 2), ...rest];
    }
    function rec(tray, left) {
      if (left === 0 && tray.length === 0) return true;
      if (++nodes > limit) return false;
      const k = key(tray);
      if (dead.has(k)) return false;
      for (const m of moves(tray)) {
        alive[m] = 0;
        const mi = tray.findIndex(t => faces[t] === faces[m]);
        const nt = mi >= 0 ? tray.filter((_, q) => q !== mi) : tray.concat([m]);
        if (rec(nt, left - 1)) { alive[m] = 1; path.unshift(m); return true; }
        alive[m] = 1;
      }
      dead.add(k);
      return false;
    }
    const path = [];
    let left = 0; for (let i = 0; i < n; i++) left += alive[i];
    const ok = rec(tray0.slice(), left);
    return ok ? path : null;
  }

  return { SLOTS, effLevel, rng, makeDeal, botWinRate, forLevel, forDate, ease, neighbors, isFree, deal, pairFacesFor, shuffleArr, solve, difficultyFor, targetFor };
})();
if (typeof module !== 'undefined') module.exports = Layouts;
