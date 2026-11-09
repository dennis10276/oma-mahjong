'use strict';
// probe_wing_candidates.js
// Evaluates clean wing candidates on Layout 22 (U-shape)
const VC = require('../../tools/builder/visible_choice.js');
const K = require('../../tools/builder/knobs.js');
const GP = require('../../tools/builder/loop/gate_profile.js');
const T = require('../../tools/builder/loop/traces.js');
const Y = require('../../tools/builder/loop/yardstick.js');
const SG = require('../../tools/builder/loop/static_gates.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

const base = VC.build({
  layout: 22, shape: 'ushape', story: 'deepClock', stage: 'edge',
  frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 1, mode: 'visibleChoice'
});

const candidates = [
  // Wing key pairs and clean wing ice tiles (z=1)
  { id: 'u-12-16-ice51-s1', keys: [12, 16], ice: { tile: 51, h: 2 }, spare: 1 },
  { id: 'u-12-16-ice51-s2', keys: [12, 16], ice: { tile: 51, h: 2 }, spare: 2 },
  { id: 'u-13-17-ice51-s1', keys: [13, 17], ice: { tile: 51, h: 2 }, spare: 1 },
  { id: 'u-13-17-ice51-s2', keys: [13, 17], ice: { tile: 51, h: 2 }, spare: 2 },
  { id: 'u-12-16-ice44-s1', keys: [12, 16], ice: { tile: 44, h: 2 }, spare: 1 },
  { id: 'u-13-17-ice44-s1', keys: [13, 17], ice: { tile: 44, h: 2 }, spare: 1 },
  { id: 'u-0-40-ice42-s1', keys: [0, 40], ice: { tile: 42, h: 2 }, spare: 1 }
];

console.log(`Evaluating ${candidates.length} clean wing candidates on U-shape...`);

for (const c of candidates) {
  const t0 = Date.now();
  const built = K.clockKeyIce(base.design, c.keys, c.ice, c.spare);
  if (built.fail) {
    console.log(`[${c.id}] build failed: ${built.fail}`);
    continue;
  }
  const d = built.design;
  const sg = GP.applyStatic(SG.staticGates(d, { shape: 'ushape', stopEarly: false }), profile);
  const pl = ys.planner(d, { spare: c.spare });
  const fam = ys.rate(d, { block: 'CURVE', allResults: true });
  const tr = T.traceGates(d, GP.traceOptions({ ys, spare: c.spare, campaigns: 40 }, profile));
  
  const fails = Object.keys(tr).filter(k => tr[k] && tr[k].pass === false);
  console.log(`[${c.id}] k=${built.proof.minimum} s=${c.spare} ck=${d.clock.n} => S=${pl.S} D=${fam.D.toFixed(2)} (traceD=${tr.D.toFixed(2)}) B5=${tr.B5?.value} B6=${tr.B6?.value} B7=${tr.B7?.value} static=${sg.pass} tracePass=${tr.pass} fails=[${fails.join(',')}] (${Date.now() - t0}ms)`);
}
