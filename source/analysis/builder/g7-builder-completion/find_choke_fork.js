'use strict';
// find_choke_fork.js: Searches for valid false-relief delayed choke rewirings on catalogue designs.
const E = require('../../../tools/builder/engine.js');
const B = require('../../../tools/builder/builder.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const Pk = require('../../../tools/builder/loop/publicfork.js');
const VC = require('../../../tools/builder/visible_choice.js');

function testChokeOnLayout(layoutIndex, shape, seed = 1) {
  console.log(`\n=== Testing Layout ${layoutIndex} (${shape}) ===`);
  
  // Build a base board using visibleChoice (width 1 baseline)
  const base = VC.build({
    layout: layoutIndex,
    shape,
    story: 'deepClock',
    stage: 'edge',
    frame: { spare: 2 },
    targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
    seed,
    mode: 'visibleChoice'
  });

  if (base.fail) {
    console.log('Base build failed:', base.fail);
    return null;
  }

  const d = base.design;
  const g = E.game(d);
  console.log(`Base board built: ${d.tiles.length} tiles, clock k=${base.card.clock.fewestMoves}, spare=${base.card.clock.spare}`);

  // Trace the witness to find candidate fork states
  let s = E.start(g);
  const candidates = [];
  
  for (let step = 0; step < d.solution.length; step++) {
    const tw = d.solution[step];
    const legal = E.legal(g, s);
    
    // We want states where tray has 1 or 2 tiles, and multiple legal choices
    if (s.tray.length >= 1 && s.tray.length <= 2 && legal.length >= 3) {
      for (const tl of legal) {
        if (tl !== tw) {
          // Check if taking tl loses
          const sl = E.step(g, s, tl);
          if (sl) {
            const long = E.longest(g, sl, 10, 20000);
            const winProof = E.winnable(g, sl, { nodes: 20000 });
            candidates.push({
              step,
              moves: s.moves,
              trayLen: s.tray.length,
              tw,
              tl,
              winResult: winProof.result,
              depth: long.depth
            });
          }
        }
      }
    }
    s = E.step(g, s, tw);
    if (!s) break;
  }

  console.log(`Examined states: found ${candidates.length} fork candidates`);
  const depth34 = candidates.filter(c => c.winResult === 'lose' && c.depth >= 3 && c.depth <= 5);
  console.log(`Candidates with winResult === 'lose' and depth in [3, 5]: ${depth34.length}`);
  
  if (depth34.length > 0) {
    console.log('Sample depth 3-5 candidate:', depth34[0]);
    // Check Gate A6 on this candidate
    const cand = depth34[0];
    let sFork = E.start(g);
    for (let i = 0; i < cand.step; i++) sFork = E.step(g, sFork, d.solution[i]);
    const C = D.clockGames(d);
    const fair = Pk.fairFork(C, sFork, cand.tl, {
      nShipMax: d.clock.n,
      unseen: [],
      w: D.work(200000),
      forcedWithin: 6
    });
    console.log('Gate A6 fair fork result:', { fair: fair.fair, why: fair.why, checks: fair.checks });
  } else {
    // Show distribution of depths
    const dist = {};
    for (const c of candidates) {
      const key = `${c.winResult}_depth${c.depth}`;
      dist[key] = (dist[key] || 0) + 1;
    }
    console.log('Candidate depth distribution:', dist);
  }

  return { layoutIndex, totalCandidates: candidates.length, depth34: depth34.length };
}

for (const [idx, shape] of [[22, 'ushape'], [8, 'cross'], [0, 'arch'], [25, 'frame']]) {
  testChokeOnLayout(idx, shape, 1);
}
