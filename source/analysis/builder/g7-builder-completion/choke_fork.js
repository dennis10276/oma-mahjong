'use strict';
// choke_fork.js: Explicit constructor control for delayed-choke forks (depth 3-5).
// Creates a visible false-relief trap with prompt consequence that passes Gate A6
// and challenges the skilled bot (which has lookDepth: 2).

const E = require('../../../tools/builder/engine.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const Pk = require('../../../tools/builder/loop/publicfork.js');
const { tileVisibility } = require('../../../tools/sim/refit/human_board_visibility.js');

function analyzeFork(design, forkStep, tl, r1, r2, options = {}) {
  const g = E.game(design);
  const sol = design.solution;
  if (!sol || forkStep >= sol.length) return { fail: 'invalidForkStep' };

  // Replay to forkStep
  let s = E.start(g);
  for (let i = 0; i < forkStep; i++) {
    s = E.step(g, s, sol[i]);
    if (!s) return { fail: 'prefixFailed', step: i };
  }

  const tw = sol[forkStep];
  const legal = E.legal(g, s);
  if (!legal.includes(tl)) return { fail: 'tlNotLegal' };
  if (!legal.includes(tw)) return { fail: 'twNotLegal' };

  // Test winning continuation
  const sw = E.step(g, s, tw);
  if (!sw) return { fail: 'twLosesInstantly' };
  const budget = { nodes: options.nodes ?? 200000, ms: Infinity };
  const winProof = E.winnable(g, sw, budget);
  if (winProof.result !== 'win') return { fail: 'twNotWinning', result: winProof.result };

  // Test losing continuation
  const sl = E.step(g, s, tl);
  if (!sl) return { fail: 'tlLosesInstantly' };
  const loseProof = E.winnable(g, sl, budget);
  if (loseProof.result !== 'lose') return { fail: 'tlNotLosing', result: loseProof.result };

  // Check depth of loss
  const depth = E.longest(g, sl, options.cap ?? 10, options.depthNodes ?? 50000);

  // Check Gate A6 fair fork
  const C = D.clockGames(design);
  const fair = Pk.fairFork(C, s, tl, {
    nShipMax: design.clock.n,
    unseen: [],
    w: D.work(options.nodes ?? 200000),
    forcedWithin: 6
  });

  return {
    ok: true,
    forkStep,
    tw,
    tl,
    trayBefore: s.tray.map(t => g.faces[t]),
    depth: depth.depth,
    depthExact: depth.exact,
    fair: fair.fair,
    fairWhy: fair.why,
    loseProof: loseProof.result,
    winProof: winProof.result
  };
}

module.exports = { analyzeFork };
