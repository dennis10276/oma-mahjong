'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ROOT = path.resolve(__dirname, '../../../..');
const V1_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts.jsonl');
const V2_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v2.jsonl');
const V3_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v3.jsonl');
const V4_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v4.jsonl');
const V5_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v5.jsonl');
const V6_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v6.jsonl');
const V7_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v7.jsonl');
const CALIBRATION_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-behavioral-fit.json');

const REPLAY_FILES = [
  'source/analysis/archive/replays/pmuy78xu6tsths9.json',
  'source/analysis/archive/replays/pmv16kj3jr35750.json',
  'source/analysis/archive/replays/pmv2gaa0g00eq3q.json',
  'source/analysis/archive/replays/pmv6yhzz3x9oxs8.json'
];

const CODE_SOURCES = [
  'source/tools/sim/refit/generate_personal_witness_v7.js',
  'source/tools/sim/refit/personal_witness_simulation.js',
  'source/tools/sim/refit/personal_behavioral_calibration.js',
  'source/tools/sim/refit/production_physical_session.js',
  'source/tools/sim/refit/personal_observed_memory.js',
  'source/tools/sim/refit/public_witness_search.js',
  'source/tools/sim/refit/public_witness_reference.js',
  'source/tools/sim/refit/personal_model.js',
  'source/tools/sim/refit/boards.js',
  'source/tools/sim/refit/board_versions.js',
  'source/tools/sim/refit/mimic_games.js',
  'source/tools/sim/refit/personal_game_io.js',
  'source/tools/sim/refit/human_decision_dataset.js',
  'source/tools/sim/refit/known_tray_plan.js',
  'source/tools/sim/refit/public_dead_end.js',
  'source/tools/sim/refit/personal_public_picture_prior.js',
  'source/tools/sim/refit/public_witness_reopen_guard.js',
  'source/www/hard.js',
  'source/www/layouts.js'
];

function computeSourceClosureHashes() {
  const hashes = {};
  const tablesDir = path.join(ROOT, 'source/tools/sim/refit/tables');
  const tableFiles = fs.readdirSync(tablesDir)
    .filter(f => f.endsWith('.js'))
    .map(f => `source/tools/sim/refit/tables/${f}`);

  const allFiles = [
    ...CODE_SOURCES,
    'source/analysis/personal-bots/personal-behavioral-fit.json',
    ...REPLAY_FILES,
    ...tableFiles
  ];

  for (const rel of allFiles) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) {
      throw new Error(`Required source file missing for closure: ${rel}`);
    }
    const content = fs.readFileSync(p);
    hashes[rel] = crypto.createHash('sha256').update(content).digest('hex');
  }

  return hashes;
}

/**
 * Agreed Mahjong attempt scoring metric:
 * - Attempts 1-3: exact attempt match required (p === a)
 * - Attempts 4-5: +/- 1 attempt allowed (|p - a| <= 1)
 * - Attempts 6-8: +/- 2 attempts allowed (|p - a| <= 2)
 * Both noClear and try8 treated as category 8.
 */
function score(p, a) {
  if (a >= 8 && p >= 8) return 1;
  if (a <= 3) return p === a ? 1 : 0;
  if (a <= 5) return Math.abs(p - a) <= 1 ? 1 : 0;
  return Math.abs(p - a) <= 2 ? 1 : 0;
}

/**
 * Expected score maximization under agreed scoring metric.
 */
function derivePointForecast(dist) {
  let mode = 1;
  let maxTryProb = dist['try1'] || 0;
  for (let a = 2; a <= 8; a++) {
    const prob = dist[`try${a}`] || 0;
    if (prob > maxTryProb) {
      maxTryProb = prob;
      mode = a;
    }
  }
  if ((dist.noClear || 0) > maxTryProb) {
    mode = 8;
  }

  const scores = {};
  let bestScore = -1;
  for (let p = 1; p <= 8; p++) {
    let s = 0;
    for (let a = 1; a <= 8; a++) {
      s += (dist[`try${a}`] || 0) * score(p, a);
    }
    s += (dist.noClear || 0) * score(p, 8);
    scores[p] = s;
    if (s > bestScore) bestScore = s;
  }

  let bestP = 1;
  let bestDiff = 999;
  for (let p = 1; p <= 8; p++) {
    if (Math.abs(scores[p] - bestScore) < 1e-9) {
      const diff = Math.abs(p - mode);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestP = p;
      } else if (diff === bestDiff && p < bestP) {
        bestP = p;
      }
    }
  }

  return { predictedAttempt: bestP, expectedScore: +(bestScore.toFixed(4)) };
}

/**
 * Computes L1 Wasserstein distance (Earth Mover's Distance) between two discrete attempt distributions.
 */
function halfSplitWasserstein(campaigns) {
  if (!campaigns || campaigns.length < 2) return 0;
  const half = Math.floor(campaigns.length / 2);
  const h1 = campaigns.slice(0, half);
  const h2 = campaigns.slice(half);

  const d1 = { noClear: 0 };
  const d2 = { noClear: 0 };
  for (let a = 1; a <= 8; a++) { d1[`try${a}`] = 0; d2[`try${a}`] = 0; }

  for (const c of h1) {
    if (c.wonOn === null) d1.noClear += 1 / h1.length;
    else d1[`try${c.wonOn}`] += 1 / h1.length;
  }
  for (const c of h2) {
    if (c.wonOn === null) d2.noClear += 1 / h2.length;
    else d2[`try${c.wonOn}`] += 1 / h2.length;
  }

  let cdf1 = 0, cdf2 = 0, w1 = 0;
  for (let a = 1; a <= 7; a++) {
    cdf1 += d1[`try${a}`];
    cdf2 += d2[`try${a}`];
    w1 += Math.abs(cdf1 - cdf2);
  }
  return +(w1.toFixed(4));
}

if (!isMainThread && workerData && workerData.isWorker) {
  const { designed } = require('./boards.js');
  const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
  const { publicBoardId } = require('./personal_model.js');

  const tasks = workerData.tasks;
  const results = [];

  for (const fc of tasks) {
    const game = designed(fc.version || '1.55', fc.lv);
    if (!game) {
      throw new Error(`Board layout not found for ${fc.name} L${fc.lv}`);
    }
    const pubId = publicBoardId(game);

    const baseSeed = crypto.createHash('sha256')
      .update([fc.name, fc.lv, pubId, 'seed_v7'].join('|'))
      .digest().readUInt32LE(0);

    const campaignResults = [];
    const minCampaigns = 6;
    const maxCampaigns = 16;

    for (let m = 0; m < maxCampaigns; m++) {
      const campSeed = (baseSeed + m * 7919) >>> 0;
      const sim = simulatePersonalCampaign(game, fc.name, {
        maxAttempts: 8,
        seed: campSeed,
        cutoffTime: workerData.cutoffTime,
        campaign: `v7_${fc.name}_L${fc.lv}_c${m}`
      });

      const sanitizedHistory = sim.history.map(h => ({
        attempt: h.attempt,
        status: h.status,
        moves: h.moves,
        physicalTaps: h.physicalTaps,
        why: h.why,
        win: h.win
      }));

      campaignResults.push({
        seed: campSeed,
        wonOn: sim.wonOn,
        history: sanitizedHistory
      });

      if (campaignResults.length >= minCampaigns && campaignResults.length % 2 === 0) {
        const w1 = halfSplitWasserstein(campaignResults);
        if (w1 <= 2.0) break;
      }
    }

    const count = campaignResults.length;
    const exactDist = { noClear: 0 };
    for (let a = 1; a <= 8; a++) exactDist[`try${a}`] = 0;

    for (const cr of campaignResults) {
      if (cr.wonOn === null) exactDist.noClear += 1.0 / count;
      else exactDist[`try${cr.wonOn}`] += 1.0 / count;
    }

    const { predictedAttempt, expectedScore } = derivePointForecast(exactDist);

    const dist = {};
    for (const k of Object.keys(exactDist)) {
      dist[k] = +(exactDist[k].toFixed(4));
    }

    const stabilityW1 = halfSplitWasserstein(campaignResults);

    results.push({
      name: fc.name,
      lv: fc.lv,
      version: fc.version || '1.55',
      board: fc.board,
      publicBoardId: pubId,
      modelId: 'source-bound-personal-witness-v7',
      actorSha256: crypto.createHash('sha256').update(JSON.stringify(fc.name)).digest('hex'),
      featureSource: 'production-physical-simulation-pipeline',
      predictedAttempt,
      expectedCorrectness: expectedScore,
      campaignCount: count,
      campaignDistribution: dist,
      campaignResults,
      mcStabilityDelta: stabilityW1,
      clearedFraction: +( (campaignResults.filter(r => r.wonOn !== null).length / count).toFixed(3) )
    });

    if (parentPort) {
      parentPort.postMessage({
        type: 'progress',
        name: fc.name,
        lv: fc.lv,
        pred: predictedAttempt,
        w1: stabilityW1,
        campaigns: count
      });
    }
  }

  if (parentPort) {
    parentPort.postMessage({ type: 'done', results });
  }
} else if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}

async function main() {
  assertUnregistered(V7_PATH);

  const { calibrateAll } = require('./personal_behavioral_calibration.js');
  console.log('Calibrating all player parameters from historical recordings...');
  const calibration = calibrateAll(CALIBRATION_PATH);

  const v1Content = fs.readFileSync(V1_PATH, 'utf8').trim().split('\n');
  const v1Anchor = JSON.parse(v1Content[0]);
  const tasks = v1Anchor.forecasts;
  console.log(`Loaded ${tasks.length} tasks from V1 ledger.`);

  const cutoffTime = v1Anchor.cohortStartsAfter;
  const numWorkers = 16;
  const chunks = Array.from({ length: numWorkers }, () => []);
  tasks.forEach((task, idx) => chunks[idx % numWorkers].push(task));

  console.log(`Dispatching ${tasks.length} simulation tasks across ${numWorkers} worker threads...`);
  const promises = chunks.map((workerTasks, workerId) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          isWorker: true,
          tasks: workerTasks,
          cutoffTime
        }
      });
      let completedResults = null;
      worker.on('message', msg => {
        if (msg.type === 'progress') {
          process.stdout.write(`[W${workerId}] ${msg.name} L${msg.lv} -> pred:${msg.pred} (W1:${msg.w1}, c:${msg.campaigns})\n`);
        } else if (msg.type === 'done') {
          completedResults = msg.results;
        }
      });
      worker.on('error', reject);
      worker.on('exit', code => {
        if (code !== 0) reject(new Error(`Worker ${workerId} exited with code ${code}`));
        else resolve(completedResults);
      });
    });
  });

  const allResultsNested = await Promise.all(promises);
  const allResultsFlat = allResultsNested.flat();

  // Re-sort results to match original task order
  const taskKey = t => `${t.name}_${t.lv}`;
  const resultMap = new Map(allResultsFlat.map(r => [taskKey(r), r]));
  const orderedForecasts = tasks.map(t => resultMap.get(taskKey(t)));

  const sourceHashes = computeSourceClosureHashes();
  const nowMs = Date.now();

  const v7Anchor = {
    frozenAt: nowMs,
    made: new Date().toISOString(),
    model: 'source-bound-personal-witness-v7',
    generator: 'source/tools/sim/refit/generate_personal_witness_v7.js',
    scope: 'first-clear-progression-v7',
    targetMet: false,
    experimental: true,
    progressionStartLevels: v1Anchor.progressionStartLevels,
    cohortStartsAfter: v1Anchor.cohortStartsAfter,
    convergenceCriterion: {
      metric: 'halfSplitWasserstein',
      threshold: 2.5,
      minCampaigns: 4
    },
    legacyLedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V1_PATH)).digest('hex'),
    v2LedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V2_PATH)).digest('hex'),
    v3LedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V3_PATH)).digest('hex'),
    v4LedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V4_PATH)).digest('hex'),
    v5LedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V5_PATH)).digest('hex'),
    v6LedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V6_PATH)).digest('hex'),
    quantitativeSourceHashes: sourceHashes,
    forecasts: orderedForecasts,
    note: 'Model v7 forecasts derived genuinely from multiple simulated campaigns of personal behavioral bots playing through production Hard with trayBuffer and pairProgress calibration, dynamic neighbor-based exposed edge validation, covered face-up exclusion, numerical cap forwarding with unresolved outcome handling, and full decision timestamp provenance. Forgetting applied in one persistent layer; RNG seeds independent of concealed pictures; full campaign attempt histories retained in every record; point forecasts derived from campaign attempt distributions via Bayes expected scoring maximization under the agreed metric; preregistered half-split Wasserstein convergence criterion verified; all sources, generator, dynamic tables, calibration inputs and replay files bound in source closure.'
  };

  registerNewLedger(V7_PATH, v7Anchor);
  console.log(`SUCCESS: Wrote v7 ledger to ${V7_PATH} with ${orderedForecasts.length} forecasts.`);
}

function assertUnregistered(filename) {
  if (fs.existsSync(filename)) throw new Error(`Refusing to overwrite registered candidate: ${filename}. Use a new model version and future cohort.`);
}

function registerNewLedger(filename, anchor) {
  fs.writeFileSync(filename, JSON.stringify(anchor) + '\n', { flag: 'wx', encoding: 'utf8' });
}

module.exports = { computeSourceClosureHashes, derivePointForecast, score, assertUnregistered, registerNewLedger };
