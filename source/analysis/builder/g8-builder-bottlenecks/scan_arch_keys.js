'use strict';
// scan_arch_keys.js
// Scans key pairs on Arch (Layout 0) with lockTile: 0 to find configurations that pass Gate B5
const fs = require('fs'), path = require('path');
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const Y = require('../../../tools/builder/loop/yardstick.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

const base = VC.build({
  layout: 0, shape: 'arch', story: 'deepClock', stage: 'edge',
  frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 1, mode: 'visibleChoice'
});

const n = base.design.tiles.length;
const pairs = [];
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    const res = K.clockKeys(base.design, [i, j], 1, { lockTile: 0 });
    if (!res.fail && res.proof && res.proof.minimum >= 10) {
      pairs.push({ keys: [i, j], k: res.proof.minimum });
    }
  }
}

console.log(`Found ${pairs.length} candidate key pairs on Arch with lock 0 and k >= 10`);

// Sort by k descending
pairs.sort((a, b) => b.k - a.k);

for (const p of pairs.slice(0, 10)) {
  const keyed = K.clockKeys(base.design, p.keys, 1, { lockTile: 0 });
  const d = keyed.design;
  const pl = ys.planner(d, { spare: 1 });
  const tr = T.traceGates(d, GP.traceOptions({ ys, spare: 1, campaigns: 40 }, profile));
  console.log(`keys [${p.keys}] k=${p.k} => S=${pl.S} traceD=${tr.D.toFixed(2)} B5=${tr.B5?.value} B6=${tr.B6?.value} B7=${tr.B7?.value} tracePass=${tr.pass} fails=[${Object.keys(tr).filter(k => tr[k] && tr[k].pass === false).join(',')}]`);
}
