'use strict';
// discovery_sweep.js — Runs the frozen G6 discovery schedule (40 boards)
const fs = require('fs'), path = require('path');
const PB = require('../../../tools/builder/puzzle_balance.js');
const E = require('../../../tools/builder/engine.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const Y = require('../../../tools/builder/loop/yardstick.js');
const T = require('../../../tools/builder/loop/traces.js');
const M = require('../../../tools/factory/meter.js');

const ys = Y.createYardstick({ cacheDir: path.resolve('source/build/factory-cache') });
const profile = GP.loadProfile('e5-v1');

const SCHEDULE = [];

// Family 1: stagedTrayCommitment (12 boards)
for (const layout of [33, 45]) {
  for (const commitment of [0, 1, 2]) {
    for (const seed of [1, 2]) {
      SCHEDULE.push({
        family: 'stagedTrayCommitment',
        layout,
        targets: { commitment },
        frame: { spare: 2 },
        seed
      });
    }
  }
}

// Family 2: promptChokeDistance (16 boards)
for (const layout of [33, 45]) {
  for (const chokeDelay of [1, 3, 5, 8]) {
    for (const seed of [1, 2]) {
      SCHEDULE.push({
        family: 'promptChokeDistance',
        layout,
        targets: { chokeDelay },
        frame: { spare: 2 },
        seed
      });
    }
  }
}

// Family 3: distributedStages (12 boards)
for (const layout of [33, 45]) {
  for (const stages of [1, 2, 3]) {
    for (const seed of [1, 2]) {
      SCHEDULE.push({
        family: 'distributedStages',
        layout,
        targets: { stages },
        frame: { spare: 2 },
        seed
      });
    }
  }
}

console.log(`Frozen Discovery Schedule: ${SCHEDULE.length} boards`);

function runDiscovery() {
  const t0 = Date.now();
  const rows = [];
  let boardIdx = 0;

  for (const item of SCHEDULE) {
    boardIdx++;
    const tItem = Date.now();
    const brief = {
      mode: 'puzzleBalance',
      family: item.family,
      layout: item.layout,
      frame: item.frame,
      targets: item.targets,
      seed: item.seed
    };

    const b = PB.build(brief);
    if (!b.design) {
      console.log(`[${boardIdx}/${SCHEDULE.length}] ${item.family} L${item.layout} seed${item.seed}: BUILD FAIL ${b.fail}`);
      rows.push({ brief, classification: 'build_failure', fail: b.fail, ms: Date.now() - tItem });
      continue;
    }

    // Static gates
    const sg = SG.staticGates(b.design, { stopEarly: false });
    const staticRes = GP.applyStatic(sg, profile);
    const unresolved = GP.unresolvedStatic(staticRes, profile, { spare: item.frame.spare });
    const failedRequired = profile.static.required.filter(g => staticRes.gates[g]?.pass === false);

    // Ratings
    const sRate = ys.planner(b.design, { spare: item.frame.spare });
    const dRate = ys.rate(b.design, { block: 'CURVE' });

    // Classification
    let classification = 'survivor';
    if (unresolved.length > 0) classification = 'unresolved_proof';
    else if (failedRequired.length > 0) classification = 'quality_failure';
    else if (sRate.S == null || sRate.S < 2.5 || sRate.S > 6.0) classification = 'off_band_diagnostic';

    const entry = {
      index: boardIdx,
      family: item.family,
      layout: item.layout,
      shape: b.card.shape,
      tiles: b.card.tiles,
      targets: item.targets,
      spare: item.frame.spare,
      seed: item.seed,
      clockK: b.card.clock.fewestMoves,
      staticPass: staticRes.pass,
      failedRequired,
      a6Pass: staticRes.gates.A6.pass,
      a6Detail: {
        loseForks: staticRes.gates.A6.detail?.loseForks,
        fair: staticRes.gates.A6.detail?.fair,
        unfair: staticRes.gates.A6.detail?.unfair
      },
      S: sRate.S,
      styles: sRate.styles,
      D: dRate.D,
      dSe: dRate.se,
      dUncleared: dRate.uncleared,
      classification,
      ms: Date.now() - tItem
    };

    rows.push(entry);
    console.log(`[${boardIdx}/${SCHEDULE.length}] ${item.family} L${item.layout} ${JSON.stringify(item.targets)} seed${item.seed} -> D=${entry.D?.toFixed(2)}, S=${entry.S?.toFixed(2)}, A6=${entry.a6Pass}, class=${classification} (${entry.ms}ms)`);
  }

  const outPath = 'source/analysis/builder/g6-puzzle-balance/discovery_results.json';
  fs.writeFileSync(outPath, JSON.stringify({
    schema: 'g6-discovery-v1',
    date: new Date().toISOString(),
    totalBoards: rows.length,
    survivors: rows.filter(r => r.classification === 'survivor').length,
    offBand: rows.filter(r => r.classification === 'off_band_diagnostic').length,
    qualityFailures: rows.filter(r => r.classification === 'quality_failure').length,
    buildFailures: rows.filter(r => r.classification === 'build_failure').length,
    totalMs: Date.now() - t0,
    rows
  }, null, 2) + '\n');

  console.log(`\nDiscovery completed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`Survivors: ${rows.filter(r => r.classification === 'survivor').length}/${rows.length}`);
  console.log(`Off-band diagnostics: ${rows.filter(r => r.classification === 'off_band_diagnostic').length}/${rows.length}`);
  console.log(`Quality failures: ${rows.filter(r => r.classification === 'quality_failure').length}/${rows.length}`);
  console.log(`Results saved to ${outPath}`);
}

runDiscovery();
