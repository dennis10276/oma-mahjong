'use strict';
// probe_stories.js: Tests building different stories with tailPairWidth: 2 across layouts
// to see which combinations produce D in [9, 13], S in [2.5, 6.0], and pass static/trace gates.

const VC = require('../../../tools/builder/visible_choice.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const { createYardstick } = require('../../../tools/builder/loop/yardstick.js');
const B = require('../../../tools/builder/builder.js');

const ys = createYardstick();
const profile = GP.loadProfile('e5-v1');

const stories = ['lockBeside', 'deepClock', 'roomInTrayLocked', 'iceLockClock'];
const testLayouts = [
  { idx: 22, shape: 'ushape' },
  { idx: 0, shape: 'arch' },
  { idx: 44, shape: 'hourglass' },
  { idx: 34, shape: 'bowtie' },
  { idx: 40, shape: 'vase' }
];

console.log('Testing stories with tailPairWidth: 2...');

for (const lay of testLayouts) {
  for (const story of stories) {
    for (const spare of [1, 2, 3]) {
      const brief = {
        layout: lay.idx,
        shape: lay.shape,
        story,
        frame: { spare },
        targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
        seed: 1,
        mode: 'visibleChoice'
      };

      const res = VC.build(brief, { tries: 10 });
      if (res.design) {
        const d = res.design;
        const sg = GP.applyStatic(SG.staticGates(d, { gateProfile: 'e5-v1' }), profile);
        if (sg.pass) {
          const pl = ys.planner(d, { spare });
          console.log(`PASS: Layout ${lay.idx} (${lay.shape}) story=${story} spare=${spare}: k=${res.card.clock.fewestMoves}, S=${pl.S}`);
          if (pl.S >= 2.5 && pl.S <= 6.0) {
            // Measure family D with 40 campaigns
            const tr = T.traceGates(d, { spare, ys, campaigns: 40 });
            console.log(`  -> Family D=${tr.D}, repeatShare=${tr.B7.value}, B7inflated=${tr.B7.inflated}, tracePass=${tr.pass}`);
          }
        }
      }
    }
  }
}
