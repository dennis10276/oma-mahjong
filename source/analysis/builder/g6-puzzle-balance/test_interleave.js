'use strict';
const B = require('../../../tools/builder/builder.js');
const E = require('../../../tools/builder/engine.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const Y = require('../../../tools/builder/loop/yardstick.js');
const { tileVisibility } = require('../../../tools/sim/refit/human_board_visibility.js');

const W = D.work();
const profile = GP.loadProfile('e5-v1');

function buildInterleaved(layoutIdx, { commitment = 0, chokeDelay = 1, stages = 1, spare = 2, seed = 1 } = {}) {
  const lay = B.LAYOUTS[layoutIdx];
  const n = lay.tiles.length;
  const c = B.context(lay.tiles);
  const alive = new Uint8Array(n).fill(1);
  const order = [];

  // 1. Generate clean topological solution order
  while (alive.some(Boolean)) {
    const free = [];
    for (let i = 0; i < n; i++) if (alive[i] && L.isFree(i, alive, c.nb)) free.push(i);
    if (!free.length) return { fail: 'stuck' };
    free.sort((a, b) => (lay.tiles[b][2] - lay.tiles[a][2]) || (a - b));
    const pick = free[0];
    alive[pick] = 0;
    order.push(pick);
  }

  // 2. Build pairing plan along order
  // For each stage, we can interleave an offset block.
  // Stage locations: spaced out along the solution order.
  // Let's place clock at move 7 (k = 7, so clock.n = 7 + spare <= 19).
  const clockMove = 7;
  const clockTile = order[clockMove - 1];

  const pairs = [];
  const assigned = new Uint8Array(n);

  // Mark clock pair: order[0] and order[clockMove - 1] (or adjacent)
  // Let's pair order[0] with order[clockMove - 1] as the clock pair
  pairs.push([order[0], order[clockMove - 1]]);
  assigned[order[0]] = 1;
  assigned[order[clockMove - 1]] = 1;

  // Now, between move 1 and clockMove - 2: pair them up
  const prelude = [];
  for (let i = 1; i < clockMove - 1; i++) if (!assigned[order[i]]) prelude.push(order[i]);
  for (let i = 0; i < prelude.length; i += 2) {
    if (i + 1 < prelude.length) {
      pairs.push([prelude[i], prelude[i + 1]]);
      assigned[prelude[i]] = 1;
      assigned[prelude[i + 1]] = 1;
    }
  }

  // The remaining tiles after the clock:
  const rem = [];
  for (let i = 0; i < n; i++) {
    const t = order[i];
    if (!assigned[t]) rem.push(t);
  }

  // In `rem`, we build the stages!
  // If commitment === 0: simple adjacent pairs
  if (commitment === 0) {
    for (let i = 0; i < rem.length; i += 2) {
      if (i + 1 < rem.length) pairs.push([rem[i], rem[i + 1]]);
    }
  } else if (commitment === 1) {
    // 2 overlapping pairs at stage 1
    // rem[0] <-> rem[2], rem[1] <-> rem[3]
    if (rem.length >= 4) {
      pairs.push([rem[0], rem[2]]);
      pairs.push([rem[1], rem[3]]);
      for (let i = 4; i < rem.length; i += 2) {
        if (i + 1 < rem.length) pairs.push([rem[i], rem[i + 1]]);
      }
    }
  } else if (commitment === 2) {
    // 3 overlapping pairs: rem[0] <-> rem[3], rem[1] <-> rem[4], rem[2] <-> rem[5]
    // If chokeDelay > 1, we insert chokeDelay padding pairs between the opening and the match!
    const numPadding = Math.max(0, Math.floor((chokeDelay - 1) / 2));
    let idx = 0;
    for (let s = 0; s < stages; s++) {
      if (idx + 6 + numPadding * 2 <= rem.length) {
        // Overlap:
        pairs.push([rem[idx], rem[idx + 3 + numPadding * 2]]);
        pairs.push([rem[idx + 1], rem[idx + 4 + numPadding * 2]]);
        pairs.push([rem[idx + 2], rem[idx + 5 + numPadding * 2]]);
        // Padding pairs in between:
        for (let p = 0; p < numPadding; p++) {
          pairs.push([rem[idx + 3 + 2 * p], rem[idx + 3 + 2 * p + 1]]);
        }
        idx += 6 + numPadding * 2;
      }
    }
    // Remaining tiles: adjacent pairs
    for (let i = idx; i < rem.length; i += 2) {
      if (i + 1 < rem.length) pairs.push([rem[i], rem[i + 1]]);
    }
  }

  // Handle any leftover odd tile if n/2 pairs
  if (pairs.length !== n / 2) return { fail: 'pairCount', pairs: pairs.length, expected: n / 2 };

  // Assign faces to pairs
  const faces = new Array(n);
  // Total pairs: n / 2.
  // Standard tile faces: if n = 72, 36 faces (each used twice).
  // If n = 74 or 76, we have some 4-copy faces.
  const numFaces = Math.min(36, pairs.length);
  const duplicates = pairs.length - numFaces; // number of 4-copy pairs
  const lateStart = pairs.length - 2 * duplicates;

  pairs.forEach((p, i) => {
    const face = i < lateStart ? i : lateStart + Math.floor((i - lateStart) / 2);
    faces[p[0]] = face;
    faces[p[1]] = face;
  });

  // Seed relabels pictures
  const labels = Array.from({ length: 36 }, (_, i) => i);
  let s = (seed ?? 1) >>> 0;
  for (let i = 35; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }

  const design = {
    tiles: lay.tiles.map(t => t.slice()),
    faces: faces.map(f => labels[f]),
    down: [],
    gold: [],
    obst: { ice: {}, locks: [], keys: [] },
    clock: { i: clockTile, n: clockMove + spare },
    solution: order
  };

  return { design, order, clockTile, clockMove, spare };
}

function test() {
  console.log('Testing prototype builds on layout 33 (ushape 72)...');
  for (const c of [0, 1, 2]) {
    const res = buildInterleaved(33, { commitment: c, chokeDelay: 1, stages: 1, spare: 2, seed: 1 });
    if (!res.design) { console.log('Commitment', c, 'FAILED:', res.fail); continue; }
    const rep = E.replay(res.design, res.order, { strict: true });
    console.log(`Commitment ${c}: strict replay = ${rep.ok}`);
    const sg = SG.staticGates(res.design, { stopEarly: false });
    const applied = GP.applyStatic(sg, profile);
    console.log(`  static pass: ${applied.pass}, A6: ${applied.gates.A6.pass}`);
    if (!applied.gates.A6.pass) {
      console.log('  A6 unfair:', JSON.stringify(applied.gates.A6.detail?.unfair));
    }
  }

  console.log('\nTesting chokeDelay causals (commitment=2) on layout 33...');
  for (const cd of [1, 3, 5, 8]) {
    const res = buildInterleaved(33, { commitment: 2, chokeDelay: cd, stages: 1, spare: 2, seed: 1 });
    if (!res.design) { console.log('ChokeDelay', cd, 'FAILED:', res.fail); continue; }
    const rep = E.replay(res.design, res.order, { strict: true });
    const sg = SG.staticGates(res.design, { stopEarly: false });
    const applied = GP.applyStatic(sg, profile);
    console.log(`  chokeDelay ${cd}: strict=${rep.ok}, static=${applied.pass}, A6=${applied.gates.A6.pass}`);
    if (!applied.gates.A6.pass) {
      console.log('    unfair:', JSON.stringify(applied.gates.A6.detail?.unfair));
    }
  }
}

module.exports = { buildInterleaved };
if (require.main === module) test();
