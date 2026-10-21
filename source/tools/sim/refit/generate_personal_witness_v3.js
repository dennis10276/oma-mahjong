'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ROOT = path.resolve(__dirname, '../../../..');
const V1_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts.jsonl');
const V2_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v2.jsonl');
const V3_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v3.jsonl');
const CALIBRATION_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-behavioral-fit.json');

const REPLAY_FILES = [
  'source/analysis/archive/replays/pmuy78xu6tsths9.json',
  'source/analysis/archive/replays/pmv16kj3jr35750.json',
  'source/analysis/archive/replays/pmv2gaa0g00eq3q.json',
  'source/analysis/archive/replays/pmv6yhzz3x9oxs8.json'
];

const CODE_SOURCES = [
  'source/tools/sim/refit/generate_personal_witness_v3.js',
  'source/tools/sim/refit/personal_witness_simulation.js',
  'source/tools/sim/refit/personal_behavioral_calibration.js',
  'source/tools/sim/refit/production_physical_session.js',
  'source/tools/sim/refit/personal_observed_memory.js',
  'source/tools/sim/refit/public_witness_search.js',
  'source/tools/sim/refit/public_witness_reference.js',
  'source/tools/sim/refit/personal_model.js',
  'source/tools/sim/refit/boards.js',
  'source/tools/sim/refit/human_decision_dataset.js',
  'source/tools/sim/refit/known_tray_plan.js',
  'source/tools/sim/refit/public_dead_end.js',
  'source/www/hard.js',
  'source/www/layouts.js'
];

function computeSourceClosureHashes() {
  const hashes = {};
  const allFiles = [...CODE_SOURCES, 'source/analysis/personal-bots/personal-behavioral-fit.json', ...REPLAY_FILES];
  for (const rel of allFiles) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) {
      hashes[rel] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  }
  return hashes;
}

/**
 * Agreed scoring correctness function S(p, a)
 */
function score(p, a) {
  if (a >= 8 && p >= 8) return 1;
  if (a <= 3) return p === a ? 1 : 0;
  if (a <= 5) return Math.abs(p - a) <= 1 ? 1 : 0;
  return Math.abs(p - a) <= 2 ? 1 : 0;
}

/**
 * Derives Bayes-optimal point forecast maximizing expected correctness under agreed scoring metric.
 * Tie-breaking rule: choose candidate closest to mode; if still tied, choose minimum p.
 */
function derivePointForecast(dist) {
  let maxScore = -1;
  let bestCandidates = [];

  // Find mode of distribution
  let modeAttempt = 1;
  let modeProb = -1;
  for (let a = 1; a <= 8; a++) {
    const prob = dist[`try${a}`] || 0;
    if (prob > modeProb) {
      modeProb = prob;
      modeAttempt = a;
    }
  }
  if ((dist.noClear || 0) > modeProb) {
    modeAttempt = 8;
  }

  for (let p = 1; p <= 8; p++) {
    let expected = 0;
    for (let a = 1; a <= 8; a++) {
      expected += (dist[`try${a}`] || 0) * score(p, a);
    }
    expected += (dist.noClear || 0) * score(p, 8);

    if (expected > maxScore + 1e-9) {
      maxScore = expected;
      bestCandidates = [p];
    } else if (Math.abs(expected - maxScore) <= 1e-9) {
      bestCandidates.push(p);
    }
  }

  // Frozen tie-breaking: closest to mode, then min p
  bestCandidates.sort((a, b) => {
    const distA = Math.abs(a - modeAttempt);
    const distB = Math.abs(b - modeAttempt);
    if (distA !== distB) return distA - distB;
    return a - b;
  });

  return { predictedAttempt: bestCandidates[0], expectedScore: +(maxScore.toFixed(4)) };
}

if (!isMainThread && workerData?.isWorker) {
  const { designed } = require('./boards.js');
  const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
  const { publicBoardId } = require('./personal_model.js');
  const numCampaigns = workerData.numCampaigns || 5;

  const results = [];
  for (const fc of workerData.tasks) {
    const game = designed(fc.version || '1.55', fc.lv);
    if (!game) {
      results.push({
        ...fc,
        predictedAttempt: 4,
        wonOn: null,
        campaignDistribution: { noClear: 1.0 },
        unreconstructable: true
      });
      continue;
    }

    const pubId = publicBoardId(game);
    const baseSeed = crypto.createHash('sha256')
      .update([fc.name, fc.lv, pubId, 'campaign_seed_v3'].join('|'))
      .digest().readUInt32LE(0);

    const campaignResults = [];
    for (let m = 0; m < numCampaigns; m++) {
      const campSeed = (baseSeed + m * 7919) >>> 0;
      const sim = simulatePersonalCampaign(game, fc.name, {
        maxAttempts: 8,
        seed: campSeed,
        cutoffTime: workerData.cutoffTime,
        campaign: `v3_${fc.name}_L${fc.lv}_c${m}`
      });
      campaignResults.push({
        wonOn: sim.wonOn,
        totalAttempts: sim.totalAttempts,
        cleared: sim.wonOn !== null
      });
    }

    // Build distribution
    const dist = { noClear: 0 };
    for (let a = 1; a <= 8; a++) dist[`try${a}`] = 0;

    for (const cr of campaignResults) {
      if (cr.wonOn === null) dist.noClear += 1.0 / numCampaigns;
      else dist[`try${cr.wonOn}`] += 1.0 / numCampaigns;
    }

    for (const k of Object.keys(dist)) {
      dist[k] = +(dist[k].toFixed(4));
    }

    // Monte Carlo stability: difference between first half and second half
    const half = Math.floor(numCampaigns / 2);
    let maxDiff = 0;
    if (half > 0) {
      const h1 = campaignResults.slice(0, half);
      const h2 = campaignResults.slice(half);
      for (let a = 1; a <= 8; a++) {
        const p1 = h1.filter(r => r.wonOn === a).length / h1.length;
        const p2 = h2.filter(r => r.wonOn === a).length / h2.length;
        maxDiff = Math.max(maxDiff, Math.abs(p1 - p2));
      }
    }

    const { predictedAttempt, expectedScore } = derivePointForecast(dist);

    results.push({
      name: fc.name,
      lv: fc.lv,
      version: fc.version || '1.55',
      board: fc.board,
      publicBoardId: pubId,
      modelId: 'source-bound-personal-witness-v3',
      actorSha256: crypto.createHash('sha256').update(JSON.stringify(fc.name)).digest('hex'),
      featureSource: 'production-physical-simulation-pipeline',
      predictedAttempt,
      expectedCorrectness: expectedScore,
      campaignCount: numCampaigns,
      campaignDistribution: dist,
      mcStabilityDelta: +(maxDiff.toFixed(3)),
      clearedFraction: +( (campaignResults.filter(r => r.cleared).length / numCampaigns).toFixed(3) )
    });

    if (parentPort) {
      parentPort.postMessage({
        type: 'progress',
        name: fc.name,
        lv: fc.lv,
        pred: predictedAttempt,
        dist
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
  // Refuse before calibration or worker launch. Registered candidates are evidence,
  // including their failures; improvements require a distinct candidate/version.
  assertUnregistered(V3_PATH);
  const { calibrateAll } = require('./personal_behavioral_calibration.js');
  console.log('Calibrating all player parameters from historical recordings...');
  const calibration = calibrateAll(CALIBRATION_PATH);

  const v1Content = fs.readFileSync(V1_PATH, 'utf8').trim().split('\n');
  const v1Anchor = JSON.parse(v1Content[0]);
  const tasks = v1Anchor.forecasts;
  console.log(`Loaded ${tasks.length} tasks from V1 ledger.`);

  const cutoffTime = v1Anchor.cohortStartsAfter;
  const numWorkers = 6;
  const chunks = Array.from({ length: numWorkers }, () => []);
  tasks.forEach((task, idx) => chunks[idx % numWorkers].push(task));

  console.log(`Dispatching ${tasks.length} simulation tasks across ${numWorkers} worker threads (5 campaigns per task)...`);
  const promises = chunks.map((workerTasks, workerId) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          isWorker: true,
          tasks: workerTasks,
          cutoffTime,
          numCampaigns: 5
        }
      });
      let completedResults = null;
      worker.on('message', msg => {
        if (msg.type === 'progress') {
          process.stdout.write(`[W${workerId}] ${msg.name} L${msg.lv} -> pred:${msg.pred}\n`);
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

  const v3Anchor = {
    frozenAt: nowMs,
    made: new Date().toISOString(),
    model: 'source-bound-personal-witness-v3',
    scope: 'first-clear-progression-v3',
    targetMet: false,
    experimental: true,
    progressionStartLevels: v1Anchor.progressionStartLevels,
    cohortStartsAfter: v1Anchor.cohortStartsAfter,
    legacyLedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V1_PATH)).digest('hex'),
    v2LedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V2_PATH)).digest('hex'),
    quantitativeSourceHashes: sourceHashes,
    forecasts: orderedForecasts,
    note: 'Model v3 forecasts derived genuinely from multiple simulated campaigns of personal behavioral bots playing through production Hard. Forgetting applied in one persistent layer; RNG seeds independent of concealed pictures; point forecasts derived from campaign attempt distributions via Bayes expected scoring maximization under the agreed metric. All sources, generator, calibration inputs and replay files bound in source closure.'
  };

  registerNewLedger(V3_PATH, v3Anchor);
  console.log(`SUCCESS: Wrote v3 ledger to ${V3_PATH} with ${orderedForecasts.length} forecasts.`);
}

function assertUnregistered(filename) {
  if (fs.existsSync(filename)) throw new Error(`Refusing to overwrite registered candidate: ${filename}. Use a new model version and future cohort.`);
}

function registerNewLedger(filename, anchor) {
  // Exclusive creation also closes the race between the early check and writing.
  fs.writeFileSync(filename, JSON.stringify(anchor) + '\n', { flag: 'wx', encoding: 'utf8' });
}

module.exports = { computeSourceClosureHashes, derivePointForecast, score, assertUnregistered, registerNewLedger };
