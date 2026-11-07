'use strict';

/**
 * Packs a board design into flat 128-bit (4 x uint32) bitmasks matching
 * source/tools/builder/engine.js and source/www/layouts.js rules.
 *
 * Also provides `packScreenBatch(designs, routeOpts)` for Task G2 Part B:
 * packs an array of designs into a contiguous 8,944-byte-per-board binary buffer
 * including the precomputed `engine.js` `clockShortest` route bitmask, step order,
 * initial exposed/role visibility, objective cones, and structural openScore.
 */

const E = require('../builder/engine.js');
const { tileVisibility } = require('../sim/refit/human_board_visibility.js');

const MAX_TILES = 128;
const WORDS = 4; // 4 * 32 = 128 bits
const MAX_ROUTE_KEYS = 4;
const SCREEN_BOARD_BYTES = 8944;

function packBoard(design) {
  const rawTiles = design.tiles;
  const n = rawTiles.length;
  if (n === 0 || n > MAX_TILES) {
    throw new Error(`packBoard: tile count ${n} out of range 1..${MAX_TILES}`);
  }
  const xs = new Int32Array(n);
  const ys = new Int32Array(n);
  const zs = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const t = rawTiles[i];
    if (Array.isArray(t)) {
      xs[i] = t[0]; ys[i] = t[1]; zs[i] = t.z ?? t[2];
    } else {
      xs[i] = t.x; ys[i] = t.y; zs[i] = t.z;
    }
  }

  const aboveMask = new Uint32Array(MAX_TILES * WORDS);
  const leftMask = new Uint32Array(MAX_TILES * WORDS);
  const rightMask = new Uint32Array(MAX_TILES * WORDS);
  const iceMask = new Uint32Array(MAX_TILES * WORDS);
  const iceH = new Uint8Array(MAX_TILES);
  const faces = new Uint8Array(MAX_TILES);

  for (let i = 0; i < n; i++) {
    faces[i] = design.faces[i];
    const ax = xs[i], ay = ys[i], az = zs[i];
    const base = i * WORDS;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const bx = xs[j], by = ys[j], bz = zs[j];
      const dx = Math.abs(ax - bx);
      const dy = Math.abs(ay - by);
      const dz = Math.abs(az - bz);
      const w = j >> 5;
      const bit = (1 << (j & 31)) >>> 0;

      // Geometric neighbors (Layouts.neighbors)
      if (dy < 2) {
        if (bz > az && dx < 2) {
          aboveMask[base + w] = (aboveMask[base + w] | bit) >>> 0;
        } else if (bz === az) {
          if (bx === ax - 2) leftMask[base + w] = (leftMask[base + w] | bit) >>> 0;
          else if (bx === ax + 2) rightMask[base + w] = (rightMask[base + w] | bit) >>> 0;
        }
      }

      // Ice neighbors (Layouts.iceNeighbors)
      if ((dz === 0 && dx <= 2 && dy <= 2 && (dx < 2 || dy < 2)) ||
          (dz === 1 && dx < 2 && dy < 2)) {
        iceMask[base + w] = (iceMask[base + w] | bit) >>> 0;
      }
    }
  }

  const ob = design.obst || {};
  const iceObj = ob.ice || {};
  for (const k of Object.keys(iceObj)) {
    const idx = +k;
    if (idx >= 0 && idx < n && iceObj[k] > 0) {
      iceH[idx] = iceObj[k];
    }
  }

  const downMask = new Uint32Array(WORDS);
  for (const i of design.down || []) {
    if (i >= 0 && i < n) {
      downMask[i >> 5] = (downMask[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
    }
  }

  const keys = ob.keys || [];
  const locks = ob.locks || [];
  const hasLocks = keys.length > 0 && locks.length > 0 ? 1 : 0;
  const lockMask = new Uint32Array(WORDS);
  const keyMask = new Uint32Array(WORDS);
  if (hasLocks) {
    for (const i of locks) {
      if (i >= 0 && i < n) lockMask[i >> 5] = (lockMask[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
    }
    for (const k of keys) {
      if (k >= 0 && k < n) keyMask[k >> 5] = (keyMask[k >> 5] | ((1 << (k & 31)) >>> 0)) >>> 0;
    }
  }

  const initAlive = new Uint32Array(WORDS);
  for (let i = 0; i < n; i++) {
    initAlive[i >> 5] = (initAlive[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
  }

  const hasClock = design.clock && Number.isInteger(design.clock.i) && design.clock.i >= 0 && design.clock.i < n;
  const clockI = hasClock ? design.clock.i : -1;
  const clockN = hasClock ? design.clock.n : 0;

  return {
    n,
    clockI,
    clockN,
    hasLocks,
    aboveMask,
    leftMask,
    rightMask,
    iceMask,
    iceH,
    faces,
    downMask,
    lockMask,
    keyMask,
    initAlive,
  };
}

function buildRouteCone(g, targetIdx, routeSet, firstStep) {
  const cone = new Uint8Array(g.n);
  if (targetIdx < 0 || targetIdx >= g.n) return cone;
  cone[targetIdx] = 1;
  let changed = true;
  while (changed) {
    changed = false;
    for (let u = 0; u < g.n; u++) {
      if (!cone[u]) continue;
      const stepU = firstStep[u] || 999;
      const addIfEarlierRoute = v => {
        if (!cone[v] && routeSet.has(v) && (firstStep[v] || 0) < stepU) {
          cone[v] = 1;
          changed = true;
        }
      };
      for (const v of g.nb.above[u]) addIfEarlierRoute(v);
      for (const v of g.nb.left[u]) addIfEarlierRoute(v);
      for (const v of g.nb.right[u]) addIfEarlierRoute(v);
      if (g.iceH[u] > 0) {
        for (const v of g.iceNb[u]) addIfEarlierRoute(v);
      }
      if (u !== targetIdx) {
        const fu = g.faces[u];
        for (const v of routeSet) {
          if (!cone[v] && g.faces[v] === fu) {
            cone[v] = 1;
            changed = true;
          }
        }
      }
    }
  }
  return cone;
}

/**
 * Computes the pre-clock tile sequence on CPU via `engine.js` `clockShortest`,
 * falling back to `design.solution` prefix only if the search budget expires.
 */
function computeClockRoute(design, routeOpts = {}) {
  const g = E.game(design);
  const vis0 = tileVisibility(
    g.tiles,
    { alive: new Uint8Array(g.n).fill(1), down: g.down, openPeek: -1, moves: 0 },
    g.clock
  ).tiles;

  const openScore = new Uint8Array(MAX_TILES);
  for (let i = 0; i < g.n; i++) {
    const z = Math.max(0, g.tiles[i].z | 0);
    const belowCount = g.below[i].length;
    const sideCount = g.nb.left[i].length + g.nb.right[i].length;
    const iceDepCount = g.iceRev[i].length;
    openScore[i] = Math.min(255, z * 4 + belowCount * 3 + sideCount * 2 + iceDepCount * 5);
  }

  if (!g.clock) {
    return {
      g,
      vis0,
      openScore,
      routeTiles: [],
      clockShortestK: 0,
      toClock: g.toClock,
      routeKeys: [],
      clockCone: new Uint8Array(g.n),
      keyCones: [],
    };
  }

  const nodes = routeOpts.nodes ?? 15000;
  const ms = routeOpts.ms ?? 30;
  let routeTiles = null;
  let clockShortestK = g.clock.n;

  const cs = E.clockShortest(g, { nodes, ms });
  if (cs && Array.isArray(cs.path)) {
    const flat = E.flatten(cs.path);
    const ci = flat.indexOf(g.clock.i);
    routeTiles = ci >= 0 ? flat.slice(0, ci + 1) : [];
    clockShortestK = cs.k;
  } else if (Array.isArray(design.solution)) {
    const ci = design.solution.indexOf(g.clock.i);
    if (ci >= 0) {
      routeTiles = design.solution.slice(0, ci + 1);
      clockShortestK = ci + 1;
    }
  }
  if (!routeTiles) {
    routeTiles = [g.clock.i];
  }

  const routeSet = new Set(routeTiles);
  const firstStep = new Uint16Array(g.n);
  for (let s = 0; s < routeTiles.length; s++) {
    const t = routeTiles[s];
    if (t >= 0 && t < g.n && firstStep[t] === 0) firstStep[t] = s + 1;
  }

  const locksOnRoute = g.keys.length > 0 && routeTiles.some(t => g.lockT[t]);
  const routeKeys = locksOnRoute ? g.keys.slice(0, MAX_ROUTE_KEYS) : [];
  const clockCone = buildRouteCone(g, g.clock.i, routeSet, firstStep);
  const keyCones = routeKeys.map(k => buildRouteCone(g, k, routeSet, firstStep));

  if (routeKeys.length === 0) {
    for (const t of routeSet) clockCone[t] = 1;
  } else {
    for (const t of routeSet) {
      if (clockCone[t]) continue;
      let anyKey = false;
      for (let m = 0; m < keyCones.length; m++) {
        if (keyCones[m][t]) { anyKey = true; break; }
      }
      if (!anyKey) {
        for (let m = 0; m < keyCones.length; m++) keyCones[m][t] = 1;
      }
    }
  }

  return {
    g,
    vis0,
    openScore,
    routeTiles,
    clockShortestK,
    toClock: g.toClock,
    routeKeys,
    clockCone,
    keyCones,
  };
}

function arrayToMask4(arr, n) {
  const m = new Uint32Array(WORDS);
  for (let i = 0; i < n; i++) {
    if (arr[i]) m[i >> 5] = (m[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
  }
  return m;
}

/**
 * Packs a single design (plus its CPU-precomputed `clockShortest` route,
 * initial visibility, and structural openScore) into `targetBuffer` at
 * `byteOffset` (8,944 bytes/board).
 */
function packScreenBoardInto(design, targetBuffer, byteOffset = 0, routeOpts = {}) {
  const base = packBoard(design);
  const routeInfo = computeClockRoute(design, routeOpts);
  const { vis0, openScore, routeTiles, clockShortestK, toClock, routeKeys, clockCone, keyCones } = routeInfo;

  let keyIdxPacked = 0xffffffff;
  for (let m = 0; m < MAX_ROUTE_KEYS; m++) {
    const kv = m < routeKeys.length ? (routeKeys[m] & 0xff) : 0xff;
    const shift = m * 8;
    keyIdxPacked = ((keyIdxPacked & ~(0xff << shift)) | (kv << shift)) >>> 0;
  }

  const i32 = new Int32Array(targetBuffer, byteOffset, 8);
  i32[0] = base.n;
  i32[1] = base.clockI;
  i32[2] = base.clockN;
  i32[3] = base.hasLocks;
  i32[4] = routeTiles.length;
  i32[5] = clockShortestK;
  i32[6] = routeKeys.length;
  i32[7] = keyIdxPacked | 0;

  const u32 = new Uint32Array(targetBuffer, byteOffset + 32, 4 * MAX_TILES * WORDS + 13 * WORDS);
  let off = 0;
  u32.set(base.aboveMask, off); off += MAX_TILES * WORDS;
  u32.set(base.leftMask, off);  off += MAX_TILES * WORDS;
  u32.set(base.rightMask, off); off += MAX_TILES * WORDS;
  u32.set(base.iceMask, off);   off += MAX_TILES * WORDS;
  u32.set(base.downMask, off);  off += WORDS;
  u32.set(base.lockMask, off);  off += WORDS;
  u32.set(base.keyMask, off);   off += WORDS;
  u32.set(base.initAlive, off); off += WORDS;

  const routeMask = new Uint32Array(WORDS);
  const routeOrder = new Uint8Array(MAX_TILES);
  for (let step = 0; step < routeTiles.length; step++) {
    const t = routeTiles[step];
    if (t >= 0 && t < base.n) {
      routeMask[t >> 5] = (routeMask[t >> 5] | ((1 << (t & 31)) >>> 0)) >>> 0;
      if (routeOrder[t] === 0) routeOrder[t] = Math.min(255, step + 1);
    }
  }

  const toClockMask = new Uint32Array(WORDS);
  if (base.clockI >= 0) {
    toClockMask[base.clockI >> 5] = (toClockMask[base.clockI >> 5] | ((1 << (base.clockI & 31)) >>> 0)) >>> 0;
    for (let i = 0; i < base.n; i++) {
      if (toClock[i]) {
        toClockMask[i >> 5] = (toClockMask[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
      }
    }
  }

  const initRoleVisMask = new Uint32Array(WORDS);
  const initExposedMask = new Uint32Array(WORDS);
  for (let i = 0; i < base.n; i++) {
    if (vis0[i]?.role) {
      initRoleVisMask[i >> 5] = (initRoleVisMask[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
    }
    if (vis0[i]?.orientation) {
      initExposedMask[i >> 5] = (initExposedMask[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
    }
  }

  const clockConeMask = arrayToMask4(clockCone, base.n);

  u32.set(routeMask, off);       off += WORDS;
  u32.set(toClockMask, off);     off += WORDS;
  u32.set(initRoleVisMask, off); off += WORDS;
  u32.set(initExposedMask, off); off += WORDS;
  u32.set(clockConeMask, off);   off += WORDS;

  for (let m = 0; m < MAX_ROUTE_KEYS; m++) {
    const km = m < keyCones.length ? arrayToMask4(keyCones[m], base.n) : new Uint32Array(WORDS);
    u32.set(km, off);
    off += WORDS;
  }

  const u8 = new Uint8Array(targetBuffer, byteOffset + 8432, 4 * MAX_TILES);
  u8.set(base.iceH, 0);
  u8.set(base.faces, MAX_TILES);
  u8.set(routeOrder, 2 * MAX_TILES);
  u8.set(openScore, 3 * MAX_TILES);
}

function packScreenBatch(designs, routeOpts = {}) {
  const buf = new ArrayBuffer(designs.length * SCREEN_BOARD_BYTES);
  for (let i = 0; i < designs.length; i++) {
    const d = designs[i]?.design || designs[i];
    packScreenBoardInto(d, buf, i * SCREEN_BOARD_BYTES, routeOpts);
  }
  return new Uint8Array(buf);
}

module.exports = {
  MAX_TILES,
  WORDS,
  MAX_ROUTE_KEYS,
  SCREEN_BOARD_BYTES,
  packBoard,
  computeClockRoute,
  packScreenBoardInto,
  packScreenBatch,
};
