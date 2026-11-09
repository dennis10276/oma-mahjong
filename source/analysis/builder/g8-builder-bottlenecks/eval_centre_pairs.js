'use strict';
// eval_centre_pairs.js
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const Y = require('../../../tools/builder/loop/yardstick.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

const b = VC.build({
  layout: 22, shape: 'ushape', story: 'deepClock', stage: 'centre',
  frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 1, mode: 'visibleChoice'
});

const locks = [74, 69];
for (const lock of locks) {
  for (let i = 0; i < 76; i++) {
    for (let j = i + 1; j < 76; j++) {
      const res = K.clockKeys(b.design, [i, j], 1, { lockTile: lock });
      if (!res.fail && res.proof && res.proof.minimum >= 13) {
        const d = res.design;
        const pl = ys.planner(d, { spare: 1 });
        const fam = ys.rate(d, { block: 'CURVE' });
        const tr = T.traceGates(d, GP.traceOptions({ ys, spare: 1, campaigns: 40 }, profile));
        console.log(`lock ${lock} keys [${i},${j}] k=${res.proof.minimum} => S=${pl.S} D=${fam.D.toFixed(2)} traceD=${tr.D.toFixed(2)} B5=${tr.B5?.value} B6=${tr.B6?.value} B7=${tr.B7?.value} tracePass=${tr.pass} fails=[${Object.keys(tr).filter(k => tr[k] && tr[k].pass === false).join(',')}]`);
      }
    }
  }
}
