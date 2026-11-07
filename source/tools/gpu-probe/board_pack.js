'use strict';

/**
 * Packs a board design into flat 128-bit (4 x uint32) bitmasks matching
 * source/tools/builder/engine.js and source/www/layouts.js rules.
 */

const MAX_TILES = 128;
const WORDS = 4; // 4 * 32 = 128 bits

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
      xs[i] = t[0]; ys[i] = t[1]; zs[i] = t[2];
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

module.exports = { MAX_TILES, WORDS, packBoard };
