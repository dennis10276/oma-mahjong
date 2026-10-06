/* Board shapes + always-solvable deals.
   Coordinates are in half-tile units: a tile at (x,y,z) covers x..x+2, y..y+2 on layer z. */
const Layouts = (() => {
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

  const SHAPES = {
    rect: () => true,
    diamond: (c, r, W, H) => Math.abs(c - (W - 1) / 2) / (W / 2) + Math.abs(r - (H - 1) / 2) / (H / 2) <= 1.01,
    oval: (c, r, W, H) => { const a = (c - (W - 1) / 2) / (W / 2), b = (r - (H - 1) / 2) / (H / 2); return a * a + b * b <= 1.08; },
    cross: (c, r, W, H) => Math.abs(c - (W - 1) / 2) <= Math.max(0.5, W * 0.18) || Math.abs(r - (H - 1) / 2) <= Math.max(0.5, H * 0.18),
    hourglass: (c, r, W, H) => Math.abs(c - (W - 1) / 2) <= Math.abs(r - (H - 1) / 2) / (H / 2) * (W / 2) + 0.6,
    bowtie: (c, r, W, H) => Math.abs(r - (H - 1) / 2) <= Math.abs(c - (W - 1) / 2) / (W / 2) * (H / 2) + 0.6,
    frame: (c, r, W, H) => c < 2 || c > W - 3 || r < 2 || r > H - 3,
    arch: (c, r, W, H) => r < 2 || c < 2 || c > W - 3,
    heart: (c, r, W, H) => {
      const x = (c - (W - 1) / 2) / (W / 2) * 1.25, y = -(r - (H - 1) / 2) / (H / 2) * 1.25 + 0.2;
      const q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0.02;
    },
    stairs: (c, r, W, H) => c <= r * (W / H) + 1.5,
    tower: (c, r, W, H) => Math.abs(c - (W - 1) / 2) <= 1 || r >= H - 2,
    zigzag: (c, r, W, H) => (Math.floor(r / 2) % 2 === 0 ? c < W - 1 : c > 0),
  };
  const NAMES = Object.keys(SHAPES);

  function build(name, W, H, mode, maxLayers) {
    const shape = SHAPES[name];
    const out = [];
    let prev = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (shape(c, r, W, H)) prev.push([c * 2, r * 2]);
    if (prev.length < 4) return null;
    prev.forEach(p => out.push([p[0], p[1], 0]));
    for (let z = 1; z < maxLayers; z++) {
      const set = new Set(prev.map(p => p[0] + ',' + p[1]));
      const has = (x, y) => set.has(x + ',' + y);
      const next = [];
      const m = mode === 'mixed' ? (z % 2 ? 'offset' : 'stack') : mode;
      for (const [x, y] of prev) {
        if (m === 'stack') {
          if (has(x - 2, y) && has(x + 2, y) && has(x, y - 2) && has(x, y + 2)) next.push([x, y]);
        } else if (has(x + 2, y) && has(x, y + 2) && has(x + 2, y + 2)) next.push([x + 1, y + 1]);
      }
      if (!next.length) break;
      next.forEach(p => out.push([p[0], p[1], z]));
      prev = next;
    }
    return out;
  }

  // Pre-compute every shape variant once, indexed by tile count.
  let CATALOG = null;
  function catalog() {
    if (CATALOG) return CATALOG;
    CATALOG = [];
    for (const name of NAMES)
      for (let W = 3; W <= 7; W++)
        for (let H = 3; H <= 9; H++) {
          if (H < W - 1) continue; // keep it portrait-friendly
          for (const mode of ['stack', 'offset'])
            for (let L = 1; L <= 4; L++) {
              if (L === 1 && mode !== 'stack') continue;
              const t = build(name, W, H, mode, L);
              if (!t) continue;
              const layers = 1 + Math.max(...t.map(p => p[2]));
              if (layers < L) continue; // duplicate of a lower L
              CATALOG.push({ name, W, H, mode, L: layers, n: t.length - (t.length % 2) });
            }
        }
    return CATALOG;
  }

  function targetFor(level) {
    if (level <= 10) return 8 + level * 4;           // 12 .. 48
    if (level <= 26) return 48 + Math.round((level - 10) * 2.5 / 2) * 2; // .. 88
    const r = rng(level * 31 + 7);
    if (level % 10 === 0) return 96;                 // a big "party" board every 10 levels
    return 56 + Math.floor(r() * 18) * 2;            // 56 .. 90
  }
  function maxLayersFor(level) { return level < 3 ? 1 : level < 7 ? 2 : level < 16 ? 3 : 4; }
  function kindsFor(pairs, level) {
    // fewer different pictures early on = easier to spot pairs
    const base = Math.ceil(pairs / 2);
    if (level <= 5) return Math.max(3, Math.min(base, 6 + level));
    return Math.min(36, base);
  }

  function choose(seed, target, maxL, maxW) {
    const r = rng(seed);
    let cands = catalog().filter(c => Math.abs(c.n - target) <= 2 && c.L <= maxL && c.W <= maxW && c.n >= 8);
    if (maxL >= 2) { const deep = cands.filter(c => c.L >= 2); if (deep.length > 4) cands = deep; }
    if (!cands.length) cands = catalog().filter(c => c.L <= maxL && c.W <= maxW).sort((a, b) => Math.abs(a.n - target) - Math.abs(b.n - target)).slice(0, 5);
    // vary shapes: pick a shape name first, then a variant
    const names = [...new Set(cands.map(c => c.name))];
    const nm = pick(r, names);
    const c = pick(r, cands.filter(x => x.name === nm));
    let tiles = build(c.name, c.W, c.H, c.mode, c.L).map(([x, y, z]) => ({ x, y, z }));
    if (tiles.length % 2) {
      // drop one tile that has nothing on top of it (the highest one)
      const maxZ = Math.max(...tiles.map(t => t.z));
      const tops = tiles.filter(t => t.z === maxZ);
      const victim = pick(r, tops);
      tiles = tiles.filter(t => t !== victim);
    }
    return { tiles, shape: c.name, r };
  }

  function forLevel(level) {
    const target = targetFor(level);
    const res = choose(level * 7919 + 13, target, maxLayersFor(level), 7);
    const pairs = res.tiles.length / 2;
    return { ...res, kinds: kindsFor(pairs, level), seed: level * 104729 + 1 };
  }

  function forDate(ymd) {
    const r0 = rng(ymd);
    const target = 64 + Math.floor(r0() * 13) * 2; // 64..88
    const res = choose(ymd * 13 + 5, target, 4, 7);
    return { ...res, kinds: Math.min(36, Math.ceil(res.tiles.length / 4)), seed: ymd * 7 + 3 };
  }

  // ---- geometry / rules ----
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
        if (b.z === a.z + 1 && Math.abs(a.x - b.x) < 2) above[i].push(j);
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
    let l = true, r = true;
    for (const j of nb.left[i]) if (alive[j]) { l = false; break; }
    if (l) return true;
    for (const j of nb.right[i]) if (alive[j]) { r = false; break; }
    return r;
  }

  /* Build a deal that is guaranteed to be solvable: we "play the game backwards",
     removing two free tiles at a time from the full board, and give each removed couple the same picture. */
  function deal(n, nb, pairFaces, r, aliveMask) {
    const idx = [];
    for (let i = 0; i < n; i++) if (!aliveMask || aliveMask[i]) idx.push(i);
    for (let attempt = 0; attempt < 80; attempt++) {
      const alive = new Uint8Array(n);
      idx.forEach(i => alive[i] = 1);
      const order = [];
      let left = idx.length, ok = true;
      while (left > 0) {
        const free = idx.filter(i => isFree(i, alive, nb));
        if (free.length < 2) { ok = false; break; }
        const a = free[Math.floor(r() * free.length)];
        let b = a;
        while (b === a) b = free[Math.floor(r() * free.length)];
        alive[a] = alive[b] = 0; left -= 2;
        order.push([a, b]);
      }
      if (!ok) continue;
      const faces = new Array(n).fill(-1);
      const pf = shuffleArr(r, pairFaces.slice());
      order.forEach(([a, b], k) => { faces[a] = faces[b] = pf[k]; });
      return faces;
    }
    // fallback (practically never): random
    const faces = new Array(n).fill(-1);
    const flat = shuffleArr(r, pairFaces.flatMap(f => [f, f]));
    idx.forEach((i, k) => faces[i] = flat[k]);
    return faces;
  }

  function pairFacesFor(pairs, kinds, r) {
    const chosen = shuffleArr(r, [...Array(36).keys()]).slice(0, kinds);
    const out = [];
    for (let k = 0; k < pairs; k++) out.push(chosen[Math.floor(k / 2) % kinds]);
    return out;
  }

  return { rng, forLevel, forDate, neighbors, isFree, deal, pairFacesFor, shuffleArr, targetFor };
})();
