'use strict';
// scan_castle.js
// Scans key pairs on Layout 20 (castle) with lockTile: 77
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const Y = require('../../../tools/builder/loop/yardstick.js');
const ys = Y.createYardstick();

const base = VC.build({
  layout: 20, shape: 'castle · two islands', story: 'deepClock', stage: 'top',
  frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 2, mode: 'visibleChoice'
});

const n = base.design.tiles.length;
const pairs = [];
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    const res = K.clockKeys(base.design, [i, j], 1, { lockTile: 77 });
    if (!res.fail && res.proof && res.proof.minimum >= 12) {
      pairs.push({ keys: [i, j], k: res.proof.minimum });
    }
  }
}
console.log(`Found ${pairs.length} key pairs on Castle with lock 77 and k >= 12`);
pairs.sort((a, b) => b.k - a.k);
for (const p of pairs.slice(0, 15)) {
  const b = K.clockKeys(base.design, p.keys, 1, { lockTile: 77 });
  const pl = ys.planner(b.design);
  const fam = ys.rate(b.design, { block: 'CURVE' });
  console.log(`keys: [${p.keys}], k=${p.k}, S=${pl.S}, D=${fam.D}`);
}
