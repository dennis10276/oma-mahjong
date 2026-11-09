'use strict';
// diagnose_arch_keys.js: Diagnoses why candidate key pairs failed on Layout 0 (arch).

const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const { tileVisibility } = require('../../../tools/sim/refit/human_board_visibility.js');

const brief = {
  layout: 0,
  shape: 'arch',
  story: 'deepClock',
  stage: 'edge',
  frame: { spare: 2 },
  targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 1,
  mode: 'visibleChoice'
};

const base = VC.build(brief);
if (!base.design) {
  console.log('VC.build failed:', base.fail);
  process.exit(1);
}

const d = base.design;
const n = d.tiles.length;
const objects = d.tiles.map(([x, y, z]) => ({ x, y, z }));
const vis = tileVisibility(objects, {
  alive: new Uint8Array(n).fill(1),
  down: new Uint8Array(n),
  openPeek: -1
}, d.clock).tiles;

console.log(`Base arch board: clock=${d.clock.i}, k=${base.card.clock.fewestMoves}, spare=${base.card.clock.spare}`);

const faceCounts = {};
for (let i = 0; i < n; i++) faceCounts[d.faces[i]] = (faceCounts[d.faces[i]] || 0) + 1;

for (let i = 0; i < n; i++) {
  if (i === d.clock.i || (!vis[i].role && !vis[i].picture) || faceCounts[d.faces[i]] !== 2) continue;
  for (let j = i + 1; j < n; j++) {
    if (j === d.clock.i || (!vis[j].role && !vis[j].picture) || d.faces[i] !== d.faces[j]) continue;
    const res = K.clockKeys(d, [i, j], 2);
    if (res.fail) {
      console.log(`Key pair [${i}, ${j}]: FAIL ${res.fail}`);
    } else {
      console.log(`Key pair [${i}, ${j}]: SUCCESS! newK=${res.proof.minimum}`);
      const sg = GP.applyStatic(SG.staticGates(res.design, { gateProfile: 'e5-v1' }), GP.loadProfile('e5-v1'));
      console.log(`  Static gates pass: ${sg.pass}, failed: ${Object.keys(sg.gates).filter(g => sg.gates[g].pass === false).join(',')}`);
    }
  }
}
