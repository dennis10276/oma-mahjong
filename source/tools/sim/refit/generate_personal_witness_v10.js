'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { register } = require('./register_personal_candidate.js');
const { designed } = require('./boards.js');
const { boardId, publicBoardId, NAMES } = require('./personal_model.js');

const ROOT = path.resolve(__dirname, '../../../..');
const DRAFT_V10_PATH = path.join(ROOT, 'source/analysis/personal-bots/draft-personal-source-bound-causal-forecasts-v10.json');
const CALIBRATION_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-behavioral-fit.json');

// Explicit Block 2 prospective frontiers following Block 1 20-level cohorts
const V10_FRONTIERS = Object.freeze({
  'Dennisisdebeste': 178,
  'Mrs. Doubtfire': 147,
  'PUK': 79,
  'Gerda': 130
});

const REPLAY_FILES = [
  'source/analysis/archive/replays/pmuy78xu6tsths9.json',
  'source/analysis/archive/replays/pmv16kj3jr35750.json',
  'source/analysis/archive/replays/pmv2gaa0g00eq3q.json',
  'source/analysis/archive/replays/pmv6yhzz3x9oxs8.json'
];

const CODE_SOURCES = [
  'source/tools/sim/refit/generate_personal_witness_v10.js',
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
  'source/tools/sim/refit/register_personal_candidate.js',
  'source/tools/sim/refit/independent_tray_metrics.js',
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

function generateTargets() {
  const targets = [];
  for (const name of NAMES) {
    const startLv = V10_FRONTIERS[name];
    for (let offset = 0; offset < 20; offset++) {
      const lv = startLv + offset;
      const game = designed('1.55', lv);
      if (!game) throw new Error(`Missing designed board for ${name} at L${lv}`);
      targets.push({
        name,
        lv,
        version: '1.55',
        board: boardId(game),
        publicBoardId: publicBoardId(game)
      });
    }
  }
  return targets;
}

function score(p, a) {
  if (p >= 8 && a >= 8) return 1;
  if (a <= 3) return p === a ? 1 : 0;
  if (a <= 5) return Math.abs(p - a) <= 1 ? 1 : 0;
  return Math.abs(p - a) <= 2 ? 1 : 0;
}

/**
 * Derives point forecast maximizing expected score under Voorspeltest tolerance bands.
 * Correctly attributes noClear only to p >= 8.
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
    // Corrected invariant: uncleared campaigns only score for p >= 8
    s += (dist.noClear || 0) * (p >= 8 ? 1 : 0);
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

if (!isMainThread && workerData && workerData.isWorker) {
  const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
  const tasks = workerData.tasks;
  const campaignsPerTarget = workerData.campaignsPerTarget || 8;
  const results = [];

  for (const t of tasks) {
    const game = designed(t.version, t.lv);
    const pubId = publicBoardId(game);
    const baseSeed = crypto.createHash('sha256')
      .update([t.name, t.lv, pubId, 'v10_candidate'].join('|'))
      .digest().readUInt32LE(0);

    const campaignResults = [];
    for (let m = 0; m < campaignsPerTarget; m++) {
      const campSeed = (baseSeed + m * 7919) >>> 0;
      const sim = simulatePersonalCampaign(game, t.name, {
        maxAttempts: 8,
        seed: campSeed,
        campaign: `v10_${t.name}_L${t.lv}_c${m}`
      });

      campaignResults.push({
        seed: campSeed,
        wonOn: sim.wonOn,
        history: sim.history.map(h => ({
          attempt: h.attempt,
          status: h.status,
          moves: h.moves,
          physicalTaps: h.physicalTaps,
          why: h.why,
          win: h.win
        }))
      });
    }

    const exactDist = { noClear: 0 };
    for (let a = 1; a <= 8; a++) exactDist[`try${a}`] = 0;
    for (const c of campaignResults) {
      if (c.wonOn === null) exactDist.noClear += 1.0 / campaignsPerTarget;
      else exactDist[`try${c.wonOn}`] += 1.0 / campaignsPerTarget;
    }

    const { predictedAttempt, expectedScore } = derivePointForecast(exactDist);

    results.push({
      target: t,
      predictedAttempt,
      expectedScore,
      campaignDistribution: exactDist,
      campaigns: campaignResults
    });
  }

  if (parentPort) {
    parentPort.postMessage({ type: 'done', results });
  }
}

async function generateCandidateDraft(outputDraftPath = DRAFT_V10_PATH, numWorkers = 8, campaignsPerTarget = 8) {
  if (typeof outputDraftPath === 'number') {
    campaignsPerTarget = typeof numWorkers === 'number' ? numWorkers : 8;
    numWorkers = outputDraftPath;
    outputDraftPath = DRAFT_V10_PATH;
  }
  const targets = generateTargets();
  const sourceClosure = computeSourceClosureHashes();
  const { calibrateAll } = require('./personal_behavioral_calibration.js');
  const calibrationResults = calibrateAll(CALIBRATION_PATH);

  const chunks = Array.from({ length: numWorkers }, () => []);
  targets.forEach((t, i) => chunks[i % numWorkers].push(t));

  console.log(`Starting v10 multi-campaign generation across ${numWorkers} worker threads...`);
  const t0 = Date.now();

  const promises = chunks.map((workerTasks, workerId) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          isWorker: true,
          tasks: workerTasks,
          campaignsPerTarget
        }
      });
      let completedResults = null;
      worker.on('message', msg => {
        if (msg.type === 'done') completedResults = msg.results;
      });
      worker.on('error', reject);
      worker.on('exit', code => {
        if (code !== 0) reject(new Error(`Worker ${workerId} exited with code ${code}`));
        else resolve(completedResults);
      });
    });
  });

  const allNested = await Promise.all(promises);
  const flattened = allNested.flat();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Simulation finished in ${elapsed}s for ${flattened.length} target boards.`);

  const orderedForecasts = [];
  for (const t of targets) {
    const item = flattened.find(x => x.target.name === t.name && x.target.lv === t.lv);
    if (!item) throw new Error(`Missing simulation result for target ${t.name} L${t.lv}`);
    orderedForecasts.push({
      name: t.name,
      lv: t.lv,
      version: t.version,
      board: t.board,
      publicBoardId: t.publicBoardId,
      modelId: 'source-bound-personal-witness-v10',
      predictedAttempt: item.predictedAttempt,
      expectedCorrectness: item.expectedScore,
      campaignCount: campaignsPerTarget,
      campaignDistribution: item.campaignDistribution,
      campaignRecords: item.campaigns
    });
  }

  const draft = {
    schemaVersion: '1.0',
    model: 'source-bound-personal-witness-v10',
    generatedAt: new Date().toISOString(),
    sourceClosure,
    calibrationSummary: calibrationResults,
    forecasts: orderedForecasts
  };

  fs.mkdirSync(path.dirname(outputDraftPath), { recursive: true });
  fs.writeFileSync(outputDraftPath, JSON.stringify(draft, null, 2) + '\n', 'utf8');
  console.log(`SUCCESS: Wrote v10 candidate draft to ${outputDraftPath} (${orderedForecasts.length} forecasts).`);
  return draft;
}

module.exports = {
  generateTargets,
  generateCandidateDraft,
  computeSourceClosureHashes,
  derivePointForecast,
  score,
  V10_FRONTIERS
};

if (isMainThread && require.main === module) {
  generateCandidateDraft().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

