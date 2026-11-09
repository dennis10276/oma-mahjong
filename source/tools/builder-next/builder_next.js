'use strict';
/**
 * builder_next.js - Main entry point for the target-driven builder prototype.
 * Coordinates base construction, difficulty planning, bot evaluation,
 * and the bounded build-rate-repair loop.
 */

const components = require('./components.js');
const planner = require('./planner.js');
const repair = require('./repair.js');
const evaluator = require('./evaluator.js');

/**
 * Builds a board to meet the requested family difficulty target.
 *
 * @param {Object} request
 * @param {number} request.target - Target family difficulty (e.g. 10 or 13)
 * @param {number} [request.layout=22] - Layout index
 * @param {string} [request.shape='ushape'] - Layout shape name
 * @param {number} [request.seed=1] - Deal seed
 * @param {Array<number>} [request.skilledBand=[2.5, 6.0]] - Required skilled bot difficulty range
 * @param {number} [request.tol=1.0] - Allowed family difficulty tolerance (+/-)
 * @param {Object} [options]
 * @param {number} [options.maxRepairs=3] - Maximum repairs allowed in the loop
 * @param {number} [options.wallMs=180000] - Total wall clock budget in ms
 * @param {number} [options.campaigns=80] - Number of campaigns for family rating
 */
async function build(request = {}, options = {}) {
  const tStart = Date.now();
  const cpuStart = process.cpuUsage();

  const target = request.target ?? 10;
  const layout = request.layout ?? 22;
  const baseMeta = Object.values(components.BASE_BODIES).find(b => b.layout === layout);
  const shape = request.shape || baseMeta?.shape || 'ushape';
  const stage = request.stage || baseMeta?.stage || 'edge';
  const seed = request.seed ?? baseMeta?.seed ?? 1;
  const skilledBand = request.skilledBand || [2.5, 6.0];
  const tol = request.tol ?? 1.0;

  const maxRepairs = options.maxRepairs ?? 3;
  const wallMs = options.wallMs ?? 180000;
  const campaigns = options.campaigns ?? 80;

  const repairLedger = [];
  const attemptHistory = [];

  // Step 1: Build the base visible-choice body
  const baseResult = components.buildBase(layout, shape, stage, seed, { wallMs: 30000 });
  if (baseResult.fail || !baseResult.design) {
    return {
      success: false,
      reason: `Base build failed: ${baseResult.fail}`,
      attempts: 0,
      repairHistory: repairLedger
    };
  }
  const baseDesign = baseResult.design;

  // Step 2: Planner proposes initial recipe from requested target
  let currentRecipe = planner.planInitialRecipe(target, layout, { skilledBand });
  let currentCandidate = null;
  let bestCandidate = null;
  let bestGap = Infinity;

  // Step 3: Bounded build-rate-repair loop
  let repairCount = 0;

  while (repairCount <= maxRepairs) {
    if (Date.now() - tStart >= wallMs) {
      repairLedger.push({ action: 'TIMEOUT', reason: 'Wall clock budget exhausted' });
      break;
    }

    // Build the candidate board
    const candidate = components.composeCandidate(baseDesign, currentRecipe);
    if (!candidate.ok) {
      repairLedger.push({
        action: 'BUILD_FAIL',
        recipe: currentRecipe,
        reason: candidate.fail
      });
      break;
    }

    // Evaluate candidate with yardstick bots & trace gates
    const evalResult = evaluator.evaluateDesign(candidate.design, {
      spare: candidate.spare,
      shape,
      campaigns
    });

    const gap = Math.abs(evalResult.D - target);
    const attemptRecord = {
      attemptIndex: repairCount + 1,
      recipe: currentRecipe,
      k: candidate.k,
      clockN: candidate.clockN,
      spare: candidate.spare,
      S: evalResult.S,
      D: evalResult.D,
      D_se: evalResult.D_se,
      gap,
      staticPass: evalResult.staticPass,
      tracePass: evalResult.tracePass,
      traces: evalResult.traces,
      cpuS: evalResult.cpuS,
      ms: evalResult.ms
    };
    attemptHistory.push(attemptRecord);

    if (gap < bestGap && evalResult.staticPass && evalResult.tracePass) {
      bestGap = gap;
      bestCandidate = { candidate, evaluation: evalResult, recipe: currentRecipe };
    }

    // Diagnose outcome
    const diagnosis = repair.diagnoseMiss(evalResult, target, { tol, skilledBand });

    // Success condition: in target band, skilled in band, static pass, trace pass
    if (!diagnosis.hasIssues) {
      const totalCpu = process.cpuUsage(cpuStart);
      return {
        success: true,
        status: 'QUALIFIED',
        target,
        layout,
        seed,
        finalCandidate: {
          design: candidate.design,
          recipe: currentRecipe,
          proof: candidate.proof,
          k: candidate.k,
          clockN: candidate.clockN,
          spare: candidate.spare
        },
        evaluation: evalResult,
        attempts: repairCount + 1,
        repairs: repairCount,
        repairHistory: repairLedger,
        attemptHistory,
        cost: {
          cpuS: (totalCpu.user + totalCpu.system) / 1e6,
          wallMs: Date.now() - tStart
        }
      };
    }

    // Miss condition: compute structural repair
    if (repairCount >= maxRepairs) {
      repairLedger.push({
        action: 'MAX_REPAIRS_REACHED',
        reason: `Exhausted repair budget of ${maxRepairs} repairs without closing gap`
      });
      break;
    }

    const repairAction = repair.computeStructuralRepair(candidate, diagnosis, target, { skilledBand });
    if (!repairAction.repairedRecipe) {
      repairLedger.push({
        action: 'NO_REPAIR_AVAILABLE',
        reason: repairAction.reason,
        issues: diagnosis.issues
      });
      break;
    }

    repairLedger.push({
      repairIndex: repairCount + 1,
      beforeRecipe: currentRecipe,
      beforeD: evalResult.D,
      beforeS: evalResult.S,
      issues: diagnosis.issues.map(i => i.code),
      reason: repairAction.reason,
      afterRecipe: repairAction.repairedRecipe,
      editType: repairAction.editType
    });

    currentRecipe = repairAction.repairedRecipe;
    repairCount++;
  }

  // Loop finished without a perfect qualified match within budget
  const totalCpu = process.cpuUsage(cpuStart);
  return {
    success: false,
    status: 'BUDGET_EXHAUSTED',
    target,
    layout,
    seed,
    bestCandidate: bestCandidate ? {
      design: bestCandidate.candidate.design,
      recipe: bestCandidate.recipe,
      evaluation: bestCandidate.evaluation,
      gap: bestGap
    } : null,
    attempts: attemptHistory.length,
    repairs: repairCount,
    repairHistory: repairLedger,
    attemptHistory,
    cost: {
      cpuS: (totalCpu.user + totalCpu.system) / 1e6,
      wallMs: Date.now() - tStart
    }
  };
}

module.exports = {
  build
};
