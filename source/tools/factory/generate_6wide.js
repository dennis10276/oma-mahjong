#!/usr/bin/env node
'use strict';
/**
 * Generate the 6-wide layout catalogue (levels 301+, 42 normal 72..88t + 6 big 96t)
 * reusing piles.js bases, half-tile shift operations (shiftXY / shiftX / shiftY),
 * originality.js D4 checks (<= 0.75), footprint.js, human_board_visibility.js,
 * and trap_stories.js chain placement pre-screening.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const L = require(path.join(ROOT, 'www/layouts.js'));
const P = require(path.join(ROOT, 'tools/sim/variety/piles.js'));
const PF = require(path.join(ROOT, 'tools/factory/piles_for.js'));
const { layoutKey, fitsLayouts } = require(path.join(ROOT, 'tools/factory/originality.js'));
const FP = require(path.join(ROOT, 'tools/builder/footprint.js'));
const H = require(path.join(ROOT, 'tools/sim/refit/human_board_visibility.js'));
const B = require(path.join(ROOT, 'tools/builder/builder.js'));
const T = require(path.join(ROOT, 'tools/builder/trap_stories.js'));

const OUT_PATH = path.join(ROOT, 'analysis/builder/data/layouts-6wide.json');
const EXISTING_PATH = path.join(ROOT, 'analysis/builder/data/layouts.json');

const FAMILIES_18 = [
  'arch', 'steps', 'vase', 'ushape', 'twins', 'moon',
  'pyramid', 'frame', 'cross', 'heart', 'letterH', 'house',
  'hourglass', 'bowtie', 'castle', 'star', 'diamond', 'oval',
];

const OP_MODES = [
  { tag: 'xy', seq: [['shiftXY', 'shiftX', 'shiftY']] },
  { tag: 'x', seq: [['shiftX', 'shiftXY', 'shiftY']] },
  { tag: 'y', seq: [['shiftY', 'shiftXY', 'shiftX']] },
  { tag: 'xy-x', seq: [['shiftXY', 'shiftX'], ['shiftX', 'shiftXY']] },
  { tag: 'x-y', seq: [['shiftX', 'shiftXY'], ['shiftY', 'shiftXY']] },
  { tag: 'y-x', seq: [['shiftY', 'shiftXY'], ['shiftX', 'shiftXY']] },
];

const UV = (c, r, W, Hgrid) => [(c - (W - 1) / 2) / (W / 2), (r - (Hgrid - 1) / 2) / (Hgrid / 2)];
const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
const mkRng = (s) => () => (((s = (Math.imul(1664525, s) + 1013904223) >>> 0)) / 4294967296);

function checkGeometry(tilesObj) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, maxZ = 0;
  for (const t of tilesObj) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
    if (t.z > maxZ) maxZ = t.z;
  }
  const byZ = new Map();
  const keySet = new Set();
  for (const t of tilesObj) {
    keySet.add(`${t.x},${t.y},${t.z}`);
    if (!byZ.has(t.z)) byZ.set(t.z, []);
    byZ.get(t.z).push(t);
  }
  for (const t of tilesObj) {
    if (!keySet.has(`${maxX + minX - t.x},${t.y},${t.z}`)) return null;
    if (t.z > 0 && keySet.has(`${t.x},${t.y},${t.z - 1}`)) return null;
  }
  for (const u of tilesObj) {
    if (u.z === 0) continue;
    const below = byZ.get(u.z - 1) || [];
    let q0 = false, q1 = false, q2 = false, q3 = false;
    for (const v of below) {
      const ox = u.x - v.x, oy = u.y - v.y;
      if (Math.abs(ox) < 2 && Math.abs(oy) < 2) {
        if (ox <= 0 && oy <= 0) q0 = true;
        if (ox >= 0 && oy <= 0) q1 = true;
        if (ox <= 0 && oy >= 0) q2 = true;
        if (ox >= 0 && oy >= 0) q3 = true;
      }
    }
    if (!q0 || !q1 || !q2 || !q3) return null;
  }
  return {
    w: (maxX - minX) / 2 + 1,
    rows: (maxY - minY) / 2 + 1,
    layers: maxZ + 1,
  };
}

function buildOneWithOp(o) {
  const r = L.rng(o.seed);
  const maxW = o.isBig ? 7 : 6;
  const maxR = o.isBig ? 9 : 8;
  const pool = P.basesOf(o.shape).filter((b) => (o.brick === undefined || b.brick === o.brick) && b.w <= maxW && b.h <= maxR);
  if (!pool.length) return null;
  const want = o.aspect / 1.24;
  const layers = Math.max(1, o.layers);
  const bt = Math.round(o.target * (o.baseFrac || 0.42));
  const scored = pool.map((b) => ({
    b,
    sc: Math.abs(b.n - bt) / 2 + 6 * Math.abs(Math.log((b.h + 0.25) / (b.w + 0.35) / want)),
  }));
  const bestSc = Math.min(...scored.map((x) => x.sc));
  const cands = scored.filter((x) => x.sc <= bestSc + 1.5).map((x) => x.b);
  const b = cands[Math.floor(r() * cands.length)];

  const f = P.SHAPES[b.name];
  const tiles = [];
  for (let row = 0; row < b.H; row++) {
    const odd = b.brick && row % 2 === 1;
    for (let col = 0; col < (odd ? b.W - 1 : b.W); col++) {
      const [u, v] = UV(odd ? col + 0.5 : col, row, b.W, b.H);
      if (f(u, v)) tiles.push({ x: col * 2 + (odd ? 1 : 0), y: row * 2, z: 0 });
    }
  }
  const S = Math.min(...tiles.map((t) => t.x)) + Math.max(...tiles.map((t) => t.x));
  const cx = S / 2;
  const cy = tiles.reduce((a, t) => a + t.y, 0) / tiles.length;
  const spanX = (Math.max(...tiles.map((t) => t.x)) - Math.min(...tiles.map((t) => t.x))) / 2;
  const hy = cy + Math.round((r() - 0.5) * 2);
  const twin = o.twin && spanX >= 4;
  const hd = twin ? Math.max(2, Math.round(spanX * 0.55)) : 0;
  const dist = (p) => {
    const dx = Math.abs(p.x - cx);
    const d = twin ? Math.abs(dx - hd) : dx;
    return Math.hypot(d, (p.y - hy) * 0.9);
  };
  let remaining = o.target - tiles.length;
  let prev = tiles.slice();
  const key = (x, y) => `${x},${y}`;

  for (let z = 1; z <= layers + 1 && remaining > 0; z++) {
    const prevSet = new Set(prev.map((t) => key(t.x, t.y)));
    const has = (x, y) => prevSet.has(key(x, y));
    const OPS = {
      shiftX: () => prev.filter((t) => has(t.x + 2, t.y)).map((t) => ({ x: t.x + 1, y: t.y })),
      shiftY: () => prev.filter((t) => has(t.x, t.y + 2)).map((t) => ({ x: t.x, y: t.y + 1 })),
      shiftXY: () => prev.filter((t) => has(t.x + 2, t.y) && has(t.x, t.y + 2) && has(t.x + 2, t.y + 2)).map((t) => ({ x: t.x + 1, y: t.y + 1 })),
    };
    const opList = o.opSeq[(z - 1) % o.opSeq.length];
    let cand = null;
    for (const op of opList) {
      const c = OPS[op]();
      if (c.length >= 2) { cand = c; break; }
    }
    if (!cand || !cand.length) break;
    const nWant = z >= layers - 1
      ? remaining
      : Math.min(remaining, Math.max(2, Math.round(prev.length * (o.keep[0] + r() * (o.keep[1] - o.keep[0])))));
    const seen = new Set(), groups = [];
    const cset = new Map(cand.map((p) => [key(p.x, p.y), p]));
    for (const p of cand) {
      const k = key(p.x, p.y);
      if (seen.has(k)) continue;
      const mk = key(S - p.x, p.y);
      const g = [p];
      seen.add(k);
      if (mk !== k && cset.has(mk)) {
        g.push(cset.get(mk));
        seen.add(mk);
      } else if (mk !== k) continue;
      groups.push({ g, d: dist(p) + r() * 0.35 });
    }
    groups.sort((a, c) => a.d - c.d);
    const placed = [];
    for (const { g } of groups) {
      if (placed.length >= nWant) break;
      if (placed.length + g.length > nWant && placed.length >= nWant - 1 && nWant > 1) continue;
      if (g.some((p) => placed.some((q) => overlaps(p, q)))) continue;
      g.forEach((p) => placed.push({ x: p.x, y: p.y, z }));
    }
    if (!placed.length) break;
    placed.forEach((t) => tiles.push(t));
    remaining -= placed.length;
    prev = placed;
  }

  const ox = Math.min(...tiles.map((t) => t.x));
  const oy = Math.min(...tiles.map((t) => t.y));
  tiles.forEach((t) => { t.x -= ox; t.y -= oy; });
  return { tiles, twin };
}

function collectFamilyPool(shape, isBig, existingMasks) {
  const seenSig = new Set();
  const rawCands = [];
  const minPx = isBig ? 52 : 58;
  const maxW = isBig ? 7 : 6;
  const maxR = isBig ? 9 : 8;
  const targets = isBig ? [96] : [72, 76, 80, 84, 88];
  const layersList = isBig ? [3, 4, 5, 6] : [2, 3, 4, 5, 6];
  const aspects = [0.9, 1.25, 1.65, 2.0];
  const baseFracs = [0.30, 0.40, 0.50, 0.62];
  const keeps = [[0.55, 0.80], [0.75, 0.94]];

  const register = (tilesObj, seed, opTag, brick, usedTwin) => {
    const n = tilesObj.length;
    if (n % 2) return;
    if (isBig ? n !== 96 : (n < 72 || n > 88)) return;
    const dims = checkGeometry(tilesObj);
    if (!dims || dims.w < 5 || dims.w > maxW || dims.rows > maxR) return;
    const sig = tilesObj.map((u) => `${u.x},${u.y},${u.z}`).sort().join(';');
    if (seenSig.has(sig)) return;
    seenSig.add(sig);

    const m = FP.measure(tilesObj, { minimum: minPx });
    if (!m.ok) return;
    const tilesArr = tilesObj.map((u) => [u.x, u.y, u.z]);
    if (!fitsLayouts(tilesArr, existingMasks, 0.75)) return;

    const vis = H.tileVisibility(tilesObj, {
      alive: new Uint8Array(n).fill(1),
      down: new Uint8Array(n),
      openPeek: -1,
    }, null).tiles.filter((x) => x.picture).length / n;

    rawCands.push({
      shape: usedTwin && shape !== 'twins' ? `${shape} · two islands` : (opTag !== 'xy' ? `${shape} · ${opTag}` : shape),
      base: shape,
      opTag,
      n,
      tiles: tilesArr,
      tilesObj,
      seed,
      layoutKey: layoutKey({ tiles: tilesArr }),
      px: PF.tilePx(tilesObj),
      fpPx: +m.tilePx.toFixed(2),
      limit: m.limit,
      w: dims.w,
      rows: dims.rows,
      layers: dims.layers,
      brick,
      vis: +vis.toFixed(3),
      cOk: -1,
    });
  };

  // 1) Also include classic P.pile candidates so native twins/brick/aspect combos are represented
  if (shape === 'twins' || shape === 'castle' || shape === 'oval' || shape === 'heart') {
    for (const layers of layersList) {
      for (const brick of [false, true]) {
        for (const target of targets) {
          for (const baseFrac of [undefined, 0.34, 0.44, 0.56]) {
            for (const aspect of aspects) {
              for (let s = 1; s <= 3; s++) {
                const res = P.pile({ shape, seed: s, target, layers, aspect, baseFrac, stack: 0, keep: [0.55, 0.8], twin: shape === 'twins' ? 0.6 : 0.35, brick });
                if (res && res.tiles) register(res.tiles, 81000 + s * 101 + layers * 17, 'xy', brick, res.twin);
              }
            }
          }
        }
      }
    }
  }

  // 2) Multi-op shiftXY / shiftX / shiftY candidates on the family's shapeCells grid
  for (const opM of OP_MODES) {
    for (const brick of [false, true]) {
      for (const target of targets) {
        for (const layers of layersList) {
          for (const baseFrac of baseFracs) {
            for (const aspect of aspects) {
              for (const keep of keeps) {
                for (let s = 1; s <= 3; s++) {
                  const seed = 92000 + s * 131 + layers * 19 + (brick ? 7 : 0);
                  const res = buildOneWithOp({
                    shape,
                    seed,
                    target,
                    layers,
                    aspect,
                    baseFrac,
                    keep,
                    twin: shape === 'twins',
                    brick,
                    opSeq: opM.seq,
                    isBig,
                  });
                  if (res && res.tiles) register(res.tiles, seed, opM.tag, brick, res.twin);
                }
              }
            }
          }
        }
      }
    }
  }

  // Pre-prune overly huge pools while keeping full diversity across (opTag, rows, layers, brick)
  rawCands.sort((a, b) => (a.rows - b.rows) || (a.layers - b.layers) || (b.vis - a.vis) || (a.n - b.n));
  const kept = [];
  const bucketCounts = new Map();
  for (const c of rawCands) {
    const bKey = `${c.opTag}:${c.rows}:${c.layers}:${c.brick}:${c.n <= 80}`;
    const cnt = bucketCounts.get(bKey) || 0;
    if (cnt >= 3) continue;
    bucketCounts.set(bKey, cnt + 1);
    kept.push(c);
  }
  for (const c of kept) {
    const ctx = B.context(c.tilesObj);
    let cOk = 0;
    for (const cSig of T.CHAIN_SHAPES) {
      const pr = T.STORIES.chain.place(ctx, { chain: cSig, seed: 1, stage: 'edge', targets: {} }, mkRng(1));
      if (pr && !pr.fail) cOk++;
    }
    c.cOk = cOk;
    delete c.tilesObj;
  }
  return kept;
}

function rot90(t) { return t.map(([x, y, z]) => [-y, x, z]); }
function flipX(t) { return t.map(([x, y, z]) => [-x, y, z]); }
function normT(t) {
  let mx = 1e9, my = 1e9;
  for (const [x, y] of t) { if (x < mx) mx = x; if (y < my) my = y; }
  return t.map(([x, y, z]) => [x - mx, y - my, z]);
}
function d4Masks(t) {
  const out = [];
  let cur = t;
  for (let i = 0; i < 4; i++) {
    out.push(new Set(normT(cur).map((p) => `${p[0]},${p[1]},${p[2]}`)));
    out.push(new Set(normT(flipX(cur)).map((p) => `${p[0]},${p[1]},${p[2]}`)));
    cur = rot90(cur);
  }
  return out;
}

function qualityScore(c, isBig) {
  const cPts = 0.8 * Math.min(c.cOk, 32) + 0.15 * c.cOk;
  const visPts = 22 * c.vis;
  const r7Pts = !isBig ? (c.rows <= 7 ? 10 : 0) : (c.w <= 6 ? 10 : c.rows <= 7 ? 5 : 0);
  const w6Pts = !isBig && c.w === 6 ? 3 : 0;
  const nPts = !isBig && c.n <= 80 ? 4 : 0;
  const layerPts = -2.8 * c.layers;
  const pxPts = 0.4 * (c.fpPx - (isBig ? 52 : 58));
  return cPts + visPts + r7Pts + w6Pts + nPts + layerPts + pxPts;
}

function compatPair(aD4, bD4) {
  const a0 = aD4[0], b0 = bD4[0];
  const mx = Math.max(a0.size, b0.size), mn = Math.min(a0.size, b0.size);
  for (const v of aD4) {
    let sh = 0;
    for (const k of v) if (b0.has(k)) sh++;
    if (a0.size !== b0.size && sh === mn) return false;
    if (sh / mx > 0.75) return false;
  }
  for (const v of bD4) {
    let sh = 0;
    for (const k of v) if (a0.has(k)) sh++;
    if (a0.size !== b0.size && sh === mn) return false;
    if (sh / mx > 0.75) return false;
  }
  return true;
}

function assignNonAdjacentLevels(pickedItems, levels) {
  const rem = pickedItems.slice();
  const out = [];
  let lastBase = null;
  while (rem.length) {
    const counts = new Map();
    for (const x of rem) counts.set(x.base, (counts.get(x.base) || 0) + 1);
    let bestIdx = -1, bestScore = -1e9;
    for (let i = 0; i < rem.length; i++) {
      if (rem[i].base === lastBase) continue;
      const sc = counts.get(rem[i].base) * 10 + (rem[i].rows <= 7 ? 1 : 0);
      if (sc > bestScore) { bestScore = sc; bestIdx = i; }
    }
    if (bestIdx < 0) bestIdx = 0;
    const item = rem.splice(bestIdx, 1)[0];
    item.level = levels[out.length];
    out.push(item);
    lastBase = item.base;
  }
  return out;
}

function main() {
  const existing = JSON.parse(fs.readFileSync(EXISTING_PATH, 'utf8'));
  const existingMasks = existing.map((r) => PF.spots(r.tiles)[0]);

  console.log('Collecting diverse fresh 6-wide pools across ALL 18 families...');
  const normalPool = [];
  const normalByFam = new Map();
  const bigByFam = new Map();

  for (const fam of FAMILIES_18) {
    const np = collectFamilyPool(fam, false, existingMasks);
    // Prioritize chains > 0 first unless none exist
    const usable = np.filter((c) => c.cOk > 0);
    const list = usable.length ? usable : np;
    normalByFam.set(fam, list);
    for (const c of list) normalPool.push(c);

    const bp = ['arch', 'heart', 'house', 'castle', 'hourglass', 'oval', 'steps', 'vase', 'frame', 'diamond', 'twins'].includes(fam)
      ? collectFamilyPool(fam, true, existingMasks)
      : [];
    const usableB = bp.filter((c) => c.cOk >= 15);
    bigByFam.set(fam, usableB.length ? usableB : bp);

    const r7c = list.filter((c) => c.rows <= 7).length;
    const maxC = list.length ? Math.max(...list.map((c) => c.cOk)) : 0;
    console.log(`  ${fam.padEnd(10)} kept=${String(list.length).padStart(3)} (r<=7: ${String(r7c).padStart(3)}, maxC=${String(maxC).padStart(2)}) | big96=${bigByFam.get(fam).length}`);
  }

  // Build conflict graph on normalPool
  const N = normalPool.length;
  const d4s = normalPool.map((c) => d4Masks(c.tiles));
  const scores = normalPool.map((c) => qualityScore(c, false));
  const adj = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (normalPool[i].layoutKey === normalPool[j].layoutKey || !compatPair(d4s[i], d4s[j])) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // Select 42 normal layouts using conflict-degree-aware selection:
  // Step A: guarantee at least 1 strong layout per family (scarcest families first!)
  const inSet = new Uint8Array(N);
  const tight = new Int32Array(N);
  const pickedIdx = [];
  const addIdx = (u) => {
    inSet[u] = 1;
    pickedIdx.push(u);
    for (const v of adj[u]) tight[v]++;
  };

  const famsByCount = FAMILIES_18.slice().sort((a, b) => (normalByFam.get(a).length) - (normalByFam.get(b).length));
  for (const fam of famsByCount) {
    const candsIdx = [];
    for (let i = 0; i < N; i++) {
      if (normalPool[i].base === fam && tight[i] === 0 && !inSet[i]) candsIdx.push(i);
    }
    if (!candsIdx.length) {
      console.log(`  Note: 0 conflict-free candidates left for ${fam}`);
      continue;
    }
    // Balance candidate quality vs low conflict degree so we preserve packing headroom
    candsIdx.sort((a, b) => (scores[b] - 0.15 * adj[b].length) - (scores[a] - 0.15 * adj[a].length));
    addIdx(candsIdx[0]);
  }

  // Step B: fill remaining slots up to 44 (we will keep top 42 with >=24 r<=7), preferring underrepresented families & rows<=7 & lowest conflict degree
  while (pickedIdx.length < 42) {
    const famCount = new Map(FAMILIES_18.map((f) => [f, 0]));
    for (const u of pickedIdx) famCount.set(normalPool[u].base, famCount.get(normalPool[u].base) + 1);
    const curR7 = pickedIdx.filter((u) => normalPool[u].rows <= 7).length;
    const needR7 = curR7 < 24;

    const avail = [];
    for (let i = 0; i < N; i++) if (!inSet[i] && tight[i] === 0) avail.push(i);
    if (!avail.length) break;

    avail.sort((a, b) => {
      const ca = normalPool[a], cb = normalPool[b];
      // count free neighbors inside avail (active conflict degree)
      const fcA = famCount.get(ca.base), fcB = famCount.get(cb.base);
      const r7A = (needR7 && ca.rows <= 7) ? 15 : 0;
      const r7B = (needR7 && cb.rows <= 7) ? 15 : 0;
      const capPenaltyA = fcA >= 4 ? -30 : -4 * fcA;
      const capPenaltyB = fcB >= 4 ? -30 : -4 * fcB;
      // Compute active degree inside avail
      let degA = 0, degB = 0;
      for (const v of adj[a]) if (!inSet[v] && tight[v] === 0) degA++;
      for (const v of adj[b]) if (!inSet[v] && tight[v] === 0) degB++;
      const totA = scores[a] + r7A + capPenaltyA - 0.25 * degA;
      const totB = scores[b] + r7B + capPenaltyB - 0.25 * degB;
      return totB - totA;
    });
    addIdx(avail[0]);
  }

  if (pickedIdx.length < 40) {
    throw new Error(`Only packed ${pickedIdx.length} normal layouts (< 40)`);
  }

  const normalItems = pickedIdx.map((i) => normalPool[i]);
  const normalMasks = normalItems.map((c) => PF.spots(c.tiles)[0]);
  const allMasksSoFar = [...existingMasks, ...normalMasks];
  const seenKeys = new Set([...existing.map((r) => layoutKey({ tiles: r.tiles })), ...normalItems.map((c) => c.layoutKey)]);

  // Step C: pick 6 distinct-family big 96-tile layouts passing fitsLayouts against EVERYTHING so far
  const bigLevels = [310, 320, 330, 340, 350, 360];
  const bigFamOrder = ['vase', 'steps', 'heart', 'arch', 'castle', 'hourglass', 'house', 'oval', 'frame', 'diamond'];
  const pickedBig = [];
  for (const fam of bigFamOrder) {
    if (pickedBig.length >= 6) break;
    const list = (bigByFam.get(fam) || []).slice().sort((a, b) => qualityScore(b, true) - qualityScore(a, true));
    for (const c of list) {
      if (seenKeys.has(c.layoutKey)) continue;
      if (!fitsLayouts(c.tiles, allMasksSoFar, 0.75)) continue;
      seenKeys.add(c.layoutKey);
      allMasksSoFar.push(PF.spots(c.tiles)[0]);
      pickedBig.push({ ...c, level: bigLevels[pickedBig.length] });
      break;
    }
  }
  if (pickedBig.length < 6) {
    throw new Error(`Only found ${pickedBig.length}/6 big 96-tile layouts`);
  }

  // Assign non-tens levels 301..346 cleanly
  const normalLevels = [];
  for (let lv = 301; normalLevels.length < normalItems.length; lv++) {
    if (lv % 10 !== 0) normalLevels.push(lv);
  }
  const orderedNormal = assignNonAdjacentLevels(normalItems, normalLevels);
  const allItems = [...orderedNormal, ...pickedBig].sort((a, b) => a.level - b.level);

  const records = allItems.map((c) => ({
    level: c.level,
    shape: c.shape,
    base: c.base,
    n: c.n,
    tiles: c.tiles,
    seed: c.seed,
    layoutKey: c.layoutKey,
    originalityVersion: 'layout-d4-v1',
    generated: 'fresh-catalogue-pile',
    px: c.px,
  }));

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(records, null, 2) + '\n');

  // Strict end-to-end verification
  const vMasks = existingMasks.slice();
  const vKeys = new Set(existing.map((r) => layoutKey({ tiles: r.tiles })));
  for (const r of records) {
    if (vKeys.has(r.layoutKey)) throw new Error(`Duplicate key at ${r.level}`);
    if (!fitsLayouts(r.tiles, vMasks, 0.75)) throw new Error(`Overlap >0.75 at ${r.level}`);
    vKeys.add(r.layoutKey);
    vMasks.push(PF.spots(r.tiles)[0]);
  }

  const r7 = orderedNormal.filter((x) => x.rows <= 7).length;
  const famSet = new Set(orderedNormal.map((x) => x.base));
  console.log(`\nSaved ${records.length} verified layouts to ${OUT_PATH}`);
  console.log(`Normal: ${orderedNormal.length} (>=40), rows<=7: ${r7}/${orderedNormal.length}, families: ${famSet.size}/18, Big 96t: ${pickedBig.length}`);
  console.log(`Normal fpPx: [${Math.min(...orderedNormal.map((x) => x.fpPx))}, ${Math.max(...orderedNormal.map((x) => x.fpPx))}]`);
  console.log(`Big96  fpPx: [${Math.min(...pickedBig.map((x) => x.fpPx))}, ${Math.max(...pickedBig.map((x) => x.fpPx))}]`);
  console.log(`Normal chainPlace: min=${Math.min(...orderedNormal.map((x) => x.cOk))}, median=${orderedNormal.map((x) => x.cOk).sort((a, b) => a - b)[Math.floor(orderedNormal.length / 2)]}, max=${Math.max(...orderedNormal.map((x) => x.cOk))}`);
  console.log(`Big96  chainPlace: min=${Math.min(...pickedBig.map((x) => x.cOk))}, max=${Math.max(...pickedBig.map((x) => x.cOk))}`);
  const byFamOut = {};
  for (const x of orderedNormal) byFamOut[x.base] = (byFamOut[x.base] || 0) + 1;
  console.log('Family distribution (normal):', JSON.stringify(byFamOut));
}

main();
