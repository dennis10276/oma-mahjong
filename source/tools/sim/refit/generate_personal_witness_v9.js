'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { register } = require('./register_personal_candidate.js');
const { designed } = require('./boards.js');
const { boardId, publicBoardId, NAMES } = require('./personal_model.js');

const ROOT = path.resolve(__dirname, '../../../..');
const V1_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts.jsonl');
const V2_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v2.jsonl');
const V3_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v3.jsonl');
const V4_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v4.jsonl');
const V5_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v5.jsonl');
const V6_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v6.jsonl');
const V7_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v7.jsonl');
const V8_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v8.jsonl');
const DRAFT_V9_PATH = path.join(ROOT, 'source/analysis/personal-bots/draft-personal-source-bound-causal-forecasts-v9.json');
const CALIBRATION_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-behavioral-fit.json');

// Explicit new frontiers beyond all previously opened games in live archive
const V9_FRONTIERS = Object.freeze({
  'Dennisisdebeste': 157,
  'Mrs. Doubtfire': 114,
  'PUK': 59,
  'Gerda': 83
});

const REPLAY_FILES = [
  'source/analysis/archive/replays/pmuy78xu6tsths9.json',
  'source/analysis/archive/replays/pmv16kj3jr35750.json',
  'source/analysis/archive/replays/pmv2gaa0g00eq3q.json',
  'source/analysis/archive/replays/pmv6yhzz3x9oxs8.json'
];

const CODE_SOURCES = [
  'source/tools/sim/refit/generate_personal_witness_v9.js',
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

function score(p, a) {
  if (a >= 8 && p >= 8) return 1;
  if (a <= 3) return p === a ? 1 : 0;
  if (a <= 5) return Math.abs(p - a) <= 1 ? 1 : 0;
  return Math.abs(p - a) <= 2 ? 1 : 0;
}

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

function generateTargets() {
  const targets = [];
  for (const name of NAMES) {
    const startLv = V9_FRONTIERS[name];
    for (let i = 0; i < 20; i++) {
      const lv = startLv + i;
      const game = designed('1.55', lv);
      if (!game) throw new Error(`Missing layout for ${name} L${lv}`);
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

if (!isMainThread && workerData && workerData.isWorker) {
  const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
  const tasks = workerData.tasks;
  const results = [];
  const fixedCampaignCount = workerData.campaignsPerTarget || 8;

  for (const fc of tasks) {
    const game = designed(fc.version || '1.55', fc.lv);
    if (!game) throw new Error(`Board layout not found for ${fc.name} L${fc.lv}`);
    const pubId = publicBoardId(game);

    const baseSeed = crypto.createHash('sha256')
      .update([fc.name, fc.lv, pubId, 'seed_v9'].join('|'))
      .digest().readUInt32LE(0);

    const campaignResults = [];

    for (let m = 0; m < fixedCampaignCount; m++) {
      const campSeed = (baseSeed + m * 7919) >>> 0;
      const sim = simulatePersonalCampaign(game, fc.name, {
        maxAttempts: 8,
        seed: campSeed,
        campaign: `v9_${fc.name}_L${fc.lv}_c${m}`
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

    const count = campaignResults.length;
    const exactDist = { noClear: 0 };
    for (let a = 1; a <= 8; a++) exactDist[`try${a}`] = 0;
    for (const cr of campaignResults) {
      if (cr.wonOn === null) exactDist.noClear += 1.0 / count;
      else exactDist[`try${cr.wonOn}`] += 1.0 / count;
    }

    const { predictedAttempt, expectedScore } = derivePointForecast(exactDist);
    const dist = {};
    for (const k of Object.keys(exactDist)) dist[k] = +(exactDist[k].toFixed(4));

    results.push({
      name: fc.name,
      lv: fc.lv,
      version: fc.version || '1.55',
      board: fc.board,
      publicBoardId: pubId,
      modelId: 'source-bound-personal-witness-v9',
      actorSha256: crypto.createHash('sha256').update(JSON.stringify(fc.name)).digest('hex'),
      featureSource: 'production-physical-simulation-pipeline',
      predictedAttempt,
      expectedCorrectness: expectedScore,
      campaignCount: count,
      campaignDistribution: dist,
      campaignResults,
      clearedFraction: +( (campaignResults.filter(r => r.wonOn !== null).length / count).toFixed(3) )
    });
  }

  if (parentPort) parentPort.postMessage({ type: 'done', results });
} else if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}

async function generateCandidateDraft(outputDraftPath = DRAFT_V9_PATH, options = {}) {
  const { calibrateAll } = require('./personal_behavioral_calibration.js');
  if (!options.skipCalibration) {
    console.log('Calibrating behavioral parameters for candidate v9...');
    calibrateAll(CALIBRATION_PATH);
  }

  let targets = generateTargets();
  if (options.maxTargetsPerPlayer && options.maxTargetsPerPlayer > 0) {
    const subset = [];
    for (const name of NAMES) {
      subset.push(...targets.filter(t => t.name === name).slice(0, options.maxTargetsPerPlayer));
    }
    targets = subset;
  }
  console.log(`Generated ${targets.length} target tasks across 4 new frontiers:`, V9_FRONTIERS);

  const numWorkers = Math.min(8, targets.length);
  const chunks = Array.from({ length: numWorkers }, () => []);
  targets.forEach((task, idx) => chunks[idx % numWorkers].push(task));

  console.log(`Simulating campaigns across ${numWorkers} worker threads...`);
  const promises = chunks.map((workerTasks, workerId) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          isWorker: true,
          tasks: workerTasks,
          campaignsPerTarget: options.campaignsPerTarget || 8
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
  const allFlat = allNested.flat();
  const taskKey = t => `${t.name}_${t.lv}`;
  const resultMap = new Map(allFlat.map(r => [taskKey(r), r]));
  const orderedForecasts = targets.map(t => resultMap.get(taskKey(t)));

  const sourceHashes = computeSourceClosureHashes();
  const generationTime = Date.now();

  // Create DRAFT: MUST NOT contain frozenAt or cohortStartsAfter (per register_personal_candidate rules)
  const draft = {
    generatedAt: generationTime,
    made: new Date().toISOString(),
    model: 'source-bound-personal-witness-v9',
    generator: 'source/tools/sim/refit/generate_personal_witness_v9.js',
    scope: 'first-clear-progression-v9',
    progressionStartLevels: { ...V9_FRONTIERS },
    quantitativeSourceHashes: sourceHashes,
    forecasts: orderedForecasts,
    protocol: 'preregistered-sequential-or-fixed-budget-mc',
    note: 'Candidate v9 draft generated with explicit new progression frontiers, observed-memory ranking, and production physical simulation. Not frozen or backdated.'
  };

  fs.mkdirSync(path.dirname(outputDraftPath), { recursive: true });
  fs.writeFileSync(outputDraftPath, JSON.stringify(draft, null, 2) + '\n', 'utf8');
  console.log(`SUCCESS: Wrote v9 candidate draft to ${outputDraftPath} (${orderedForecasts.length} forecasts).`);
  return draft;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--register')) {
    const draftIdx = args.indexOf('--register') + 1;
    const draftFile = args[draftIdx] || DRAFT_V9_PATH;
    const liveFile = args[draftIdx + 1];
    const outputFile = args[draftIdx + 2];
    if (!liveFile || !outputFile) {
      throw new Error('Usage: node generate_personal_witness_v9.js --register DRAFT_FILE LIVE_FILE OUTPUT_LEDGER');
    }
    console.log(`Registering draft ${draftFile} with live file ${liveFile} to ${outputFile}...`);
    register(draftFile, liveFile, outputFile);
    console.log(`Registered new candidate ledger: ${outputFile}`);
  } else {
    await generateCandidateDraft();
  }
}

module.exports = {
  generateTargets,
  generateCandidateDraft,
  computeSourceClosureHashes,
  derivePointForecast,
  score,
  V9_FRONTIERS
};
