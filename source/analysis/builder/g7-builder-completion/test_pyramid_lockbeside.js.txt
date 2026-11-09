'use strict';
// test_pyramid_lockbeside.js: Tests building lockBeside with tailPairWidth: 2 on Layout 6 (pyramid · tall).

const VC = require('../../../tools/builder/visible_choice.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const { createYardstick } = require('../../../tools/builder/loop/yardstick.js');

const ys = createYardstick();
const profile = GP.loadProfile('e5-v1');

console.log('Testing Layout 6 (pyramid · tall, 84t) with lockBeside and tailPairWidth: 2...');

for (let seed = 1; seed <= 5; seed++) {
  const brief = {
    layout: 6,
    shape: 'pyramid · tall',
    story: 'lockBeside',
    frame: { spare: 2 },
    targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
    seed,
    mode: 'visibleChoice'
  };

  const res = VC.build(brief, { tries: 10 });
  if (res.design) {
    const d = res.design;
    const sg = GP.applyStatic(SG.staticGates(d, { gateProfile: 'e5-v1' }), profile);
    const pl = ys.planner(d, { spare: 2 });
    console.log(`Seed ${seed}: BUILT! k=${res.card.clock.fewestMoves}, spare=2, staticPass=${sg.pass}, S=${pl.S}`);
    if (sg.pass && pl.S >= 2.0 && pl.S <= 6.0) {
      const tr = T.traceGates(d, { spare: 2, ys, campaigns: 40 });
      console.log(`  -> Family D=${tr.D}, B7 repeatShare=${tr.B7.value}, B7inflated=${tr.B7.inflated}, tracePass=${tr.pass}`);
    }
  } else {
    console.log(`Seed ${seed}: Build failed (${res.fail})`);
  }
}
