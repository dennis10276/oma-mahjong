'use strict';
// test_choke_separation.js: Causal experiment testing separation of trap pairs
// to produce genuine depth 3-5 delayed chokes.

const E = require('../../../tools/builder/engine.js');
const B = require('../../../tools/builder/builder.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const Pk = require('../../../tools/builder/loop/publicfork.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const VC = require('../../../tools/builder/visible_choice.js');

function buildWithSeparation(layoutIndex, shape, separation = 1, seed = 1) {
  // We can hook into the pairing or build process
  // Let's modify a copy of visibleChoice with the requested separation
  const brief = {
    layout: layoutIndex,
    shape,
    story: 'deepClock',
    stage: 'edge',
    frame: { spare: 2 },
    targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
    seed,
    mode: 'visibleChoice'
  };

  // Build baseline
  const base = VC.build(brief);
  if (base.fail) return { fail: base.fail };

  const d = base.design;
  const traps = base.card.traps || [];
  if (!traps.length) return { fail: 'noTrapsInCard' };

  console.log(`Testing separation=${separation} on Layout ${layoutIndex} (${shape}), traps:`, traps);

  // If separation is 1, it's the baseline (immediate consecutive pair)
  if (separation === 1) {
    return { ok: true, design: d, separation: 1, traps };
  }

  // To separate [x, y] in d.solution:
  // Find where x and y are in d.solution
  const [x, y] = traps[0];
  const sol = d.solution.slice();
  const posX = sol.indexOf(x);
  const posY = sol.indexOf(y);

  if (posX < 0 || posY < 0 || Math.abs(posX - posY) !== 1) {
    return { fail: 'trapNotAdjacentInBaseline', posX, posY };
  }

  // Move y forward by (separation - 1) positions
  // sol currently has [..., x, y, t1, t2, ...]
  // We want: [..., x, t1, t2, ..., y, ...]
  const targetPosY = Math.min(sol.length - 1, posX + separation);
  sol.splice(posY, 1);
  sol.splice(targetPosY, 0, y);

  // Test if sol is a valid legal sequence under physical rules
  const g = E.game(d);
  const newD = JSON.parse(JSON.stringify(d));
  newD.solution = sol;

  const rep = E.replay(newD, sol, { strict: true });
  if (!rep.ok) {
    return { fail: 'reorderedWitnessFailed', why: rep.why, at: rep.at };
  }

  return { ok: true, design: newD, separation, traps, posX, targetPosY };
}

for (const sep of [1, 2, 3, 4]) {
  console.log(`\n--- Separation ${sep} on Layout 22 (ushape) ---`);
  const res = buildWithSeparation(22, 'ushape', sep, 1);
  if (res.ok) {
    console.log(`Build OK! posX=${res.posX}, posY=${res.targetPosY}`);
    // Check static gates
    const gates = SG.staticGates(res.design, { gateProfile: 'e5-v1' });
    console.log(`Static gates pass: ${gates.pass}, k=${gates.k}, failed: ${Object.keys(gates.gates).filter(g => gates.gates[g].pass === false).join(',')}`);
    if (gates.gates.A6) {
      console.log('Gate A6:', gates.gates.A6);
    }
  } else {
    console.log('Failed:', res.fail, res.why || '', res.at !== undefined ? `at step ${res.at}` : '');
  }
}
