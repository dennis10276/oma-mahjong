'use strict';
// experiment_choke_distance.js: Tests causal chokeDistance control.
// Compares chokeDistance 1 (baseline) vs 2, 3, 4 across multiple layouts.
// Measures physical board changes, consequence depth, Gate A6, skilled S, and family D.

const fs = require('fs'), path = require('path');
const E = require('../../../tools/builder/engine.js');
const B = require('../../../tools/builder/builder.js');
const L = require('../../../www/layouts.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const { createYardstick, loadPins } = require('../../../tools/builder/loop/yardstick.js');
const VC = require('../../../tools/builder/visible_choice.js');

function buildWithChokeDistance(briefIn) {
  const brief = { ...briefIn };
  const chokeDistance = brief.targets?.chokeDistance ?? 1;

  // Build base with visibleChoice
  const base = VC.build(brief);
  if (base.fail) return base;

  if (chokeDistance === 1) {
    return base; // baseline unaltered
  }

  const d = JSON.parse(JSON.stringify(base.design));
  const traps = base.card.traps || [];
  if (!traps.length) return { fail: 'noTrapsFound' };

  // For each trap [x, y], move y down in d.solution by (chokeDistance - 1)
  const sol = d.solution.slice();
  const modified = [];

  for (const [x, y] of traps) {
    const px = sol.indexOf(x);
    const py = sol.indexOf(y);
    if (px >= 0 && py >= 0 && py === px + 1) {
      const targetPy = Math.min(sol.length - 1, px + chokeDistance);
      // Check if moving y to targetPy preserves legality of the witness
      const testSol = sol.slice();
      testSol.splice(py, 1);
      testSol.splice(targetPy, 0, y);

      const rep = E.replay(d, testSol, { strict: true });
      if (rep.ok) {
        sol.splice(py, 1);
        sol.splice(targetPy, 0, y);
        modified.push({ x, y, px, oldPy: py, newPy: targetPy });
      }
    }
  }

  if (!modified.length) return { fail: 'chokeDistanceNotAdmissible' };

  d.solution = sol;
  return {
    ...base,
    design: d,
    card: {
      ...base.card,
      chokeDistance,
      modifiedTraps: modified
    }
  };
}

function runExperiment() {
  const ys = createYardstick();
  const profile = GP.loadProfile('e5-v1');
  const results = [];

  const layouts = [
    { idx: 22, shape: 'ushape' },
    { idx: 8, shape: 'cross' },
    { idx: 0, shape: 'arch' },
    { idx: 25, shape: 'frame' }
  ];

  for (const lay of layouts) {
    for (const dist of [1, 2, 3, 4]) {
      const brief = {
        layout: lay.idx,
        shape: lay.shape,
        story: 'deepClock',
        stage: 'edge',
        frame: { spare: 2 },
        targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2, chokeDistance: dist },
        seed: 1,
        mode: 'visibleChoice'
      };

      const res = buildWithChokeDistance(brief);
      if (res.fail) {
        console.log(`Layout ${lay.idx} dist=${dist}: FAIL (${res.fail})`);
        results.push({ layout: lay.idx, shape: lay.shape, dist, fail: res.fail });
        continue;
      }

      const d = res.design;
      const gates = GP.applyStatic(SG.staticGates(d, { gateProfile: 'e5-v1' }), profile);
      
      // Measure skilled S
      const pl = ys.planner(d, { spare: 2 });
      console.log(`Layout ${lay.idx} (${lay.shape}) dist=${dist}: staticPass=${gates.pass} S=${pl.S} valid=${pl.valid}`);
      results.push({
        layout: lay.idx,
        shape: lay.shape,
        dist,
        staticPass: gates.pass,
        k: gates.k,
        S: pl.S,
        plValid: pl.valid,
        modified: res.card.modifiedTraps
      });
    }
  }

  fs.writeFileSync('source/analysis/builder/g7-builder-completion/experiment_results.json', JSON.stringify(results, null, 2));
}

if (require.main === module) runExperiment();
