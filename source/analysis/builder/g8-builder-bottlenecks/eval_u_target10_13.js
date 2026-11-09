'use strict';
// eval_u_target10_13.js
// Tests candidate recipes on Layout 22 targeting D in [9.0, 11.0] and [12.0, 14.0] with S in [2.5, 6.0]
const fs = require('fs'), path = require('path');
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const Y = require('../../../tools/builder/loop/yardstick.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

const candidates = [
  // Layout 22 seed 1
  { id: 'u-s1-keys11-15-ice73-h1-s1', seed: 1, keys: [11, 15], ice: { tile: 73, h: 1 }, spare: 1 },
  { id: 'u-s1-keys11-15-ice73-h2-s1', seed: 1, keys: [11, 15], ice: { tile: 73, h: 2 }, spare: 1 },
  { id: 'u-s1-keys0-40-ice42-h2-s1', seed: 1, keys: [0, 40], ice: { tile: 42, h: 2 }, spare: 1 },
  { id: 'u-s1-keys0-40-ice61-h1-s1', seed: 1, keys: [0, 40], ice: { tile: 61, h: 1 }, spare: 1 },
  { id: 'u-s1-keys2-41-ice73-h2-s1', seed: 1, keys: [2, 41], ice: { tile: 73, h: 2 }, spare: 1 },
  { id: 'u-s1-keys3-52-ice73-h2-s1', seed: 1, keys: [3, 52], ice: { tile: 73, h: 2 }, spare: 1 },
  { id: 'u-s1-keys18-56-ice73-h2-s1', seed: 1, keys: [18, 56], ice: { tile: 73, h: 2 }, spare: 1 },
  { id: 'u-s1-keys33-59-ice73-h2-s1', seed: 1, keys: [33, 59], ice: { tile: 73, h: 2 }, spare: 1 },
  { id: 'u-s1-keys5-9-ice44-h1-s1', seed: 1, keys: [5, 9], ice: { tile: 44, h: 1 }, spare: 1 }
];

for (const c of candidates) {
  const base = VC.build({
    layout: 22, shape: 'ushape', story: 'deepClock', stage: 'edge',
    frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
    seed: c.seed, mode: 'visibleChoice'
  });
  if (!base.design) {
    console.log(`${c.id}: base failed (${base.fail})`);
    continue;
  }
  const built = K.clockKeyIce(base.design, c.keys, c.ice, c.spare);
  if (built.fail) {
    console.log(`${c.id}: build failed (${built.fail})`);
    continue;
  }
  const d = built.design;
  const pl = ys.planner(d, { spare: c.spare });
  const fam = ys.rate(d, { block: 'CURVE', allResults: true });
  const tr = T.traceGates(d, GP.traceOptions({ ys, spare: c.spare, campaigns: 40 }, profile));
  console.log(`[${c.id}] k=${built.proof.minimum} s=${c.spare} ck=${d.clock.n} => S=${pl.S} D=${fam.D.toFixed(2)} (traceD=${tr.D.toFixed(2)}) B5=${tr.B5?.value} B6=${tr.B6?.value} B7=${tr.B7?.value} tracePass=${tr.pass} fails=[${Object.keys(tr).filter(k => tr[k] && tr[k].pass === false).join(',')}]`);
}
