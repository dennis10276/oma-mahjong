'use strict';
// probe_seeds_traps.js
// Tests how seed and trap variations on U-shape affect D and S for keys [5, 9] + ice 44
const VC = require('../../tools/builder/visible_choice.js');
const K = require('../../tools/builder/knobs.js');
const GP = require('../../tools/builder/loop/gate_profile.js');
const T = require('../../tools/builder/loop/traces.js');
const Y = require('../../tools/builder/loop/yardstick.js');
const SG = require('../../tools/builder/loop/static_gates.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

const configs = [
  // Different seeds for U-shape base
  { id: 'u-seed1-traps2', seed: 1, traps: 2 },
  { id: 'u-seed1-traps3', seed: 1, traps: 3 },
  { id: 'u-seed1-tail1', seed: 1, traps: 2, tailPairWidth: 1 },
  { id: 'u-seed2-traps2', seed: 2, traps: 2 },
  { id: 'u-seed3-traps2', seed: 3, traps: 2 },
  { id: 'u-seed4-traps2', seed: 4, traps: 2 }
];

console.log('Testing seed and parameter variations on U-shape...');

for (const cfg of configs) {
  const brief = {
    layout: 22, shape: 'ushape', story: 'deepClock', stage: 'edge',
    frame: { spare: 2 },
    targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: cfg.tailPairWidth || 2, traps: cfg.traps },
    seed: cfg.seed, mode: 'visibleChoice'
  };
  const base = VC.build(brief);
  if (!base.design) {
    console.log(`[${cfg.id}] base build failed: ${base.fail}`);
    continue;
  }

  // Check if keys [5, 9] and ice 44 work on this base
  const built = K.clockKeyIce(base.design, [5, 9], { tile: 44, h: 2 }, 1);
  if (built.fail) {
    console.log(`[${cfg.id}] clockKeyIce failed: ${built.fail}`);
    continue;
  }

  const d = built.design;
  const pl = ys.planner(d, { spare: 1 });
  const fam = ys.rate(d, { block: 'CURVE', allResults: true });
  const tr = T.traceGates(d, GP.traceOptions({ ys, spare: 1, campaigns: 40 }, profile));

  const fails = Object.keys(tr).filter(k => tr[k] && tr[k].pass === false);
  console.log(`[${cfg.id}] k=${built.proof.minimum} => S=${pl.S} D=${fam.D.toFixed(2)} (traceD=${tr.D.toFixed(2)}) B6=${tr.B6?.value} B7=${tr.B7?.value} tracePass=${tr.pass} fails=[${fails.join(',')}]`);
}
