/* Messy-pile layouts + deals that are always solvable with the 4-slot tray.
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
  const SHAPES = {
    rect: () => true,
    diamond: (c, r, W, H) => Math.abs(c - (W - 1) / 2) / (W / 2) + Math.abs(r - (H - 1) / 2) / (H / 2) <= 1.01,
    oval: (c, r, W, H) => { const a = (c - (W - 1) / 2) / (W / 2), b = (r - (H - 1) / 2) / (H / 2); return a * a + b * b <= 1.08; },
    cross: (c, r, W, H) => Math.abs(c - (W - 1) / 2) <= Math.max(0.5, W * 0.18) || Math.abs(r - (H - 1) / 2) <= Math.max(0.5, H * 0.18),
    hourglass: (c, r, W, H) => Math.abs(c - (W - 1) / 2) <= Math.abs(r - (H - 1) / 2) / (H / 2) * (W / 2) + 0.6,
    heart: (c, r, W, H) => {
      const x = (c - (W - 1) / 2) / (W / 2) * 1.25, y = -(r - (H - 1) / 2) / (H / 2) * 1.25 + 0.2;
      const q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0.02;
    },
    stairs: (c, r, W, H) => c <= r * (W / H) + 1.5,
    zigzag: (c, r, W, H) => (Math.floor(r / 2) % 2 === 0 ? c < W - 1 : c > 0),
  };
  const NAMES = Object.keys(SHAPES);

  let BASES = null;
  function bases() {
    if (BASES) return BASES;
    BASES = [];
    for (const name of NAMES)
      for (let W = 3; W <= 10; W++)
        for (let H = 3; H <= 10; H++) {
          let n = 0, c0 = 99, c1 = -1, r0 = 99, r1 = -1;
          for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (SHAPES[name](c, r, W, H)) { n++; c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
          // real occupied size (some shapes leave empty rows/columns)
          if (n >= 4) BASES.push({ name, W, H, n, w: c1 - c0 + 1, h: r1 - r0 + 1 });
        }
    return BASES;
  }

  /* A base layer, then messy piles on top: each upper tile lands at a random half-tile
     offset, resting on one or more tiles below (never overlapping its own layer). */
  /* aspect = height / width of the free screen area: the pile takes the same shape,
     so its tiles can grow until it fills the space. */
  function buildPiles(seed, target, maxLayers, aspect = 1.55) {
    const r = rng(seed);
    const layers = Math.max(1, maxLayers);
    const baseFrac = layers === 1 ? 1 : layers === 2 ? 0.62 : layers === 3 ? 0.5 : 0.44;
    const baseTarget = Math.round(target * baseFrac);
    const brick = layers > 1 && r() < 0.45; // shift every other row by half a tile
    const want = aspect / 1.24; // rows per column that fill the area exactly
    const scored = bases().map(b => ({ b, sc: Math.abs(b.n - baseTarget) / 2 + 6 * Math.abs(Math.log((b.h + 0.25) / (b.w + (brick ? 0.5 : 0) + 0.35) / want)) }));
    const bestSc = Math.min(...scored.map(x => x.sc));
    const cands = scored.filter(x => x.sc <= bestSc + 0.6).map(x => x.b);
    const names = [...new Set(cands.map(c => c.name))];
    const nm = pick(r, names);
    const b = pick(r, cands.filter(c => c.name === nm));
    const tiles = [];
    for (let row = 0; row < b.H; row++)
      for (let c = 0; c < b.W; c++)
        if (SHAPES[b.name](c, row, b.W, b.H)) tiles.push({ x: c * 2 + (brick && row % 2 ? 1 : 0), y: row * 2, z: 0 });

    let remaining = target - tiles.length;
    let prev = tiles.slice();
    const minX = Math.min(...tiles.map(t => t.x)), maxX = Math.max(...tiles.map(t => t.x));
    const minY = Math.min(...tiles.map(t => t.y)), maxY = Math.max(...tiles.map(t => t.y));
    // usually one big hill; now and then two or three
    const nh = r() < 0.72 ? 1 : r() < 0.65 ? 2 : 3;
    const cx = tiles.reduce((a, t) => a + t.x, 0) / tiles.length, cy = tiles.reduce((a, t) => a + t.y, 0) / tiles.length;
    const centers = [];
    if (nh === 1) centers.push({ x: cx + (r() - 0.5) * 2, y: cy + (r() - 0.5) * 2 });
    else {
      const pool = shuffleArr(r, tiles.slice());
      centers.push(pool[0]);
      while (centers.length < nh) {
        let best = null, bd = -1;
        for (const t of pool) { const d = Math.min(...centers.map(c => Math.hypot(c.x - t.x, c.y - t.y))); if (d > bd) { bd = d; best = t; } }
        centers.push(best);
      }
    }
    const hillDist = p => Math.min(...centers.map(c => Math.hypot(c.x - p.x, c.y - p.y))) / 2; // in tiles
    for (let z = 1; z < layers && remaining > 0; z++) {
      const want = z === layers - 1 ? remaining : Math.min(remaining, Math.max(2, Math.round(prev.length * (0.55 + r() * 0.2))));
      const cand = [];
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const p = { x, y };
          let support = 0;
          for (const q of prev) if (overlaps(p, q)) support++;
          if (support === 0) continue;
          const exact = prev.some(q => q.x === x && q.y === y);
          // prefer resting on 2+ tiles, close to the top of the hill
          cand.push({ x, y, w: support + (exact ? 0.3 : 0) + r() * 1.6 - hillDist(p) * 1.4 });
        }
      cand.sort((a, b) => b.w - a.w);
      const placed = [];
      for (const c of cand) {
        if (placed.length >= want) break;
        if (placed.some(q => overlaps(q, c))) continue;
        placed.push({ x: c.x, y: c.y, z });
      }
      if (!placed.length) break;
      placed.forEach(t => tiles.push(t));
      remaining -= placed.length;
      prev = placed;
    }
    // normalise so coordinates start at 0
    const ox = Math.min(...tiles.map(t => t.x)), oy = Math.min(...tiles.map(t => t.y));
    tiles.forEach(t => { t.x -= ox; t.y -= oy; });
    if (tiles.length % 2) {
      const nb = neighbors(tiles);
      const tops = tiles.map((t, i) => i).filter(i => nb.above[i].length === 0);
      const maxZ = Math.max(...tops.map(i => tiles[i].z));
      const victim = pick(r, tops.filter(i => tiles[i].z === maxZ));
      tiles.splice(victim, 1);
    }
    return { tiles, shape: b.name };
  }

  // ---------- difficulty ramp ----------
  function targetFor(level) {
    if (level <= 10) return 8 + level * 4;                                // 12 .. 48
    if (level <= 26) return 48 + Math.round((level - 10) * 2.5 / 2) * 2;  // .. 88
    if (level % 10 === 0) return 96;                                      // a big "party" board every 10 levels
    const r = rng(level * 31 + 7);
    return 60 + Math.floor(r() * 16) * 2;                                 // 60 .. 90
  }
  function layersFor(level) { return level < 3 ? 1 : level < 6 ? 2 : level < 14 ? 3 : level < 25 ? 4 : 5; }
  /* cap  = how many slots the intended solution needs at its tightest moment
     open = how eagerly the deal "parks" tiles whose partner is still buried */
  function difficultyFor(level) {
    const t = Math.min(1, Math.max(0, (level - 3) / 17));   // 0 up to level 3, 1 from level 20
    return {
      cap: level < 4 ? 2 : level < 12 ? 3 : 4,
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
    if (level <= 3) return Math.max(3, Math.ceil(pairs / 2));
    // pairs = 2*k4 + k2 ; kinds = k4 + k2 ; k2 share grows with level
    const k = Math.round(pairs / 2 + pairs / 2 * diff.rare);
    return Math.max(3, Math.min(36, k));
  }

  /* Gentler curve: after level 6 the difficulty climbs at half speed
     (level 26 now plays like the old level 16). */
  const effLevel = level => level <= 6 ? level : 6 + (level - 6) / 2;
  function forLevel(level, aspect) {
    const e = effLevel(level);
    let target = targetFor(Math.round(e));
    if (e > 26) target = targetFor(level);           // keep variety in the endless levels
    target -= target % 2;
    const res = buildPiles(level * 7919 + 13, target, layersFor(e), aspect);
    const diff = difficultyFor(e);
    return { ...res, kinds: kindsFor(res.tiles.length / 2, e, diff), seed: level * 104729 + 1, diff };
  }
  function forDate(ymd, aspect) {
    const r0 = rng(ymd);
    const target = 60 + Math.floor(r0() * 11) * 2; // 60..80
    const res = buildPiles(ymd * 13 + 5, target, 4, aspect);
    const diff = { ...difficultyFor(10), target: 0.75, down: 0.15 };
    return { ...res, kinds: kindsFor(res.tiles.length / 2, 10, diff), seed: ymd * 7 + 3, diff };
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
          if (tray.length >= SLOTS) { ok = false; break; }
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
      if (tray.length >= SLOTS) return [];
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

  return { SLOTS, effLevel, rng, makeDeal, botWinRate, forLevel, forDate, neighbors, isFree, deal, pairFacesFor, shuffleArr, solve, difficultyFor, targetFor };
})();
if (typeof module !== 'undefined') module.exports = Layouts;
