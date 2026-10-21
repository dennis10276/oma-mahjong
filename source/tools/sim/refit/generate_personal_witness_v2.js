'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ROOT = path.resolve(__dirname, '../../../..');
const V1_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts.jsonl');
const V2_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v2.jsonl');
const CALIBRATION_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-behavioral-fit.json');

const SOURCES = [
  'source/tools/sim/refit/personal_witness_simulation.js',
  'source/tools/sim/refit/personal_behavioral_calibration.js',
  'source/tools/sim/refit/production_physical_session.js',
  'source/tools/sim/refit/personal_observed_memory.js',
  'source/tools/sim/refit/public_witness_search.js',
  'source/tools/sim/refit/public_witness_reference.js',
  'source/www/hard.js',
  'source/www/layouts.js',
  'source/tools/sim/refit/boards.js'
];

function computeHashes() {
  const hashes = {};
  for (const rel of SOURCES) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) {
      hashes[rel] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  }
  return hashes;
}

if (!isMainThread && workerData?.isWorker) {
  const { designed } = require('./boards.js');
  const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
  const results = [];
  for (const fc of workerData.tasks) {
    const game = designed(fc.version || '1.55', fc.lv);
    if (!game) {
      results.push({ ...fc, predictedAttempt: 4, wonOn: null });
      continue;
    }
    const sim = simulatePersonalCampaign(game, fc.name, {
      maxAttempts: 8,
      cutoffTime: workerData.cutoffTime
    });
    const pred = sim.wonOn ?? 8;
    results.push({
      name: fc.name,
      lv: fc.lv,
      version: fc.version || '1.55',
      board: fc.board,
      modelId: 'source-bound-personal-witness-v2',
      actorSha256: crypto.createHash('sha256').update(JSON.stringify(sim.parameters)).digest('hex'),
      featureSource: 'production-physical-simulation-pipeline',
      predictedAttempt: pred,
      cleared: sim.wonOn !== null,
      totalAttempts: sim.totalAttempts,
      calibratedParameters: sim.parameters
    });
    if (parentPort) {
      parentPort.postMessage({ type: 'progress', name: fc.name, lv: fc.lv, pred, cleared: sim.wonOn !== null });
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
  const { calibrateAll } = require('./personal_behavioral_calibration.js');
  console.log('Calibrating all player parameters from historical recordings...');
  const calibration = calibrateAll(CALIBRATION_PATH);

  const v1Content = fs.readFileSync(V1_PATH, 'utf8').trim().split('\n');
  const v1Anchor = JSON.parse(v1Content[0]);
  const tasks = v1Anchor.forecasts;
  console.log(`Loaded ${tasks.length} tasks from V1 ledger.`);

  const cutoffTime = v1Anchor.cohortStartsAfter;
  const numWorkers = 4;
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
          process.stdout.write(`[W${workerId}] ${msg.name} L${msg.lv} -> pred:${msg.pred} (cleared:${msg.cleared})\n`);
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

  const sourceHashes = computeHashes();
  const nowMs = Date.now();

  const v2Anchor = {
    frozenAt: nowMs,
    made: new Date().toISOString(),
    model: 'source-bound-personal-witness-v2',
    scope: 'first-clear-progression-v2',
    targetMet: false,
    experimental: true,
    progressionStartLevels: v1Anchor.progressionStartLevels,
    cohortStartsAfter: v1Anchor.cohortStartsAfter,
    legacyLedgerSha256: crypto.createHash('sha256').update(fs.readFileSync(V1_PATH)).digest('hex'),
    quantitativeSourceHashes: sourceHashes,
    forecasts: orderedForecasts,
    note: 'Model v2 forecasts produced by running simulatePersonalCampaign through production Hard with calibrated parameters, observed retry memory, and public witness search without concealed lookahead. Unopened tasks remain sealed for genuine prospective evaluation.'
  };

  fs.writeFileSync(V2_PATH, JSON.stringify(v2Anchor) + '\n', 'utf8');
  console.log(`SUCCESS: Wrote v2 ledger to ${V2_PATH} with ${orderedForecasts.length} forecasts.`);
}

module.exports = { computeHashes };
