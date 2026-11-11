'use strict';
/**
 * record_protocol_drift.js - Measures and retains full audit evidence comparing
 * standard-20-v1 (cap 20) vs extended-40-v1 (cap 40) protocols across representative boards.
 * Saves complete campaign outcomes, traces, and metrics to protocol_drift.json.
 */

const fs = require('fs');
const path = require('path');
const M = require('../factory/meter.js');
const C = require('./components.js');
const R = require('./recipes.js');
const T = require('../builder/loop/traces.js');
const GP = require('../builder/loop/gate_profile.js');
const { createYardstick } = require('./yardstick.js');
const { matchingBodyKey } = require('./plan_sequence.js');

const ANCHOR_SPECS = [
  {
    id: 'drift-10-diamond-s4',
    tier: 10,
    target: 10.0,
    layout: 30,
    shape: 'diamond',
    seed: 4,
    recipe: R.RECIPES_BY_LAYOUT[30][0], // diamond-lockBeside-d3-sp1
    spare: 1,
    desc: 'Tier 10 baseline anchor: Diamond layout 30, seed 4'
  },
  {
    id: 'drift-10-letterH-s5',
    tier: 10,
    target: 10.0,
    layout: 10,
    shape: 'letterH',
    seed: 5,
    recipe: R.RECIPES_BY_LAYOUT[10][0], // letterH-lockBeside-d4-sp2
    spare: 2,
    desc: 'Tier 10 high-skilled anchor: LetterH layout 10, seed 5'
  },
  {
    id: 'drift-13-pyramid-s4',
    tier: 13,
    target: 13.0,
    layout: 6,
    shape: 'pyramid · tall',
    seed: 4,
    recipe: R.RECIPES_BY_LAYOUT[6][0], // pyramid-lockBeside-sp2
    spare: 2,
    desc: 'Tier 13 mid-curve anchor: Pyramid layout 6, seed 4'
  },
  {
    id: 'drift-13-letterH-s5',
    tier: 13,
    target: 13.0,
    layout: 10,
    shape: 'letterH',
    seed: 5,
    recipe: { ...R.RECIPES_BY_LAYOUT[10][2], spare: 2 }, // letterH-lockBeside-d4-sp1 with spare 2
    spare: 2,
    desc: 'Tier 13 normal-band candidate: LetterH layout 10, seed 5'
  },
  {
    id: 'drift-19-letterH-s4',
    tier: 19,
    target: 19.0,
    layout: 10,
    shape: 'letterH',
    seed: 4,
    recipe: { ...R.RECIPES_BY_LAYOUT[10][3], spare: 1 }, // letterH-lockBeside-d5-sp2 with spare 1
    spare: 1,
    desc: 'Tier 19 frontier boundary candidate: LetterH layout 10, seed 4'
  }
];

async function measureDrift() {
  console.log(`[record_protocol_drift] Evaluating ${ANCHOR_SPECS.length} anchor boards under standard-20-v1 vs extended-40-v1...`);

  const ys20 = createYardstick({ protocol: 'standard-20-v1' });
  const ys40 = createYardstick({ protocol: 'extended-40-v1' });
  const profile = GP.loadProfile('e5-v1');

  const rows = [];
  const campaigns = 40;

  for (const spec of ANCHOR_SPECS) {
    console.log(`[record_protocol_drift] Measuring ${spec.id} (${spec.shape}, seed ${spec.seed})...`);

    const cand = C.composeCandidate(null, { ...spec.recipe, layout: spec.layout, shape: spec.shape, seed: spec.seed, spare: spec.spare });
    if (!cand.ok || !cand.design) {
      console.error(`  -> Failed to compose ${spec.id}: ${cand.fail}`);
      continue;
    }

    const design = cand.design;
    const bKey = M.boardKey(design);
    const mKey = matchingBodyKey(design);

    // Rate under standard-20-v1
    const pl20 = ys20.planner(design, { spare: spec.spare });
    const fam20 = ys20.rate(design, { block: 'CURVE', campaigns, allResults: true });
    const trace20 = T.traceGates(design, GP.traceOptions({
      ys: ys20,
      spare: spec.spare,
      campaigns,
      cap: 20,
      maxAttempts: 20,
      protocol: 'standard-20-v1'
    }, profile));

    // Rate under extended-40-v1
    const pl40 = ys40.planner(design, { spare: spec.spare });
    const fam40 = ys40.rate(design, { block: 'CURVE', campaigns, allResults: true });
    const trace40 = T.traceGates(design, GP.traceOptions({
      ys: ys40,
      spare: spec.spare,
      campaigns,
      cap: 40,
      maxAttempts: 40,
      protocol: 'extended-40-v1'
    }, profile));

    const deltaD = fam40.D - fam20.D;
    console.log(`  -> Standard-20: D=${fam20.D.toFixed(3)}, S=${pl20.S.toFixed(2)}, tracePass=${trace20.pass}`);
    console.log(`  -> Extended-40: D=${fam40.D.toFixed(3)}, S=${pl40.S.toFixed(2)}, tracePass=${trace40.pass}`);
    console.log(`  -> Drift deltaD: ${deltaD >= 0 ? '+' : ''}${deltaD.toFixed(3)}`);

    rows.push({
      id: spec.id,
      tier: spec.tier,
      target: spec.target,
      layout: spec.layout,
      shape: spec.shape,
      seed: spec.seed,
      spare: spec.spare,
      desc: spec.desc,
      boardKey: bKey,
      matchingBodyKey: mKey,
      tilesCount: design.tiles.length,
      clock: design.clock,
      standard20: {
        protocol: 'standard-20-v1',
        cap: 20,
        D: fam20.D,
        se: fam20.se,
        pHat: fam20.pHat,
        n: fam20.n,
        lossPhase: fam20.lossPhase,
        S: pl20.S,
        styles: pl20.styles,
        tracePass: trace20.pass === true,
        traces: Object.fromEntries(['B1','B2','B3','B4','B5','B6','B7'].map(k => [k, trace20[k]])),
        failedTraces: profile.traces.required.filter(k => trace20[k]?.pass !== true)
      },
      extended40: {
        protocol: 'extended-40-v1',
        cap: 40,
        D: fam40.D,
        se: fam40.se,
        pHat: fam40.pHat,
        n: fam40.n,
        lossPhase: fam40.lossPhase,
        S: pl40.S,
        styles: pl40.styles,
        tracePass: trace40.pass === true,
        traces: Object.fromEntries(['B1','B2','B3','B4','B5','B6','B7'].map(k => [k, trace40[k]])),
        failedTraces: profile.traces.required.filter(k => trace40[k]?.pass !== true)
      },
      drift: {
        deltaD,
        driftPercent: (deltaD / fam20.D) * 100,
        tracePassIdentical: (trace20.pass === true) === (trace40.pass === true)
      }
    });
  }

  const outData = {
    schema: 'g13-protocol-drift-v1',
    timestamp: new Date().toISOString(),
    campaigns,
    boardsCount: rows.length,
    boards: rows
  };

  const outDir = path.resolve(__dirname, '../../analysis/builder-next/g13');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'protocol_drift.json');
  fs.writeFileSync(outFile, JSON.stringify(outData, null, 2) + '\n');
  console.log(`[record_protocol_drift] Full protocol audit evidence saved to ${outFile}`);
  return outData;
}

if (require.main === module) {
  measureDrift().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { measureDrift, ANCHOR_SPECS };
