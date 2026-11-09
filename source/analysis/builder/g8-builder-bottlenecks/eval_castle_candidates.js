'use strict';
// eval_castle_candidates.js
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const Y = require('../../../tools/builder/loop/yardstick.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

const base = VC.build({
  layout: 20, shape: 'castle · two islands', story: 'deepClock', stage: 'top',
  frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 2, mode: 'visibleChoice'
});

const candidates = [
  { id: 'castle-ice63-s1', keys: [47, 62], ice: { tile: 63, h: 2 }, spare: 1 },
  { id: 'castle-ice63-s2', keys: [47, 62], ice: { tile: 63, h: 2 }, spare: 2 },
  { id: 'castle-ice81-s1', keys: [47, 62], ice: { tile: 81, h: 2 }, spare: 1 },
  { id: 'castle-ice81-s2', keys: [47, 62], ice: { tile: 81, h: 2 }, spare: 2 }
];

for (const c of candidates) {
  const built = K.clockKeyIce(base.design, c.keys, c.ice, c.spare, { lockTile: 77 });
  const d = built.design;
  const pl = ys.planner(d, { spare: c.spare });
  const fam = ys.rate(d, { block: 'CURVE', allResults: true });
  const tr = T.traceGates(d, GP.traceOptions({ ys, spare: c.spare, campaigns: 40 }, profile));
  console.log(`[${c.id}] k=${built.proof.minimum} s=${c.spare} ck=${d.clock.n} => S=${pl.S} D=${fam.D.toFixed(2)} (traceD=${tr.D.toFixed(2)}) B5=${tr.B5?.value} B6=${tr.B6?.value} B7=${tr.B7?.value} tracePass=${tr.pass} fails=[${Object.keys(tr).filter(k => tr[k] && tr[k].pass === false).join(',')}]`);
}
