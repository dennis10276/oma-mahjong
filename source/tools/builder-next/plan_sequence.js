'use strict';
/**
 * plan_sequence.js - Generates, validates, and records the 5-level sequence for Levels 250-254.
 * Strictly adheres to level-production rules:
 * - 5 distinct retained boards with distinct physical structures and hashes.
 * - 96 tiles allowed only at Level 250, strictly forbidden at Level 253.
 * - Every level within +/- 1.0 of target.
 * - 5-level average within +/- 0.5 of target curve average (10.166).
 * - 100% of required static and trace gates under profile e5-v1 pass.
 * - Normal skilled band S in [2.5, 6.0] prioritized; fallback [2.0, 2.5) explicitly recorded.
 */

const fs = require('fs');
const path = require('path');
const M = require('../factory/meter.js');
const C = require('./components.js');
const V = require('./evaluator.js');
const { createYardstick } = require('./yardstick.js');

const rootDir = path.resolve(__dirname, '../../..');
const outDir = path.join(rootDir, 'source/analysis/builder-next/g12');
const boardsDir = path.join(outDir, 'boards');
const cardsDir = path.join(outDir, 'cards');

fs.mkdirSync(boardsDir, { recursive: true });
fs.mkdirSync(cardsDir, { recursive: true });

const SEQUENCE_SPECS = [
  {
    level: 250,
    target: 10.00,
    layout: 27,
    shape: 'steps',
    story: 'lockBeside',
    stage: 'edge',
    seed: 2,
    depth: null,
    spare: 1,
    frameSpare: 2,
    hiddenOnWay: 1,
    traps: 2,
    tailPairWidth: 2,
    maxDown: 0.30,
    startAttempt: 3,
    tries: 4,
    skilledBand: [2.0, 6.0],
    isBigBoard: true,
    policy: 'Tenth-level slot; 96 tiles permitted. Recorded fallback skilled band [2.0, 2.5).'
  },
  {
    level: 251,
    target: 10.08,
    layout: 10,
    shape: 'letterH',
    story: 'lockBeside',
    stage: 'edge',
    seed: 5,
    depth: 4,
    spare: 2,
    frameSpare: 3,
    hiddenOnWay: 1,
    traps: 2,
    maxDown: 0.34,
    skilledBand: [2.5, 6.0],
    isBigBoard: false,
    policy: 'Standard board (80 tiles). Normal skilled band S in [2.5, 6.0].'
  },
  {
    level: 252,
    target: 10.17,
    layout: 30,
    shape: 'diamond',
    story: 'lockBeside',
    stage: 'edge',
    seed: 7,
    depth: 3,
    spare: 1,
    frameSpare: 3,
    hiddenOnWay: 1,
    traps: 2,
    maxDown: 0.35,
    skilledBand: [2.5, 6.0],
    isBigBoard: false,
    policy: 'Standard board (80 tiles). Normal skilled band S in [2.5, 6.0].'
  },
  {
    level: 253,
    target: 10.25,
    layout: 30,
    shape: 'diamond',
    story: 'lockBeside',
    stage: 'edge',
    seed: 4,
    depth: 3,
    spare: 1,
    frameSpare: 3,
    hiddenOnWay: 1,
    traps: 2,
    maxDown: 0.35,
    skilledBand: [2.5, 6.0],
    isBigBoard: false,
    policy: 'Standard board (80 tiles). 96 tiles strictly forbidden. Normal skilled band S in [2.5, 6.0].'
  },
  {
    level: 254,
    target: 10.33,
    layout: 30,
    shape: 'diamond',
    story: 'lockBeside',
    stage: 'edge',
    seed: 30,
    depth: 3,
    spare: 1,
    frameSpare: 3,
    hiddenOnWay: 1,
    traps: 2,
    maxDown: 0.35,
    skilledBand: [2.5, 6.0],
    isBigBoard: false,
    policy: 'Standard board (80 tiles). Distinct diamond seed 30 with distinct matching body. Normal skilled band S in [2.5, 6.0].'
  }
];

function generateCard(spec, cand, ev) {
  const c = cand.card || {};
  return `# Design Card: Level ${spec.level} (${cand.design.tiles.length} tiles, ${spec.shape})

- **Level Slot:** ${spec.level} (${spec.isBigBoard ? '10th level big board slot' : 'standard level slot'})
- **Shape / Layout:** ${spec.shape} (Layout ${spec.layout}, ${cand.design.tiles.length} tiles)
- **Target Difficulty:** ${spec.target.toFixed(2)} (Family bot D: ${ev.D.toFixed(3)}, error: ${(ev.D - spec.target).toFixed(3)})
- **Skilled Bot Rating:** S = ${ev.S.toFixed(2)} (${spec.skilledBand[0] >= 2.5 ? 'Normal skilled band [2.5, 6.0]' : 'Recorded fallback skilled band [2.0, 2.5)'})
- **Clock Depth & Spare:** Fewest moves k = ${cand.k}, Clock deadline n = ${cand.clockN} (Spare ${cand.spare})
- **Board Key:** \`${M.boardKey(cand.design)}\`
- **Static Gate Profile (e5-v1):** ${ev.staticPass ? 'PASS' : 'FAIL'} (all required gates A1-A9 pass)
- **Trace Gate Profile (e5-v1):** ${ev.tracePass ? 'PASS' : 'FAIL'} (B1-B6 pass, B7 uninflated)
- **Policy & Rationale:** ${spec.policy}
- **Readable Player Challenge:**
  - Authoring: ${c.story || 'Lock beside the clock'}
  - Summary: ${c.cardText || c.sentence || 'Topological clock puzzle with visible choices.'}
  - Authored Traps: ${JSON.stringify(c.traps || [])}
`;
}

async function run() {
  console.log('[plan_sequence] Starting level sequence production for Levels 250-254...');
  const ys = createYardstick();
  const results = [];
  const boardKeys = new Set();

  for (const spec of SEQUENCE_SPECS) {
    console.log(`[plan_sequence] Processing Level ${spec.level} (target ${spec.target}, ${spec.shape}, seed ${spec.seed})...`);
    const r = {
      id: `level-${spec.level}-${spec.shape}`,
      layout: spec.layout,
      shape: spec.shape,
      story: spec.story,
      stage: spec.stage,
      depth: spec.depth,
      spare: spec.spare,
      frameSpare: spec.frameSpare,
      hiddenOnWay: spec.hiddenOnWay,
      traps: spec.traps,
      tailPairWidth: spec.tailPairWidth,
      maxDown: spec.maxDown,
      seed: spec.seed,
      startAttempt: spec.startAttempt,
      tries: spec.tries
    };

    const cand = C.buildCandidate(spec.layout, spec.shape, spec.seed, r);
    if (!cand.ok) {
      throw Error(`Failed to build candidate for Level ${spec.level}: ${cand.fail}`);
    }

    const key = M.boardKey(cand.design);
    if (boardKeys.has(key)) {
      throw Error(`Duplicate board key detected in sequence: ${key}`);
    }
    boardKeys.add(key);

    if (spec.level === 253 && cand.design.tiles.length === 96) {
      throw Error(`Rule violation: 96 tiles strictly forbidden at Level 253!`);
    }

    const request = {
      target: spec.target,
      layout: spec.layout,
      shape: spec.shape,
      seed: spec.seed,
      tol: 1.0,
      skilledBand: spec.skilledBand
    };

    const ev = V.evaluateDesign(cand.design, {
      ys,
      request,
      shape: spec.shape,
      spare: spec.spare,
      campaigns: 80
    });

    const issues = V.diagnose(ev, request);
    if (issues.length) {
      throw Error(`Quality verification failed for Level ${spec.level}: ${issues.join(', ')}`);
    }

    console.log(`[plan_sequence] Level ${spec.level} verified: D=${ev.D.toFixed(3)} (err=${(ev.D - spec.target).toFixed(3)}), S=${ev.S.toFixed(2)}, static=${ev.staticPass}, trace=${ev.tracePass}`);

    // Save individual board JSON
    const boardPath = path.join(boardsDir, `level_${spec.level}.json`);
    fs.writeFileSync(boardPath, JSON.stringify(cand.design, null, 2) + '\n');

    // Save individual card markdown
    const cardContent = generateCard(spec, cand, ev);
    const cardPath = path.join(cardsDir, `level_${spec.level}_card.md`);
    fs.writeFileSync(cardPath, cardContent);

    results.push({
      level: spec.level,
      target: spec.target,
      layout: spec.layout,
      shape: spec.shape,
      tiles: cand.design.tiles.length,
      seed: spec.seed,
      spare: spec.spare,
      k: cand.k,
      clockN: cand.clockN,
      boardKey: key,
      D: ev.D,
      S: ev.S,
      error: ev.D - spec.target,
      staticPass: ev.staticPass,
      tracePass: ev.tracePass,
      isNormalBand: ev.S >= 2.5,
      isFallback: ev.S < 2.5,
      policy: spec.policy
    });
  }

  // Verify sequence-level arithmetic constraints
  const avgTarget = results.reduce((s, r) => s + r.target, 0) / results.length;
  const avgD = results.reduce((s, r) => s + r.D, 0) / results.length;
  const avgError = Math.abs(avgD - avgTarget);

  console.log(`[plan_sequence] Sequence summary:`);
  console.log(`  Target curve average: ${avgTarget.toFixed(3)}`);
  console.log(`  Measured curve average: ${avgD.toFixed(3)}`);
  console.log(`  Curve average gap: ${avgError.toFixed(3)} (limit: +/-0.500) -> ${avgError <= 0.5 ? 'PASS' : 'FAIL'}`);

  if (avgError > 0.5) {
    throw Error(`Curve average gap ${avgError.toFixed(3)} exceeds +/-0.500 tolerance`);
  }

  const sequenceData = {
    schema: 'g12-sequence-v1',
    timestamp: new Date().toISOString(),
    levels: results,
    metrics: {
      averageTarget: avgTarget,
      averageMeasuredD: avgD,
      averageGap: avgError,
      averageGapPassing: avgError <= 0.5,
      normalBandLevels: results.filter(r => r.isNormalBand).length,
      fallbackLevels: results.filter(r => r.isFallback).length,
      distinctBoards: boardKeys.size
    }
  };

  fs.writeFileSync(path.join(outDir, 'sequence.json'), JSON.stringify(sequenceData, null, 2) + '\n');
  console.log(`[plan_sequence] Sequence successfully generated and saved to ${path.join(outDir, 'sequence.json')}`);
  return sequenceData;
}

if (require.main === module) {
  run().catch(e => {
    console.error('[plan_sequence] Error:', e.stack);
    process.exit(1);
  });
}

module.exports = { run, SEQUENCE_SPECS };
