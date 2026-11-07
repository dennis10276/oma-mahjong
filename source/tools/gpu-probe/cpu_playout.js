'use strict';

/**
 * Simple playout bot on the CPU in Node.js (single-threaded + worker_threads across cores).
 * Implements exact game physics matching source/tools/builder/engine.js:
 *   - free tiles (nothing above, left OR right free)
 *   - tray of 3 waiting tiles (a 4th unmatched tile loses immediately)
 *   - ice (h ice-neighbours removed since start)
 *   - locks (open once both key tiles are removed)
 *   - clock (clock tile must be taken at move index < clock.n; peek pair checks after whole action)
 *   - face-down tiles (turned over for free when takeable)
 *   - peek pair (a takeable face-down tile + takeable twin go together in 1 action of 2 moves without a tray slot)
 *
 * Simple bot decision priority:
 *   1. Take a tray match if there is one (uniformly at random among tray matches)
 *   2. Else take a free pair, including peek pairs (uniformly at random among valid pairs)
 *   3. Else take a random free tile
 */

const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { packBoard, WORDS } = require('./board_pack.js');

function popc32(x) {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}

function nthBit32(w, k) {
  while (k > 0) {
    w &= w - 1;
    k--;
  }
  return 31 - Math.clz32(w & -w);
}

function nthBit128(m0, m1, m2, m3, k) {
  const c0 = popc32(m0);
  if (k < c0) return nthBit32(m0, k);
  k -= c0;
  const c1 = popc32(m1);
  if (k < c1) return 32 + nthBit32(m1, k);
  k -= c1;
  const c2 = popc32(m2);
  if (k < c2) return 64 + nthBit32(m2, k);
  k -= c2;
  return 96 + nthBit32(m3, k);
}

function initRngState(baseSeed, gid) {
  return (((baseSeed >>> 0) + Math.imul(gid >>> 0, 0x9E3779B9)) ^ 0x85EBCA6B) >>> 0;
}

// Returns [nextRandomU32, updatedState] where needed, or inline in hot loop
function stepRng(state) {
  state = (state + 0x6D2B79F5) >>> 0;
  const z = state;
  const t1 = Math.imul(z ^ (z >>> 15), 1 | z) >>> 0;
  const t2 = (t1 + Math.imul(t1 ^ (t1 >>> 7), 61 | t1)) >>> 0;
  const t3 = (t2 ^ t1) >>> 0;
  const out = (t3 ^ (t3 >>> 14)) >>> 0;
  return [out, state];
}

function isBitSet4(m0, m1, m2, m3, i) {
  const bit = (1 << (i & 31)) >>> 0;
  const w = i >> 5;
  if (w === 0) return (m0 & bit) !== 0;
  if (w === 1) return (m1 & bit) !== 0;
  if (w === 2) return (m2 & bit) !== 0;
  return (m3 & bit) !== 0;
}

function orientPair(packed, i, j) {
  const di = isBitSet4(packed.downMask[0], packed.downMask[1], packed.downMask[2], packed.downMask[3], i);
  const dj = isBitSet4(packed.downMask[0], packed.downMask[1], packed.downMask[2], packed.downMask[3], j);
  if (!dj || (di && packed.clockI >= 0 && j === packed.clockI)) {
    return [j, i];
  }
  return [i, j];
}

/**
 * Computes the 128-bit takeable mask for a given alive mask.
 */
function computeTakeable(b, a0, a1, a2, a3, out) {
  const n = b.n;
  const above = b.aboveMask, left = b.leftMask, right = b.rightMask, ice = b.iceMask, iceH = b.iceH;
  const lock0 = b.lockMask[0], lock1 = b.lockMask[1], lock2 = b.lockMask[2], lock3 = b.lockMask[3];
  const keysRemaining = b.hasLocks !== 0 &&
    (((a0 & b.keyMask[0]) | (a1 & b.keyMask[1]) | (a2 & b.keyMask[2]) | (a3 & b.keyMask[3])) !== 0);

  let tk0 = 0, tk1 = 0, tk2 = 0, tk3 = 0;
  const na0 = ~a0 >>> 0, na1 = ~a1 >>> 0, na2 = ~a2 >>> 0, na3 = ~a3 >>> 0;

  for (let i = 0; i < n; i++) {
    const w = i >> 5;
    const bit = (1 << (i & 31)) >>> 0;
    const aliveBit = w === 0 ? (a0 & bit) : w === 1 ? (a1 & bit) : w === 2 ? (a2 & bit) : (a3 & bit);
    if (aliveBit === 0) continue;

    if (keysRemaining) {
      const lockedBit = w === 0 ? (lock0 & bit) : w === 1 ? (lock1 & bit) : w === 2 ? (lock2 & bit) : (lock3 & bit);
      if (lockedBit !== 0) continue;
    }

    const base = i * 4;
    if (((a0 & above[base]) | (a1 & above[base + 1]) | (a2 & above[base + 2]) | (a3 & above[base + 3])) !== 0) {
      continue;
    }
    const blockedL = ((a0 & left[base]) | (a1 & left[base + 1]) | (a2 & left[base + 2]) | (a3 & left[base + 3])) !== 0;
    if (blockedL) {
      const blockedR = ((a0 & right[base]) | (a1 & right[base + 1]) | (a2 & right[base + 2]) | (a3 & right[base + 3])) !== 0;
      if (blockedR) continue;
    }

    const h = iceH[i];
    if (h > 0) {
      const gone = popc32(na0 & ice[base]) + popc32(na1 & ice[base + 1]) +
                   popc32(na2 & ice[base + 2]) + popc32(na3 & ice[base + 3]);
      if (gone < h) continue;
    }

    if (w === 0) tk0 = (tk0 | bit) >>> 0;
    else if (w === 1) tk1 = (tk1 | bit) >>> 0;
    else if (w === 2) tk2 = (tk2 | bit) >>> 0;
    else tk3 = (tk3 | bit) >>> 0;
  }

  out[0] = tk0; out[1] = tk1; out[2] = tk2; out[3] = tk3;
}

/**
 * Executes a single step on a mutable state object matching E.step(g, state, act).
 * Returns true if the move survived, false if it lost immediately (clock expired or 4th tray tile).
 * Throws if the action is illegal (just like E.step).
 */
function stepFixedAction(b, state, act) {
  const tk = new Uint32Array(4);
  computeTakeable(b, state.a0, state.a1, state.a2, state.a3, tk);

  const isPair = act !== null && typeof act === 'object';
  const i0 = isPair ? act.pair[0] : act;
  const i1 = isPair ? act.pair[1] : -1;

  if (!Number.isInteger(i0) || i0 < 0 || i0 >= b.n || !isBitSet4(tk[0], tk[1], tk[2], tk[3], i0)) {
    throw new Error('cpu stepFixedAction: illegal move ' + JSON.stringify(act));
  }
  if (isPair) {
    if (!Number.isInteger(i1) || i1 < 0 || i1 >= b.n || i0 === i1 || !isBitSet4(tk[0], tk[1], tk[2], tk[3], i1)) {
      throw new Error('cpu stepFixedAction: illegal pair ' + JSON.stringify(act));
    }
    const f0 = b.faces[i0], f1 = b.faces[i1];
    const d0 = isBitSet4(b.downMask[0], b.downMask[1], b.downMask[2], b.downMask[3], i0);
    const d1 = isBitSet4(b.downMask[0], b.downMask[1], b.downMask[2], b.downMask[3], i1);
    const inTray = f0 < 32 ? ((state.trayLo & (1 << f0)) !== 0) : ((state.trayHi & (1 << (f0 - 32))) !== 0);
    if (f0 !== f1 || (!d0 && !d1) || inTray) {
      throw new Error('cpu stepFixedAction: not a peek pair ' + JSON.stringify(act));
    }
  }

  if (state.clockAlive && state.moves >= b.clockN) {
    return false; // Clock expired before action
  }

  // Remove i0 (and i1 if pair)
  const clearTile = idx => {
    const mask = ~(1 << (idx & 31)) >>> 0;
    const w = idx >> 5;
    if (w === 0) state.a0 = (state.a0 & mask) >>> 0;
    else if (w === 1) state.a1 = (state.a1 & mask) >>> 0;
    else if (w === 2) state.a2 = (state.a2 & mask) >>> 0;
    else state.a3 = (state.a3 & mask) >>> 0;
    state.left--;
    state.moves++;
    if (idx === b.clockI) state.clockAlive = 0;
  };

  if (isPair) {
    clearTile(i0);
    clearTile(i1);
    return true;
  }

  clearTile(i0);
  const f = b.faces[i0];
  if (f < 32) {
    const fbit = (1 << f) >>> 0;
    if ((state.trayLo & fbit) !== 0) {
      state.trayLo = (state.trayLo ^ fbit) >>> 0;
      state.trayLen--;
    } else {
      if (state.trayLen >= 3) return false; // 4th waiting tile loses
      state.trayLo = (state.trayLo | fbit) >>> 0;
      state.trayLen++;
    }
  } else {
    const fbit = (1 << (f - 32)) >>> 0;
    if ((state.trayHi & fbit) !== 0) {
      state.trayHi = (state.trayHi ^ fbit) >>> 0;
      state.trayLen--;
    } else {
      if (state.trayLen >= 3) return false;
      state.trayHi = (state.trayHi | fbit) >>> 0;
      state.trayLen++;
    }
  }
  return true;
}

/**
 * Plays one game using the canonical simple bot, optionally recording the action trace
 * for E.step verification.
 */
function playOneGame(b, baseSeed, gid, recordTrace = false) {
  let a0 = b.initAlive[0], a1 = b.initAlive[1], a2 = b.initAlive[2], a3 = b.initAlive[3];
  let left = b.n;
  let moves = 0;
  let trayLo = 0, trayHi = 0, trayLen = 0;
  let clockAlive = b.clockI >= 0 ? 1 : 0;
  let rng = initRngState(baseSeed, gid);

  const n = b.n;
  const above = b.aboveMask, leftM = b.leftMask, rightM = b.rightMask, iceM = b.iceMask, iceH = b.iceH;
  const faces = b.faces;
  const d0 = b.downMask[0], d1 = b.downMask[1], d2 = b.downMask[2], d3 = b.downMask[3];
  const lock0 = b.lockMask[0], lock1 = b.lockMask[1], lock2 = b.lockMask[2], lock3 = b.lockMask[3];
  const key0 = b.keyMask[0], key1 = b.keyMask[1], key2 = b.keyMask[2], key3 = b.keyMask[3];
  const hasLocks = b.hasLocks;
  const clockI = b.clockI, clockN = b.clockN;

  const trace = recordTrace ? [] : null;
  const tkList = new Uint8Array(128);
  const candList = new Uint8Array(128);

  for (;;) {
    if (left === 0) {
      return { win: trayLen === 0 ? 1 : 0, moves, trace };
    }
    if (clockAlive !== 0 && moves >= clockN) {
      // In trace mode, record the attempted next move if one exists so E.step returns null on it
      if (recordTrace) {
        const tkTmp = new Uint32Array(4);
        computeTakeable(b, a0, a1, a2, a3, tkTmp);
        const tc = popc32(tkTmp[0]) + popc32(tkTmp[1]) + popc32(tkTmp[2]) + popc32(tkTmp[3]);
        if (tc > 0) {
          trace.push(nthBit128(tkTmp[0], tkTmp[1], tkTmp[2], tkTmp[3], 0));
        }
      }
      return { win: 0, moves, trace };
    }

    const keysRemaining = hasLocks !== 0 && (((a0 & key0) | (a1 & key1) | (a2 & key2) | (a3 & key3)) !== 0);
    const na0 = ~a0 >>> 0, na1 = ~a1 >>> 0, na2 = ~a2 >>> 0, na3 = ~a3 >>> 0;

    let tk0 = 0, tk1 = 0, tk2 = 0, tk3 = 0;
    let m0 = 0, m1 = 0, m2 = 0, m3 = 0;
    let tkCount = 0, matchCount = 0;
    let faceOnceLo = 0, faceOnceHi = 0;
    let faceMultiLo = 0, faceMultiHi = 0;

    for (let i = 0; i < n; i++) {
      const w = i >> 5;
      const bit = (1 << (i & 31)) >>> 0;
      const aliveBit = w === 0 ? (a0 & bit) : w === 1 ? (a1 & bit) : w === 2 ? (a2 & bit) : (a3 & bit);
      if (aliveBit === 0) continue;

      if (keysRemaining) {
        const lockedBit = w === 0 ? (lock0 & bit) : w === 1 ? (lock1 & bit) : w === 2 ? (lock2 & bit) : (lock3 & bit);
        if (lockedBit !== 0) continue;
      }

      const base = i * 4;
      if (((a0 & above[base]) | (a1 & above[base + 1]) | (a2 & above[base + 2]) | (a3 & above[base + 3])) !== 0) continue;
      if (((a0 & leftM[base]) | (a1 & leftM[base + 1]) | (a2 & leftM[base + 2]) | (a3 & leftM[base + 3])) !== 0 &&
          ((a0 & rightM[base]) | (a1 & rightM[base + 1]) | (a2 & rightM[base + 2]) | (a3 & rightM[base + 3])) !== 0) continue;

      const h = iceH[i];
      if (h > 0) {
        const gone = popc32(na0 & iceM[base]) + popc32(na1 & iceM[base + 1]) +
                     popc32(na2 & iceM[base + 2]) + popc32(na3 & iceM[base + 3]);
        if (gone < h) continue;
      }

      if (w === 0) tk0 = (tk0 | bit) >>> 0;
      else if (w === 1) tk1 = (tk1 | bit) >>> 0;
      else if (w === 2) tk2 = (tk2 | bit) >>> 0;
      else tk3 = (tk3 | bit) >>> 0;
      tkList[tkCount++] = i;

      const f = faces[i];
      if (f < 32) {
        const fbit = (1 << f) >>> 0;
        if ((trayLo & fbit) !== 0) {
          if (w === 0) m0 = (m0 | bit) >>> 0;
          else if (w === 1) m1 = (m1 | bit) >>> 0;
          else if (w === 2) m2 = (m2 | bit) >>> 0;
          else m3 = (m3 | bit) >>> 0;
          matchCount++;
        } else {
          faceMultiLo = (faceMultiLo | (faceOnceLo & fbit)) >>> 0;
          faceOnceLo = (faceOnceLo | fbit) >>> 0;
        }
      } else {
        const fbit = (1 << (f - 32)) >>> 0;
        if ((trayHi & fbit) !== 0) {
          if (w === 0) m0 = (m0 | bit) >>> 0;
          else if (w === 1) m1 = (m1 | bit) >>> 0;
          else if (w === 2) m2 = (m2 | bit) >>> 0;
          else m3 = (m3 | bit) >>> 0;
          matchCount++;
        } else {
          faceMultiHi = (faceMultiHi | (faceOnceHi & fbit)) >>> 0;
          faceOnceHi = (faceOnceHi | fbit) >>> 0;
        }
      }
    }

    if (tkCount === 0) {
      return { win: 0, moves, trace };
    }

    // Priority 1: Tray match
    if (matchCount > 0) {
      let k = 0;
      if (matchCount > 1) {
        let r; [r, rng] = stepRng(rng);
        k = r % matchCount;
      }
      const chosen = nthBit128(m0, m1, m2, m3, k);
      if (recordTrace) trace.push(chosen);

      const cmask = ~(1 << (chosen & 31)) >>> 0;
      const cw = chosen >> 5;
      if (cw === 0) a0 = (a0 & cmask) >>> 0;
      else if (cw === 1) a1 = (a1 & cmask) >>> 0;
      else if (cw === 2) a2 = (a2 & cmask) >>> 0;
      else a3 = (a3 & cmask) >>> 0;

      const cf = faces[chosen];
      if (cf < 32) trayLo = (trayLo ^ ((1 << cf) >>> 0)) >>> 0;
      else trayHi = (trayHi ^ ((1 << (cf - 32)) >>> 0)) >>> 0;
      trayLen--;
      left--;
      moves++;
      if (chosen === clockI) clockAlive = 0;
      continue;
    }

    // Priority 2: Free pair (peek pair always valid; face-up pair valid if trayLen < 3)
    if ((faceMultiLo | faceMultiHi) !== 0) {
      let candCount = 0;
      for (let idx = 0; idx < tkCount; idx++) {
        const ti = tkList[idx];
        const f = faces[ti];
        const isMulti = f < 32 ? ((faceMultiLo & (1 << f)) !== 0) : ((faceMultiHi & (1 << (f - 32))) !== 0);
        if (isMulti) candList[candCount++] = ti;
      }

      let pairCount = 0;
      for (let u = 0; u < candCount; u++) {
        const i = candList[u];
        const fi = faces[i];
        const di = isBitSet4(d0, d1, d2, d3, i);
        for (let v = u + 1; v < candCount; v++) {
          const j = candList[v];
          if (faces[j] !== fi) continue;
          const dj = isBitSet4(d0, d1, d2, d3, j);
          if (di || dj || trayLen < 3) {
            pairCount++;
          }
        }
      }

      if (pairCount > 0) {
        let target = 0;
        if (pairCount > 1) {
          let r; [r, rng] = stepRng(rng);
          target = r % pairCount;
        }
        let cur = 0, pi = -1, pj = -1;
        for (let u = 0; u < candCount && pi < 0; u++) {
          const i = candList[u];
          const fi = faces[i];
          const di = isBitSet4(d0, d1, d2, d3, i);
          for (let v = u + 1; v < candCount; v++) {
            const j = candList[v];
            if (faces[j] !== fi) continue;
            const dj = isBitSet4(d0, d1, d2, d3, j);
            if (di || dj || trayLen < 3) {
              if (cur === target) { pi = i; pj = j; break; }
              cur++;
            }
          }
        }

        const di = isBitSet4(d0, d1, d2, d3, pi);
        const dj = isBitSet4(d0, d1, d2, d3, pj);
        if (di || dj) {
          // Peek pair: remove both without tray slot
          if (recordTrace) {
            trace.push({ pair: orientPair(b, pi, pj) });
          }
          const mA = ~(1 << (pi & 31)) >>> 0, wA = pi >> 5;
          if (wA === 0) a0 = (a0 & mA) >>> 0;
          else if (wA === 1) a1 = (a1 & mA) >>> 0;
          else if (wA === 2) a2 = (a2 & mA) >>> 0;
          else a3 = (a3 & mA) >>> 0;

          const mB = ~(1 << (pj & 31)) >>> 0, wB = pj >> 5;
          if (wB === 0) a0 = (a0 & mB) >>> 0;
          else if (wB === 1) a1 = (a1 & mB) >>> 0;
          else if (wB === 2) a2 = (a2 & mB) >>> 0;
          else a3 = (a3 & mB) >>> 0;

          left -= 2;
          moves += 2;
          if (pi === clockI || pj === clockI) clockAlive = 0;
          continue;
        } else {
          // Face-up pair (trayLen < 3): take first tile (clock first if j is clock)
          const first = (clockAlive !== 0 && pj === clockI) ? pj : pi;
          if (recordTrace) trace.push(first);

          const mF = ~(1 << (first & 31)) >>> 0, wF = first >> 5;
          if (wF === 0) a0 = (a0 & mF) >>> 0;
          else if (wF === 1) a1 = (a1 & mF) >>> 0;
          else if (wF === 2) a2 = (a2 & mF) >>> 0;
          else a3 = (a3 & mF) >>> 0;

          const ff = faces[first];
          if (ff < 32) trayLo = (trayLo | ((1 << ff) >>> 0)) >>> 0;
          else trayHi = (trayHi | ((1 << (ff - 32)) >>> 0)) >>> 0;
          trayLen++;
          left--;
          moves++;
          if (first === clockI) clockAlive = 0;
          continue;
        }
      }
    }

    // Priority 3: Random free tile
    if (trayLen >= 3) {
      if (recordTrace) {
        let k = 0;
        if (tkCount > 1) {
          let r; [r, rng] = stepRng(rng);
          k = r % tkCount;
        }
        trace.push(tkList[k]);
      }
      return { win: 0, moves, trace };
    }

    let k = 0;
    if (tkCount > 1) {
      let r; [r, rng] = stepRng(rng);
      k = r % tkCount;
    }
    const chosen = tkList[k];
    if (recordTrace) trace.push(chosen);

    const cmask = ~(1 << (chosen & 31)) >>> 0;
    const cw = chosen >> 5;
    if (cw === 0) a0 = (a0 & cmask) >>> 0;
    else if (cw === 1) a1 = (a1 & cmask) >>> 0;
    else if (cw === 2) a2 = (a2 & cmask) >>> 0;
    else a3 = (a3 & cmask) >>> 0;

    const cf = faces[chosen];
    if (cf < 32) trayLo = (trayLo | ((1 << cf) >>> 0)) >>> 0;
    else trayHi = (trayHi | ((1 << (cf - 32)) >>> 0)) >>> 0;
    trayLen++;
    left--;
    moves++;
    if (chosen === clockI) clockAlive = 0;
  }
}

function runRangeSync(packedBoard, baseSeed, startGid, count) {
  let wins = 0;
  let totalMoves = 0;
  const end = startGid + count;
  for (let gid = startGid; gid < end; gid++) {
    const r = playOneGame(packedBoard, baseSeed, gid, false);
    wins += r.win;
    totalMoves += r.moves;
  }
  return { wins, count, totalMoves };
}

// Worker-thread pool for fair multi-core CPU benchmarking (reusable or cold)
class CpuWorkerPool {
  constructor(numWorkers = os.cpus().length) {
    this.numWorkers = numWorkers;
    this.workers = [];
    for (let w = 0; w < numWorkers; w++) {
      this.workers.push(new Worker(__filename, { workerData: { workerId: w } }));
    }
  }

  async runGames(design, numGames, baseSeed = 42) {
    const t0 = process.hrtime.bigint();
    const packed = packBoard(design);
    const W = Math.min(this.numWorkers, numGames);
    const chunk = Math.floor(numGames / W);
    const rem = numGames % W;

    const promises = [];
    let offset = 0;
    for (let w = 0; w < W; w++) {
      const count = chunk + (w < rem ? 1 : 0);
      const startGid = offset;
      offset += count;
      promises.push(new Promise((resolve, reject) => {
        const worker = this.workers[w];
        const onMsg = msg => {
          worker.off('error', onErr);
          resolve(msg);
        };
        const onErr = err => {
          worker.off('message', onMsg);
          reject(err);
        };
        worker.once('message', onMsg);
        worker.once('error', onErr);
        worker.postMessage({ packed, baseSeed, startGid, count });
      }));
    }

    const parts = await Promise.all(promises);
    let wins = 0, totalMoves = 0;
    for (const p of parts) {
      wins += p.wins;
      totalMoves += p.totalMoves;
    }
    const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    return {
      wins,
      numGames,
      winRate: wins / numGames,
      totalMoves,
      avgMoves: totalMoves / numGames,
      elapsedMs,
      gamesPerSec: (numGames / elapsedMs) * 1000,
    };
  }

  async close() {
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers = [];
  }
}

async function runCpuColdWithWorkers(design, numGames, baseSeed = 42, numWorkers = os.cpus().length) {
  const t0 = process.hrtime.bigint();
  const pool = new CpuWorkerPool(numWorkers);
  try {
    const res = await pool.runGames(design, numGames, baseSeed);
    const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;
    return {
      ...res,
      warmMs: res.elapsedMs,
      totalMs,
      coldGamesPerSec: (numGames / totalMs) * 1000,
    };
  } finally {
    await pool.close();
  }
}

if (!isMainThread && workerData && typeof workerData.workerId === 'number') {
  parentPort.on('message', ({ packed, baseSeed, startGid, count }) => {
    const res = runRangeSync(packed, baseSeed, startGid, count);
    parentPort.postMessage(res);
  });
}

module.exports = {
  packBoard,
  computeTakeable,
  stepFixedAction,
  playOneGame,
  runRangeSync,
  CpuWorkerPool,
  runCpuColdWithWorkers,
};
