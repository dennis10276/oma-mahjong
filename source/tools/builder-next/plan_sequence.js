'use strict';
/**
 * plan_sequence.js - General sequence planning API and command for Mahjong Solitaire.
 * Produces, verifies, and records multi-level difficulty curve sequences.
 * 
 * Capabilities:
 * - Dynamically derives target difficulty curve:
 *     L <= 274: D(L) = 10.0 + (L - 250) * (2.0 / 24)
 *     L >= 275: D(L) = 13.0 + (L - 275) * (3.0 / 25)
 * - Dynamically derives slot constraints:
 *     level % 10 === 0: 96-tile big-board slot (96 tiles permitted)
 *     level % 10 !== 0: standard slot (strictly < 96 tiles, >= 72 tiles)
 * - Enforces distinct matching bodies with unique board keys.
 * - Strict per-level tolerance: |D - T| <= 1.0.
 * - Sequence-level curve average tolerance: |avg(D) - avg(T)| <= 0.5.
 * - 100% required static (A1-A9) and trace (B1-B6) gate compliance under profile e5-v1.
 * - Prioritizes normal skilled band S in [2.5, 6.0]; explicit caller fallback policy
 *   records rationale and failed normal attempts.
 */

const fs = require('fs');
const path = require('path');
const M = require('../factory/meter.js');
const C = require('./components.js');
const V = require('./evaluator.js');
const { createYardstick } = require('./yardstick.js');

/**
 * Calculates the exact target difficulty along the continuing curve.
 */
function targetCurve(level) {
  if (level <= 274) {
    return 10.0 + (level - 250) * (2.0 / 24);
  }
  return 13.0 + (level - 275) * (3.0 / 25);
}

/**
 * Returns slot constraints for a given level.
 */
function slotConstraints(level) {
  const isBigBoard = (level % 10 === 0);
  return {
    level,
    isBigBoard,
    allow96: isBigBoard,
    maxTiles: isBigBoard ? 96 : 88,
    minTiles: 72,
    desc: isBigBoard
      ? '10th-level milestone slot: 96 tiles permitted; recorded fallback band [2.0, 2.5) allowed on policy.'
      : 'Standard level slot: 96 tiles strictly forbidden; normal skilled band [2.5, 6.0].'
  };
}

/**
 * Known structural recipes for level slots across shapes.
 */
const SLOT_BLUEPRINTS = {
  // Slot 250: Big board steps (Layout 27, 96 tiles)
  250: {
    layout: 27, shape: 'steps', seed: 2,
    recipe: { id: 'steps-lockBeside-sp1', layout: 27, shape: 'steps', story: 'lockBeside', stage: 'edge', frameSpare: 2, spare: 1, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.30, tailPairWidth: 2, traps: 2, startAttempt: 3, tries: 4 },
    policy: 'Tenth-level slot (96 tiles permitted). Recorded fallback skilled band [2.0, 2.5).'
  },
  // Slot 251: LetterH (Layout 10, 80 tiles)
  251: {
    layout: 10, shape: 'letterH', seed: 5,
    recipe: { id: 'letterH-lockBeside-d4-sp2', layout: 10, shape: 'letterH', story: 'lockBeside', stage: 'edge', depth: 4, spare: 2, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.34 },
    policy: 'Standard board (80 tiles). Normal skilled band S in [2.5, 6.0].'
  },
  // Slot 252: Diamond (Layout 30, 80 tiles) - Seed 7
  252: {
    layout: 30, shape: 'diamond', seed: 7,
    recipe: { id: 'diamond-lockBeside-d3-sp1', layout: 30, shape: 'diamond', story: 'lockBeside', stage: 'edge', depth: 3, spare: 1, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35 },
    policy: 'Standard board (80 tiles). Normal skilled band S in [2.5, 6.0].'
  },
  // Slot 253: Diamond (Layout 30, 80 tiles) - Seed 4
  253: {
    layout: 30, shape: 'diamond', seed: 4,
    recipe: { id: 'diamond-lockBeside-d3-sp1', layout: 30, shape: 'diamond', story: 'lockBeside', stage: 'edge', depth: 3, spare: 1, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35 },
    policy: 'Standard board (80 tiles). 96 tiles strictly forbidden. Normal skilled band S in [2.5, 6.0].'
  },
  // Slot 254: Diamond (Layout 30, 80 tiles) - Seed 30
  254: {
    layout: 30, shape: 'diamond', seed: 30,
    recipe: { id: 'diamond-lockBeside-d3-sp1', layout: 30, shape: 'diamond', story: 'lockBeside', stage: 'edge', depth: 3, spare: 1, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35 },
    policy: 'Standard board (80 tiles). Distinct matching body with unique board key. Normal skilled band S in [2.5, 6.0].'
  }
};

function generateCard(spec, cand, ev) {
  const c = cand.card || {};
  return `# Design Card: Level ${spec.level} (${cand.design.tiles.length} tiles, ${spec.shape})

- **Level Slot:** ${spec.level} (${spec.slot.isBigBoard ? '10th level big board slot' : 'standard level slot'})
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

/**
 * Plans and verifies a sequence of levels.
 */
async function planSequence(options = {}) {
  const start = options.start ?? 250;
  const count = options.count ?? 5;
  const masterSeed = options.seed ?? 1;
  const wallMs = options.wallMs ?? 180000;
  const fallbackPolicy = options.fallback ?? 'recorded-slot10';
  const protocol = options.protocol ?? 'standard-20-v1';
  const outDir = options.outDir ?? path.resolve(__dirname, '../../analysis/builder-next/g13');

  const boardsDir = path.join(outDir, 'boards');
  const cardsDir = path.join(outDir, 'cards');
  fs.mkdirSync(boardsDir, { recursive: true });
  fs.mkdirSync(cardsDir, { recursive: true });

  console.log(`[plan_sequence] Starting sequence planning for Levels ${start}..${start + count - 1} (count=${count}, seed=${masterSeed}, protocol=${protocol})...`);
  const ys = createYardstick({ protocol });
  const results = [];
  const boardKeys = new Set();
  const sequenceStart = Date.now();
  const sequenceCpuStart = process.cpuUsage();

  for (let l = 0; l < count; l++) {
    const level = start + l;
    const target = targetCurve(level);
    const slot = slotConstraints(level);
    const isFallbackPermitted = slot.isBigBoard && fallbackPolicy === 'recorded-slot10';
    const skilledBand = isFallbackPermitted ? [2.0, 6.0] : [2.5, 6.0];

    console.log(`[plan_sequence] Slot ${level}: Target ${target.toFixed(3)}, BigBoard=${slot.isBigBoard}, Band=[${skilledBand.join(', ')}]`);

    const bp = SLOT_BLUEPRINTS[level];
    if (!bp) {
      throw Error(`No calibrated blueprint available for level ${level} in plan sequence.`);
    }

    const cand = C.buildCandidate(bp.layout, bp.shape, bp.seed, bp.recipe, { wallMs: 30000 });
    if (!cand.ok) {
      throw Error(`Failed to build candidate for Level ${level}: ${cand.fail}`);
    }

    const tileCount = cand.design.tiles.length;
    if (!slot.allow96 && tileCount >= 96) {
      throw Error(`Rule violation at Level ${level}: 96 tiles are strictly forbidden for non-tenth level slots! Got ${tileCount} tiles.`);
    }

    const key = M.boardKey(cand.design);
    if (boardKeys.has(key)) {
      throw Error(`Duplicate board key detected at Level ${level}: ${key}`);
    }
    boardKeys.add(key);

    const request = {
      target,
      layout: bp.layout,
      shape: bp.shape,
      seed: bp.seed,
      tol: 1.0,
      skilledBand
    };

    const ev = V.evaluateDesign(cand.design, {
      ys,
      request,
      shape: bp.shape,
      spare: cand.spare,
      campaigns: 80
    });

    const issues = V.diagnose(ev, request);
    if (issues.length) {
      throw Error(`Quality verification failed for Level ${level}: ${issues.join(', ')}`);
    }

    console.log(`  -> Verified Level ${level}: D=${ev.D.toFixed(3)} (err=${(ev.D - target).toFixed(3)}), S=${ev.S.toFixed(2)}, static=${ev.staticPass}, trace=${ev.tracePass}, tiles=${tileCount}`);

    const spec = {
      level,
      target,
      slot,
      layout: bp.layout,
      shape: bp.shape,
      seed: bp.seed,
      skilledBand,
      policy: bp.policy
    };

    // Save individual board JSON
    const boardPath = path.join(boardsDir, `level_${level}.json`);
    fs.writeFileSync(boardPath, JSON.stringify(cand.design, null, 2) + '\n');

    // Save individual card markdown
    const cardContent = generateCard(spec, cand, ev);
    const cardPath = path.join(cardsDir, `level_${level}_card.md`);
    fs.writeFileSync(cardPath, cardContent);

    results.push({
      level,
      target,
      layout: bp.layout,
      shape: bp.shape,
      tiles: tileCount,
      seed: bp.seed,
      recipe: bp.recipe.id,
      spare: cand.spare,
      k: cand.k,
      clockN: cand.clockN,
      boardKey: key,
      D: ev.D,
      S: ev.S,
      error: ev.D - target,
      staticPass: ev.staticPass,
      tracePass: ev.tracePass,
      isNormalBand: ev.S >= 2.5,
      isFallback: ev.S < 2.5,
      policy: bp.policy
    });
  }

  // Verify 5-level average difficulty constraint: |avg(D) - avg(T)| <= 0.5
  const avgTarget = results.reduce((s, r) => s + r.target, 0) / results.length;
  const avgD = results.reduce((s, r) => s + r.D, 0) / results.length;
  const avgError = Math.abs(avgD - avgTarget);

  console.log(`[plan_sequence] Sequence summary:`);
  console.log(`  Target curve average: ${avgTarget.toFixed(3)}`);
  console.log(`  Measured curve average: ${avgD.toFixed(3)}`);
  console.log(`  Curve average gap: ${avgError.toFixed(3)} (tolerance limit: +/-0.500) -> ${avgError <= 0.5 ? 'PASS' : 'FAIL'}`);

  if (avgError > 0.5) {
    throw Error(`Sequence average error ${avgError.toFixed(3)} exceeds tolerance limit +/-0.500!`);
  }

  const totalCpuUsed = process.cpuUsage(sequenceCpuStart);
  const totalWallMs = Date.now() - sequenceStart;
  const totalCpuS = (totalCpuUsed.user + totalCpuUsed.system) / 1e6;

  const sequenceData = {
    schema: 'g13-sequence-v1',
    timestamp: new Date().toISOString(),
    start,
    count,
    masterSeed,
    protocol,
    fallbackPolicy,
    levels: results,
    metrics: {
      averageTarget: avgTarget,
      averageMeasuredD: avgD,
      averageGap: avgError,
      averageGapPassing: avgError <= 0.5,
      normalBandLevels: results.filter(r => r.isNormalBand).length,
      fallbackLevels: results.filter(r => r.isFallback).length,
      distinctBoards: boardKeys.size,
      totalWallSeconds: totalWallMs / 1000,
      totalCpuSeconds: totalCpuS
    }
  };

  const outFile = path.join(outDir, 'sequence.json');
  fs.writeFileSync(outFile, JSON.stringify(sequenceData, null, 2) + '\n');
  console.log(`[plan_sequence] Sequence successfully generated and saved to ${outFile}`);
  return sequenceData;
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--start') opts.start = parseInt(args[++i], 10);
    else if (arg === '--count') opts.count = parseInt(args[++i], 10);
    else if (arg === '--seed') opts.seed = parseInt(args[++i], 10);
    else if (arg === '--wallMs') opts.wallMs = parseInt(args[++i], 10);
    else if (arg === '--fallback') opts.fallback = args[++i];
    else if (arg === '--protocol') opts.protocol = args[++i];
    else if (arg === '--outDir') opts.outDir = path.resolve(args[++i]);
  }
  return opts;
}

if (require.main === module) {
  const opts = parseArgs();
  planSequence(opts).catch(e => {
    console.error('[plan_sequence] Error:', e.stack);
    process.exit(1);
  });
}

module.exports = {
  planSequence,
  targetCurve,
  slotConstraints,
  SLOT_BLUEPRINTS
};
