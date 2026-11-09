'use strict';
// test_choke_mechanism.js: Tests constructing explicit false-relief delayed-choke forks
// with forced loss depth 3-4 on multiple catalogue layouts.

const E = require('../../../tools/builder/engine.js');
const B = require('../../../tools/builder/builder.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const P = require('../../../tools/builder/loop/publicfork.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const { tileVisibility } = require('../../../tools/sim/refit/human_board_visibility.js');

function buildChokeBoard(layoutIndex, spare = 2, seed = 1) {
  const lay = B.LAYOUTS[layoutIndex];
  if (!lay) return { fail: 'invalidLayout' };
  const tiles = lay.tiles;
  const n = tiles.length;
  const objects = tiles.map(([x, y, z]) => ({ x, y, z }));
  const nb = L.neighbors(objects);

  // 1. Initial base topological sequence
  const alive = new Uint8Array(n).fill(1);
  const order = [];
  while (order.length < n) {
    const ready = [];
    for (let i = 0; i < n; i++) {
      if (alive[i] && L.isFree(i, alive, nb)) ready.push(i);
    }
    if (!ready.length) return { fail: 'topologicalStall' };
    // Stable pseudo-random tie-breaker
    ready.sort((a, b) => {
      const za = objects[a].z, zb = objects[b].z;
      if (za !== zb) return zb - za; // higher layer first
      return a - b;
    });
    const pick = ready[0];
    alive[pick] = 0;
    order.push(pick);
  }

  // 2. Select clock tile from order[k-1] where k in [6, 10]
  // Target k = 8
  const k = Math.min(10, Math.max(6, Math.floor(n * 0.1)));
  const clockTile = order[k - 1];
  const clockPrefix = order.slice(0, k);

  // 3. Plan pairs along order
  // To create a delayed choke:
  // Let clockTile be an entry tile E whose partner E' is at order[k+4].
  // Between k and k+4:
  // Fork at move k:
  // Winning move: take order[k] (leads to E' at order[k+4])
  // Tempting losing move TL: a free tile not on the clock prefix that unblocks false-relief pair R1, R2.
  
  // Let's create pairs mapping
  const pairs = [];
  const paired = new Set();
  
  // Pair clockTile with order[k + 4] (requires waiting in tray for 4 moves)
  const mateClock = order[k + 4];
  pairs.push([clockTile, mateClock]);
  paired.add(clockTile);
  paired.add(mateClock);
  
  // Pair remaining tiles in order
  for (let i = 0; i < n; i++) {
    const t1 = order[i];
    if (paired.has(t1)) continue;
    // Find next unpaired tile in order
    for (let j = i + 1; j < n; j++) {
      const t2 = order[j];
      if (!paired.has(t2)) {
        pairs.push([t1, t2]);
        paired.add(t1);
        paired.add(t2);
        break;
      }
    }
  }

  if (pairs.length !== n / 2) return { fail: 'pairingIncomplete' };

  // Assign pictures: up to 36 distinct pictures
  const faces = new Array(n).fill(-1);
  const doubles = Math.max(0, pairs.length - 36);
  let faceId = 0;
  for (let p = 0; p < pairs.length; p++) {
    const f = p < 36 ? p : (p % 36);
    faces[pairs[p][0]] = f;
    faces[pairs[p][1]] = f;
  }

  const design = {
    tiles: lay.tiles.map(t => t.slice()),
    faces,
    down: [],
    gold: [],
    obst: { ice: {}, locks: [], keys: [] },
    clock: { i: clockTile, n: k + spare },
    solution: order.slice()
  };

  // Verify basic replay
  const rep = E.replay(design, design.solution, { strict: true });
  if (!rep.ok) return { fail: 'witnessFailed', why: rep.why, at: rep.at };

  // Prove clock shortest
  const cs = E.clockShortest(E.game(design, { strict: true }), { nodes: 200000 });
  if (!cs || cs.k !== k) return { fail: `clockShortestMismatch: expected ${k}, got ${cs ? cs.k : 'null'}` };

  return { ok: true, layoutIndex, shape: lay.shape, k, spare, clockTile, design };
}

console.log('Testing prototype on layouts 22, 8, 0, 25...');
for (const idx of [22, 8, 0, 25]) {
  const res = buildChokeBoard(idx, 2, 1);
  if (res.ok) {
    console.log(`Layout ${idx} (${res.shape}): Built OK, k=${res.k}, clockTile=${res.clockTile}`);
    const g = E.game(res.design);
    const gates = SG.checkDesign(res.design, { gateProfile: 'e5-v1' });
    console.log(`  Static pass: ${gates.pass}, k=${gates.k}, failed: ${Object.keys(gates.gates).filter(g => gates.gates[g].pass === false).join(',')}`);
  } else {
    console.log(`Layout ${idx}: Failed: ${res.fail} (${res.why || ''})`);
  }
}
