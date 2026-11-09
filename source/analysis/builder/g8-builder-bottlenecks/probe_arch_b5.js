'use strict';
// probe_arch_b5.js
// Investigates the late tray losses (Gate B5) on Arch (Layout 0)
const fs = require('fs'), path = require('path');
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const Y = require('../../../tools/builder/loop/yardstick.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

// Compare tailPairWidth: 1 vs 2 on Arch with keys [7, 59]
for (const width of [1, 2, 3]) {
  const base = VC.build({
    layout: 0, shape: 'arch', story: 'deepClock', stage: 'edge',
    frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: width },
    seed: 1, mode: 'visibleChoice'
  });
  if (!base.design) {
    console.log(`width ${width}: base failed:`, base.fail);
    continue;
  }
  const keyed = K.clockKeys(base.design, [7, 59], 1, { lockTile: 0 });
  if (keyed.fail) {
    console.log(`width ${width}: keyed failed:`, keyed.fail);
    continue;
  }
  const d = keyed.design;
  const pl = ys.planner(d, { spare: 1 });
  const tr = T.traceGates(d, GP.traceOptions({ ys, spare: 1, campaigns: 40 }, profile));
  console.log(`Arch keys [7,59] width=${width} => S=${pl.S} traceD=${tr.D.toFixed(2)} B5=${tr.B5?.value} B6=${tr.B6?.value} B7=${tr.B7?.value} tracePass=${tr.pass}`);
}
