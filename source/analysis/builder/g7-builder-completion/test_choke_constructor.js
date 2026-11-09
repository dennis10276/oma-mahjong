'use strict';
// test_choke_constructor.js: Proves and tests the False-Relief Delayed Choke (FR-3/4)
// construction across catalogue layouts.

const E = require('../../../tools/builder/engine.js');
const B = require('../../../tools/builder/builder.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const Pk = require('../../../tools/builder/loop/publicfork.js');
const SG = require('../../../tools/builder/loop/static_gates.js');

function buildFRChoke(layoutIndex, spare = 2, seed = 1) {
  const lay = B.LAYOUTS[layoutIndex];
  if (!lay) return { fail: 'invalidLayout' };
  const tiles = lay.tiles;
  const n = tiles.length;
  const objects = tiles.map(([x, y, z]) => ({ x, y, z }));
  const nb = L.neighbors(objects);

  // 1. Pick a clock candidate: top layer tile with shortest route k in [6, 10]
  // We search for a tile that has a nice clean route
  let bestClock = null;
  for (let c = 0; c < n; c++) {
    if (objects[c].z >= 1 && nb.above[c].length === 0) {
      // Test dummy game to find exact route to c
      const dummyFaces = new Array(n).fill(0);
      const testD = {
        tiles: lay.tiles.map(t => t.slice()),
        faces: dummyFaces,
        down: [],
        gold: [],
        obst: { ice: {}, locks: [], keys: [] },
        clock: { i: c, n: 99 },
        solution: []
      };
      const cs = E.clockShortest(E.game(testD, { strict: true }), { nodes: 20000 });
      if (cs && cs.k >= 6 && cs.k <= 10 && cs.k + spare <= 19 && cs.path && cs.path.length === cs.k) {
        // Complete the witness from the clock state
        const alFull = new Uint8Array(n).fill(1);
        for (const t of cs.path) alFull[t] = 0;
        const remaining = [];
        while (remaining.length < n - cs.k) {
          const ready = [];
          for (let i = 0; i < n; i++) if (alFull[i] && L.isFree(i, alFull, nb)) ready.push(i);
          if (!ready.length) break;
          ready.sort((a, b) => objects[b].z - objects[a].z || a - b);
          const p = ready[0];
          alFull[p] = 0;
          remaining.push(p);
        }
        if (remaining.length === n - cs.k) {
          bestClock = { tile: c, k: cs.k, path: cs.path.concat(remaining) };
          break;
        }
      }
    }
  }

  if (!bestClock) return { fail: 'noClockCandidate' };
  const { tile: clockTile, k: clockK, path: fullWitness } = bestClock;
  const clockPrefix = fullWitness.slice(0, clockK);

  // 2. Identify fork position m along clockPrefix (e.g. m = 2 or 3)
  // At step m, we have removed clockPrefix[0..m-1].
  // Next clock move is TW = clockPrefix[m].
  // We want to find a tempting move TL != TW that is free at step m.
  let forkStep = -1;
  let tlTile = -1;
  let r1Tile = -1;
  let r2Tile = -1;

  const al = new Uint8Array(n).fill(1);
  for (let s = 0; s < clockK - 2; s++) {
    al[clockPrefix[s]] = 0;
    if (s >= 1) { // At least 1 tile removed before fork
      const freeAtS = [];
      for (let i = 0; i < n; i++) {
        if (al[i] && !clockPrefix.includes(i) && L.isFree(i, al, nb)) {
          freeAtS.push(i);
        }
      }
      
      // Look for a tile TL in freeAtS that, when removed, unblocks a tile R1
      for (const candTL of freeAtS) {
        const alAfterTL = al.slice();
        alAfterTL[candTL] = 0;
        const unblocked = [];
        for (let j = 0; j < n; j++) {
          if (alAfterTL[j] && !L.isFree(j, al, nb) && L.isFree(j, alAfterTL, nb)) {
            unblocked.push(j);
          }
        }
        
        if (unblocked.length >= 1) {
          // Find an R2 that is currently free or free after TL
          const candR1 = unblocked[0];
          const candR2 = freeAtS.find(x => x !== candTL && x !== candR1);
          if (candR2 !== undefined) {
            forkStep = s + 1;
            tlTile = candTL;
            r1Tile = candR1;
            r2Tile = candR2;
            break;
          }
        }
      }
      if (forkStep >= 0) break;
    }
  }

  if (forkStep < 0) return { fail: 'noChokeGeometryFound' };

  const twTile = clockPrefix[forkStep];
  console.log(`Fork located at step ${forkStep}: TW=${twTile}, TL=${tlTile}, R1=${r1Tile}, R2=${r2Tile}`);

  // 3. Plan pairs and faces
  // Pair 1: clockPrefix[forkStep - 1] (the entry tile E) paired with a tile unblocked by TW
  // Pair 2: R1 and R2 paired together (false relief pair)
  // Pair 3: TL paired with a tile late in the witness
  const paired = new Map(); // tile -> mate
  const faces = new Array(n).fill(-1);
  let faceId = 0;

  function setPair(t1, t2) {
    paired.set(t1, t2);
    paired.set(t2, t1);
    const f = faceId++;
    faces[t1] = f;
    faces[t2] = f;
  }

  // False relief pair
  setPair(r1Tile, r2Tile);

  // Entry tile before fork paired with a tile after TW
  const entryTile = clockPrefix[forkStep - 1];
  const postTW = clockPrefix.slice(forkStep + 1);
  const entryMate = postTW[0] || clockTile;
  setPair(entryTile, entryMate);

  // TL paired with a late tile
  const lateTiles = fullWitness.slice(clockK + 5);
  const tlMate = lateTiles[0] || fullWitness[n - 1];
  setPair(tlTile, tlMate);

  // Clock tile pair (if not already paired)
  if (!paired.has(clockTile)) {
    const clockMate = fullWitness.find(t => !paired.has(t) && t !== clockTile);
    setPair(clockTile, clockMate);
  }

  // Pair remaining tiles in witness order
  for (let i = 0; i < n; i++) {
    const t1 = fullWitness[i];
    if (paired.has(t1)) continue;
    for (let j = i + 1; j < n; j++) {
      const t2 = fullWitness[j];
      if (!paired.has(t2)) {
        setPair(t1, t2);
        break;
      }
    }
  }

  // Re-map faces if faceId > 36 to ensure valid pictures
  if (faceId > 36) {
    for (let i = 0; i < n; i++) {
      faces[i] = faces[i] % 36;
    }
  }

  const design = {
    tiles: lay.tiles.map(t => t.slice()),
    faces,
    down: [],
    gold: [],
    obst: { ice: {}, locks: [], keys: [] },
    clock: { i: clockTile, n: clockK + spare },
    solution: fullWitness.slice()
  };

  // 4. Verification proofs
  const g = E.game(design);
  const rep = E.replay(design, design.solution, { strict: true });
  if (!rep.ok) return { fail: 'witnessFailed', why: rep.why, at: rep.at };

  const cs = E.clockShortest(E.game(design, { strict: true }), { nodes: 200000 });
  if (!cs || cs.k !== clockK) return { fail: 'clockShortestMismatch', expected: clockK, actual: cs ? cs.k : null };

  // Trace to fork
  let s = E.start(g);
  for (let i = 0; i < forkStep; i++) s = E.step(g, s, fullWitness[i]);

  const sl = E.step(g, s, tlTile);
  if (!sl) return { fail: 'tlLosesInstantly' };

  const winProof = E.winnable(g, E.step(g, s, twTile), { nodes: 100000 });
  const loseProof = E.winnable(g, sl, { nodes: 100000 });
  const longest = E.longest(g, sl, 10, 50000);

  return {
    ok: true,
    layoutIndex,
    shape: lay.shape,
    k: clockK,
    spare,
    forkStep,
    tw: twTile,
    tl: tlTile,
    r1: r1Tile,
    r2: r2Tile,
    trayAtFork: s.tray.map(t => g.faces[t]),
    winResult: winProof.result,
    loseResult: loseProof.result,
    depth: longest.depth,
    design
  };
}

console.log('Testing FR-Choke on layouts 22, 8, 0, 25...');
for (const idx of [22, 8, 0, 25]) {
  const res = buildFRChoke(idx, 2, 1);
  if (res.ok) {
    console.log(`Layout ${idx} (${res.shape}): SUCCESS!`);
    console.log(`  k=${res.k}, forkStep=${res.forkStep}, TW=${res.tw}, TL=${res.tl}`);
    console.log(`  winResult=${res.winResult}, loseResult=${res.loseResult}, depth=${res.depth}`);
  } else {
    console.log(`Layout ${idx}: Failed (${res.fail})`);
  }
}
