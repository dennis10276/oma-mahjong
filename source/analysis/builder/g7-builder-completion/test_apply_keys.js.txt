'use strict';
// test_apply_keys.js: Tests applying knobs.clockKeys to skilled layouts (22, 0, 44)
// to raise family difficulty into Dennis's target 10-13 band while preserving S in [2.5, 6.0]
// and passing static gates and trace gates (repeatShare <= 0.50).

const fs = require('fs');
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const { createYardstick } = require('../../../tools/builder/loop/yardstick.js');
const { tileVisibility } = require('../../../tools/sim/refit/human_board_visibility.js');
const L = require('../../../www/layouts.js');

function testKeysOnLayout(layoutIdx, shape, spare = 2, seed = 1) {
  console.log(`\n=======================================================`);
  console.log(`Testing Layout ${layoutIdx} (${shape}), spare=${spare}, seed=${seed}`);
  console.log(`=======================================================`);

  const brief = {
    layout: layoutIdx,
    shape,
    story: 'deepClock',
    stage: 'edge',
    frame: { spare },
    targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
    seed,
    mode: 'visibleChoice'
  };

  const base = VC.build(brief);
  if (!base.design) {
    console.log('VC.build failed:', base.fail);
    return null;
  }

  const baseD = base.design;
  const ys = createYardstick();
  const profile = GP.loadProfile('e5-v1');

  const basePl = ys.planner(baseD, { spare });
  console.log(`Base board: k=${base.card.clock.fewestMoves}, spare=${spare}, S=${basePl.S}`);

  // Find visible key pairs
  const n = baseD.tiles.length;
  const objects = baseD.tiles.map(([x, y, z]) => ({ x, y, z }));
  const vis = tileVisibility(objects, {
    alive: new Uint8Array(n).fill(1),
    down: new Uint8Array(n),
    openPeek: -1
  }, baseD.clock).tiles;

  // Find pairs of tiles that have the same face, only 2 copies, and both visible at move 0
  const faceCounts = {};
  for (let i = 0; i < n; i++) {
    faceCounts[baseD.faces[i]] = (faceCounts[baseD.faces[i]] || 0) + 1;
  }

  const candidateKeyPairs = [];
  for (let i = 0; i < n; i++) {
    if (i === baseD.clock.i) continue;
    if (!vis[i].role && !vis[i].picture) continue;
    if (faceCounts[baseD.faces[i]] !== 2) continue;
    for (let j = i + 1; j < n; j++) {
      if (j === baseD.clock.i) continue;
      if (!vis[j].role && !vis[j].picture) continue;
      if (baseD.faces[i] === baseD.faces[j]) {
        candidateKeyPairs.push([i, j]);
      }
    }
  }

  console.log(`Found ${candidateKeyPairs.length} candidate visible key pairs`);

  const validKeyedBoards = [];
  for (const [k1, k2] of candidateKeyPairs) {
    // Try clockKeys
    const res = K.clockKeys(baseD, [k1, k2], spare);
    if (!res.fail && res.design) {
      const kd = res.design;
      const sg = GP.applyStatic(SG.staticGates(kd, { gateProfile: 'e5-v1' }), profile);
      if (sg.pass) {
        const pl = ys.planner(kd, { spare });
        console.log(`Key pair [${k1}, ${k2}]: origK=${res.proof.originalMinimum} -> newK=${res.proof.minimum}, staticPass=true, S=${pl.S}`);
        validKeyedBoards.push({
          k1, k2,
          minimum: res.proof.minimum,
          S: pl.S,
          design: kd
        });
        if (validKeyedBoards.length >= 3) break;
      }
    }
  }

  console.log(`Total valid keyed boards passing static gates: ${validKeyedBoards.length}`);
  return validKeyedBoards;
}

const layouts = [
  { idx: 22, shape: 'ushape' },
  { idx: 0, shape: 'arch' },
  { idx: 44, shape: 'hourglass' }
];

for (const lay of layouts) {
  testKeysOnLayout(lay.idx, lay.shape, 2, 1);
}
