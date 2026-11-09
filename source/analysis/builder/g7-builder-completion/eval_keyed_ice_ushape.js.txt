'use strict';
// eval_keyed_ice_ushape.js: Measures D, S, and trace gates B1-B7 on Layout 22 with keys [0, 40] + ice tile 61/72.

const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const { createYardstick } = require('../../../tools/builder/loop/yardstick.js');

async function evaluate() {
  const ys = createYardstick();
  const profile = GP.loadProfile('e5-v1');

  const brief = {
    layout: 22,
    shape: 'ushape',
    story: 'deepClock',
    stage: 'edge',
    frame: { spare: 2 },
    targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
    seed: 1,
    mode: 'visibleChoice'
  };

  const base = VC.build(brief);
  const baseD = base.design;

  for (const iceTile of [61, 72]) {
    for (const sp of [1, 2, 3]) {
      console.log(`\n=======================================================`);
      console.log(`Evaluating Layout 22 keys [0, 40] + ice ${iceTile}, spare=${sp}`);
      console.log(`=======================================================`);

      const res = K.clockKeyIce(baseD, [0, 40], { tile: iceTile, h: 1 }, sp);
      if (res.fail) {
        console.log('clockKeyIce failed:', res.fail);
        continue;
      }

      const d = res.design;
      const pl = ys.planner(d, { spare: sp });
      const sg = GP.applyStatic(SG.staticGates(d, { gateProfile: 'e5-v1' }), profile);

      console.log(`Design: k=${res.proof.minimum}, spare=${sp}, clock.n=${d.clock.n}, staticPass=${sg.pass}, S=${pl.S}`);

      // Run traces (40 campaigns)
      const tr = T.traceGates(d, { spare: sp, ys, campaigns: 40 });
      console.log(`Traces results:`);
      console.log(`  Family D: ${tr.D}`);
      console.log(`  B1 (bites >= 0.15): pass=${tr.B1.pass}, val=${tr.B1.value}`);
      console.log(`  B2 (losses at trap >= 0.50): pass=${tr.B2.pass}, val=${tr.B2.value}`);
      console.log(`  B3 (median error share 0.15-0.60): pass=${tr.B3.pass}, val=${tr.B3.value}`);
      console.log(`  B4 (delay <= 6): pass=${tr.B4.pass}, val=${tr.B4.value}`);
      console.log(`  B5 (late tray <= 0.10): pass=${tr.B5.pass}, val=${tr.B5.value}`);
      console.log(`  B6 (post-clock <= 0.40): pass=${tr.B6.pass}, val=${tr.B6.value}`);
      console.log(`  B7 (repeatShare <= 0.50): inflated=${tr.B7.inflated}, repeatShare=${tr.B7.value}, maxTarget=${tr.B7.maxTarget}`);
      console.log(`  Overall Trace Pass: ${tr.pass}`);
    }
  }
}

evaluate().catch(console.error);
