'use strict';
// sweep_skilled_candidates.js: Sweeps layouts, stages, and seeds to find all boards
// with skilled S in [2.5, 6.0], k in [6, 16], that pass static gates.

const VC = require('../../../tools/builder/visible_choice.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const { createYardstick } = require('../../../tools/builder/loop/yardstick.js');
const B = require('../../../tools/builder/builder.js');

const ys = createYardstick();
const profile = GP.loadProfile('e5-v1');

const stages = ['edge', 'centre', 'top', null];
const stories = ['deepClock', 'lockBeside'];
const candidates = [];

console.log('Sweeping for skilled S in [2.5, 6.0]...');

for (let layIdx = 0; layIdx < B.LAYOUTS.length; layIdx++) {
  const lay = B.LAYOUTS[layIdx];
  if (!lay || lay.tiles.length < 72 || lay.tiles.length > 88) continue;

  for (const story of stories) {
    for (const stage of stages) {
      for (const seed of [1, 2]) {
        for (const spare of [2]) {
          const brief = {
            layout: layIdx,
            shape: lay.shape,
            story,
            stage: stage || undefined,
            frame: { spare },
            targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
            seed,
            mode: 'visibleChoice'
          };

          const res = VC.build(brief, { tries: 5 });
          if (res.design) {
            const d = res.design;
            const sg = GP.applyStatic(SG.staticGates(d, { gateProfile: 'e5-v1' }), profile);
            if (sg.pass) {
              const pl = ys.planner(d, { spare });
              if (pl.S >= 2.5 && pl.S <= 6.0) {
                console.log(`FOUND CANDIDATE: Layout ${layIdx} (${lay.shape}, ${lay.tiles.length}t) story=${story} stage=${stage || 'none'} seed=${seed} spare=${spare}: k=${res.card.clock.fewestMoves}, S=${pl.S}`);
                candidates.push({
                  layout: layIdx,
                  shape: lay.shape,
                  tiles: lay.tiles.length,
                  story,
                  stage,
                  seed,
                  spare,
                  k: res.card.clock.fewestMoves,
                  S: pl.S,
                  design: d
                });
              }
            }
          }
        }
      }
    }
  }
}

console.log(`Sweep completed: found ${candidates.length} candidates in normal skilled band!`);
const fs = require('fs');
fs.writeFileSync('source/analysis/builder/g7-builder-completion/skilled_candidates.json', JSON.stringify(candidates.map(c => ({
  layout: c.layout, shape: c.shape, tiles: c.tiles, story: c.story, stage: c.stage, seed: c.seed, spare: c.spare, k: c.k, S: c.S
})), null, 2));
