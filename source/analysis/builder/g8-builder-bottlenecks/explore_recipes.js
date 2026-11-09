'use strict';
// explore_recipes.js
// Searches for key pairs and clean thaw candidates on Layouts 17, 24, 26
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const Y = require('../../../tools/builder/loop/yardstick.js');
const ys = Y.createYardstick();

const layouts = [
  { id: 17, shape: 'bowtie', stage: 'edge', seed: 1 },
  { id: 24, shape: 'twins', stage: 'edge', seed: 1 },
  { id: 26, shape: 'letterH', stage: 'edge', seed: 1 }
];

for (const l of layouts) {
  const base = VC.build({
    layout: l.id, shape: l.shape, story: 'deepClock', stage: l.stage,
    frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
    seed: l.seed, mode: 'visibleChoice'
  });
  if (!base.design) {
    console.log(`Layout ${l.id} (${l.shape}): base failed (${base.fail})`);
    continue;
  }
  const n = base.design.tiles.length;
  const clockI = base.design.clock.i;
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const res = K.clockKeys(base.design, [i, j], 1);
      if (!res.fail && res.proof && res.proof.minimum >= 10) {
        pairs.push({ keys: [i, j], k: res.proof.minimum });
      }
    }
  }
  console.log(`Layout ${l.id} (${l.shape}, clock=${clockI}, baseK=${base.card.clock.fewestMoves}): found ${pairs.length} key pairs with k >= 10`);
  pairs.sort((a, b) => b.k - a.k);
  for (const p of pairs.slice(0, 5)) {
    const keyed = K.clockKeys(base.design, p.keys, 1);
    const pl = ys.planner(keyed.design);
    const fam = ys.rate(keyed.design, { block: 'CURVE' });
    console.log(`  keys: [${p.keys}], k=${p.k}, S=${pl.S}, D=${fam.D}`);
  }
}
