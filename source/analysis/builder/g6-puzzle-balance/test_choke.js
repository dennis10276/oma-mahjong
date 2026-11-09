'use strict';
const B = require('../../../tools/builder/builder.js');
const E = require('../../../tools/builder/engine.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const { tileVisibility } = require('../../../tools/sim/refit/human_board_visibility.js');

const W = D.work();
const profile = GP.loadProfile('e5-v1');

function constructPuzzle(layoutIdx, { commitment = 0, chokeDelay = 1, stages = 1, spare = 2, seed = 1 } = {}) {
  const lay = B.LAYOUTS[layoutIdx];
  const n = lay.tiles.length;
  const objects = lay.tiles.map(([x, y, z]) => ({ x, y, z }));

  // Check initial visibility
  const vis0 = tileVisibility(objects, {
    alive: new Uint8Array(n).fill(1),
    down: new Uint8Array(n),
    openPeek: -1
  }, null).tiles;

  // 1. Base clean pairing: pairs of adjacent indices
  const faces = new Array(n);
  for (let i = 0; i < n; i += 2) {
    faces[i] = i / 2;
    faces[i + 1] = i / 2;
  }

  // 2. Find a visible clock tile with k in [5, 10]
  let bestClock = null;
  for (let i = 0; i < n; i++) {
    if (!vis0[i].picture) continue;
    const testD = {
      tiles: lay.tiles.map(t => t.slice()),
      faces: faces.slice(),
      down: [],
      gold: [],
      obst: { ice: {}, locks: [], keys: [] },
      clock: { i, n: 99 },
      solution: []
    };
    const cs = E.clockShortest(E.game(testD, { strict: true }), { nodes: 20000 });
    if (cs && cs.k >= 5 && cs.k <= 10 && cs.path && cs.path.length === n) {
      bestClock = { tile: i, k: cs.k, path: cs.path };
      break;
    }
  }

  if (!bestClock) return { fail: 'noClockCandidate' };
  const { tile: clockTile, k: clockK, path: winPath } = bestClock;

  // 3. Now modify faces along winPath to implement commitment & chokeDelay
  // Along winPath: clock is at index clockK - 1.
  // After clock (from step clockK onward), create the controlled choice:
  // In the base board, every pair was [winPath[2i], winPath[2i+1]].
  // To create commitment = 1:
  // At step clockK: winPath[clockK] has face F1, winPath[clockK+1] has face F2.
  // winPath[clockK+2] has face F1 (closes F1), winPath[clockK+3] has face F2 (closes F2).
  // Tray reaches 2 waiting tiles.
  // To create commitment = 2:
  // winPath[clockK] has F1, winPath[clockK+1] has F2, winPath[clockK+2] has F3.
  // Then winPath[clockK+3] has F1 (clears F1), winPath[clockK+4] has F2, winPath[clockK+5] has F3.
  // Tray reaches 3 waiting tiles!
  // At step clockK+2: tray has [F1, F2].
  // Next winPath move is winPath[clockK+2] (face F3), tray becomes [F1, F2, F3].
  // Then winning move is winPath[clockK+3] (face F1, clearing F1).
  // A tempting move would be taking an exposed tile with face F_trap (filling 4th slot -> loss).

  const newFaces = new Array(n).fill(-1);
  let faceId = 0;

  // Prelude: pair tiles up to clock
  for (let i = 0; i < clockK; i += 2) {
    if (i + 1 < clockK) {
      newFaces[winPath[i]] = faceId;
      newFaces[winPath[i + 1]] = faceId++;
    } else {
      // Odd tile: pair with winPath[clockK]
      newFaces[winPath[i]] = faceId;
      newFaces[winPath[clockK]] = faceId++;
    }
  }

  let cur = clockK + (newFaces[winPath[clockK]] !== -1 ? 1 : 0);

  // Implement stages
  for (let s = 0; s < stages; s++) {
    if (cur + 6 >= n) break;
    if (commitment === 0) {
      // No overlap: clean pairs
      newFaces[winPath[cur]] = faceId;
      newFaces[winPath[cur + 1]] = faceId++;
      cur += 2;
    } else if (commitment === 1) {
      // 2 overlapping pairs
      const f1 = faceId++, f2 = faceId++;
      newFaces[winPath[cur]] = f1;
      newFaces[winPath[cur + 1]] = f2;
      newFaces[winPath[cur + 2]] = f1;
      newFaces[winPath[cur + 3]] = f2;
      cur += 4;
    } else if (commitment === 2) {
      // 3 overlapping pairs with chokeDelay padding
      const f1 = faceId++, f2 = faceId++, f3 = faceId++;
      newFaces[winPath[cur]] = f1;
      newFaces[winPath[cur + 1]] = f2;
      newFaces[winPath[cur + 2]] = f3;

      // Padding pairs in between to set chokeDelay
      const padPairs = Math.max(0, Math.floor((chokeDelay - 1) / 2));
      for (let p = 0; p < padPairs; p++) {
        if (cur + 3 + 2 * p + 1 < n) {
          const fPad = faceId++;
          newFaces[winPath[cur + 3 + 2 * p]] = fPad;
          newFaces[winPath[cur + 3 + 2 * p + 1]] = fPad;
        }
      }

      const closeBase = cur + 3 + padPairs * 2;
      if (closeBase + 2 < n) {
        newFaces[winPath[closeBase]] = f1;
        newFaces[winPath[closeBase + 1]] = f2;
        newFaces[winPath[closeBase + 2]] = f3;
        cur = closeBase + 3;
      } else {
        cur += 3;
      }
    }
  }

  // Fill remaining tiles with clean pairs
  while (cur < n) {
    if (newFaces[winPath[cur]] === -1) {
      // Find another unassigned tile
      let nextUn = -1;
      for (let j = cur + 1; j < n; j++) {
        if (newFaces[winPath[j]] === -1) { nextUn = j; break; }
      }
      if (nextUn !== -1) {
        const f = faceId < 36 ? faceId++ : faceId - 1; // handle face count limit
        newFaces[winPath[cur]] = f;
        newFaces[winPath[nextUn]] = f;
      }
    }
    cur++;
  }

  // Handle any unassigned tile
  for (let i = 0; i < n; i++) {
    if (newFaces[i] === -1) {
      for (let j = i + 1; j < n; j++) {
        if (newFaces[j] === -1) {
          const f = faceId < 36 ? faceId++ : 0;
          newFaces[i] = f;
          newFaces[j] = f;
          break;
        }
      }
    }
  }

  // Permute labels via seed
  const labels = Array.from({ length: 36 }, (_, i) => i);
  let s = (seed ?? 1) >>> 0;
  for (let i = 35; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }

  const design = {
    tiles: lay.tiles.map(t => t.slice()),
    faces: newFaces.map(f => labels[Math.max(0, Math.min(35, f))]),
    down: [],
    gold: [],
    obst: { ice: {}, locks: [], keys: [] },
    clock: { i: clockTile, n: clockK + spare },
    solution: winPath
  };

  // Check strict replay
  const rep = E.replay(design, winPath, { strict: true });
  return { design, rep, clockTile, clockK, path: winPath };
}

function runTest() {
  console.log('Testing constructPuzzle on layout 33 (ushape 72)...');
  for (const c of [0, 1, 2]) {
    const res = constructPuzzle(33, { commitment: c, chokeDelay: 1, stages: 1, spare: 2, seed: 1 });
    if (!res.design) { console.log('Commitment', c, 'FAILED:', res.fail); continue; }
    console.log(`Commitment ${c}: rep.ok = ${res.rep.ok}`);
    const sg = SG.staticGates(res.design, { stopEarly: false });
    const applied = GP.applyStatic(sg, profile);
    console.log(`  Overall static pass: ${applied.pass}, A6: ${applied.gates.A6.pass}`);
    if (!applied.gates.A6.pass) {
      console.log('  A6 unfair:', JSON.stringify(applied.gates.A6.detail?.unfair));
    }
  }

  console.log('\nTesting chokeDelay causals (commitment=2) on layout 33...');
  for (const cd of [1, 3, 5, 8]) {
    const res = constructPuzzle(33, { commitment: 2, chokeDelay: cd, stages: 1, spare: 2, seed: 1 });
    if (!res.design) { console.log('ChokeDelay', cd, 'FAILED:', res.fail); continue; }
    const sg = SG.staticGates(res.design, { stopEarly: false });
    const applied = GP.applyStatic(sg, profile);
    console.log(`  chokeDelay ${cd}: rep.ok=${res.rep.ok}, static=${applied.pass}, A6=${applied.gates.A6.pass}`);
    if (!applied.gates.A6.pass) {
      console.log('    A6 unfair:', JSON.stringify(applied.gates.A6.detail?.unfair));
    }
  }
}

runTest();
