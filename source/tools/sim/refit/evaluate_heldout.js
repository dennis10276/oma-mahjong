'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { designed, classic } = require('./boards.js');
const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
const ForecastScore = require('./official_forecast_score.js');

const ROOT = path.resolve(__dirname, '../../../..');
const PLAYS_PATH = path.join(ROOT, 'source/analysis/archive/realdata/plays.json');
const FITS_PATH = path.join(ROOT, 'source/analysis/personal-bots/personal-behavioral-fit.json');
const BENCHMARK_OUT = path.join(ROOT, 'source/analysis/personal-bots/heldout-benchmark-v10.json');

const plays = JSON.parse(fs.readFileSync(PLAYS_PATH, 'utf8'));
const fits = JSON.parse(fs.readFileSync(FITS_PATH, 'utf8'));

const COHORTS = {
  'Mrs. Doubtfire': {
    name: 'Mrs. Doubtfire',
    pid: 'pmv16kj3jr35750',
    start: 107,
    end: 126,
    aspect: 1.6
  },
  'Dennisisdebeste': {
    name: 'Dennisisdebeste',
    pid: 'pmuy78xu6tsths9',
    start: 138,
    end: 157,
    aspect: 1.5
  },
  'PUK': {
    name: 'PUK',
    pid: 'pmv2gaa0g00eq3q',
    start: 39,
    end: 58,
    aspect: 1.0
  },
  'Gerda': {
    name: 'Gerda',
    pid: 'pmv6yhzz3x9oxs8',
    start: 90,
    end: 109,
    aspect: 1.4
  }
};

/**
 * Derives the point forecast p in {1..8} that maximizes expected score
 * under official Voorspeltest tolerance bands.
 * Crucially: noClear corresponds to attempts >= 9 or incomplete;
 * under official scoring, only p >= 8 satisfies both >= 8.
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
      s += (dist[`try${a}`] || 0) * (ForecastScore.correct(p, a) ? 1 : 0);
    }
    // CORRECT OBJECTIVE FUNCTION: only p >= 8 scores for noClear
    s += (dist.noClear || 0) * (p >= 8 ? 1 : 0);
    scores[p] = s;
    if (s > bestScore) bestScore = s;
  }

  // Tie-breaking: closest to mode, then lower p
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

// ============================================================================
// WORKER THREAD LOGIC (Dynamic Task Consumer)
// ============================================================================
if (!isMainThread) {
  parentPort.on('message', msg => {
    if (msg.type === 'task') {
      const t = msg.task;
      const game = designed('1.55', t.lv) || classic(t.lv, t.aspect || 1.5);
      const campaignResults = [];
      const numCampaigns = t.campaigns || 6;

      for (let m = 0; m < numCampaigns; m++) {
        const campSeed = (10007 * t.lv + m * 7919) >>> 0;
        const sim = simulatePersonalCampaign(game, t.name, {
          maxAttempts: 8,
          seed: campSeed,
          campaign: `eval_${t.name}_L${t.lv}_c${m}`,
          customParams: t.customParams
        });
        campaignResults.push(sim.wonOn);
      }

      const count = campaignResults.length;
      const exactDist = { noClear: 0 };
      for (let a = 1; a <= 8; a++) exactDist[`try${a}`] = 0;
      for (const w of campaignResults) {
        if (w === null) exactDist.noClear += 1.0 / count;
        else exactDist[`try${w}`] += 1.0 / count;
      }

      const { predictedAttempt, expectedScore } = derivePointForecast(exactDist);
      parentPort.postMessage({
        type: 'result',
        result: {
          name: t.name,
          lv: t.lv,
          predictedAttempt,
          expectedScore,
          exactDist,
          campaignResults
        }
      });
    } else if (msg.type === 'exit') {
      process.exit(0);
    }
  });
} else if (require.main === module) {
  main().catch(console.error);
}

// ============================================================================
// MAIN THREAD SCHEDULER & BENCHMARK RUNNER
// ============================================================================
async function executeDynamicQueue(tasks, numWorkers) {
  return new Promise((resolve, reject) => {
    const queue = [...tasks];
    const results = [];
    let completed = 0;
    const total = tasks.length;
    let activeWorkers = 0;

    const workers = [];
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(__filename);
      workers.push(worker);
      activeWorkers++;

      worker.on('message', msg => {
        if (msg.type === 'result') {
          results.push(msg.result);
          completed++;
          process.stdout.write(`\rProgress: [${completed}/${total}] levels simulated (${((completed / total) * 100).toFixed(0)}%)`);
          if (queue.length > 0) {
            worker.postMessage({ type: 'task', task: queue.shift() });
          } else {
            worker.postMessage({ type: 'exit' });
          }
        }
      });

      worker.on('error', err => {
        reject(err);
      });

      worker.on('exit', code => {
        activeWorkers--;
        if (activeWorkers === 0) {
          process.stdout.write('\n');
          resolve(results);
        }
      });

      if (queue.length > 0) {
        worker.postMessage({ type: 'task', task: queue.shift() });
      } else {
        worker.postMessage({ type: 'exit' });
      }
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  let requestedPlayer = null;
  let customWorkers = null;
  let campaignsPerLevel = 6;

  for (const arg of args) {
    if (arg.startsWith('--player=')) {
      requestedPlayer = arg.split('=')[1];
    } else if (arg.startsWith('--cohort=')) {
      requestedPlayer = arg.split('=')[1];
    } else if (arg.startsWith('--workers=')) {
      customWorkers = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--campaigns=')) {
      campaignsPerLevel = parseInt(arg.split('=')[1], 10);
    }
  }

  // Resolve target cohorts
  let targetCohorts = Object.values(COHORTS);
  if (requestedPlayer) {
    const norm = requestedPlayer.toLowerCase();
    const matched = Object.values(COHORTS).find(c =>
      c.name.toLowerCase() === norm ||
      c.name.toLowerCase().includes(norm) ||
      c.pid === requestedPlayer
    );
    if (!matched) {
      console.error(`Unknown player or cohort: ${requestedPlayer}`);
      console.error(`Available: ${Object.keys(COHORTS).join(', ')}`);
      process.exit(1);
    }
    targetCohorts = [matched];
  }

  // Build task list
  const tasks = [];
  for (const cohort of targetCohorts) {
    const params = fits.players[cohort.name]?.parameters;
    for (let lv = cohort.start; lv <= cohort.end; lv++) {
      tasks.push({
        name: cohort.name,
        pid: cohort.pid,
        lv,
        aspect: cohort.aspect,
        campaigns: campaignsPerLevel,
        customParams: params
      });
    }
  }

  const numWorkers = customWorkers || Math.min(10, Math.max(4, Math.floor(os.cpus().length / 2)));
  console.log(`================================================================================`);
  console.log(`HELD-OUT BENCHMARK (Candidate Model v10)`);
  console.log(`Cohorts: ${targetCohorts.map(c => `${c.name} (L${c.start}..${c.end})`).join(', ')}`);
  console.log(`Total Tasks: ${tasks.length} | Worker Threads: ${numWorkers} (Dynamic Queueing)`);
  console.log(`Campaigns per Level: ${campaignsPerLevel} | Max Attempts: 8`);
  console.log(`================================================================================\n`);

  const t0 = Date.now();
  const rawResults = await executeDynamicQueue(tasks, numWorkers);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Simulated ${rawResults.length} levels in ${elapsed}s (${(tasks.length / (elapsed || 1)).toFixed(2)} levels/sec).\n`);

  // Evaluate each cohort
  const benchmarkReport = {
    evaluatedAt: new Date().toISOString(),
    model: 'v10',
    elapsedSeconds: +elapsed,
    campaignsPerLevel,
    cohorts: {},
    aggregate: { totalLevels: 0, botCorrect: 0, baseCorrect: 0, margin: 0 }
  };

  for (const cohort of targetCohorts) {
    const ev = Object.values(plays[cohort.pid] || {}).filter(e => e && e.t).sort((a, b) => a.t - b.t);
    const cohortResults = rawResults.filter(r => r.name === cohort.name).sort((a, b) => a.lv - b.lv);

    let botOk = 0;
    let baseOk = 0;
    let completedLevels = 0;
    const rows = [];

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Cohort: ${cohort.name} (Levels ${cohort.start}..${cohort.end}) [PID: ${cohort.pid}]`);
    console.log(`Parameters: ${JSON.stringify(fits.players[cohort.name]?.parameters)}`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Level | Actual | Bot Pred | Base Pred | Bot OK | Base OK | Try Distribution`);
    console.log(`------+--------+----------+-----------+--------+---------+---------------------`);

    for (const r of cohortResults) {
      const o = ForecastScore.outcome(ev, r.lv);
      if (o.winAt != null) {
        completedLevels++;
        const isBot = ForecastScore.correct(r.predictedAttempt, o.winAt);
        const isBase = ForecastScore.correct(1, o.winAt);
        if (isBot) botOk++;
        if (isBase) baseOk++;

        const distStr = `1:${(r.exactDist.try1 || 0).toFixed(2)} 2:${(r.exactDist.try2 || 0).toFixed(2)} 3:${(r.exactDist.try3 || 0).toFixed(2)} 4:${(r.exactDist.try4 || 0).toFixed(2)} noClr:${(r.exactDist.noClear || 0).toFixed(2)}`;
        console.log(
          `L${r.lv}`.padEnd(6) + '| ' +
          String(o.winAt).padEnd(7) + '| ' +
          String(r.predictedAttempt).padEnd(9) + '| ' +
          '1'.padEnd(10) + '| ' +
          (isBot ? 'YES ' : 'no  ').padEnd(7) + '| ' +
          (isBase ? 'YES ' : 'no  ').padEnd(8) + '| ' +
          distStr
        );

        rows.push({
          level: r.lv,
          actualWinAt: o.winAt,
          predictedAttempt: r.predictedAttempt,
          botCorrect: isBot,
          baseCorrect: isBase,
          exactDist: r.exactDist
        });
      } else {
        console.log(`L${r.lv}`.padEnd(6) + '| ' + 'UNFINISHED'.padEnd(7) + '| ' + String(r.predictedAttempt).padEnd(9) + '| ' + '1'.padEnd(10) + '| (excluded from historical benchmark)');
      }
    }

    const botPct = ((botOk / completedLevels) * 100).toFixed(1);
    const basePct = ((baseOk / completedLevels) * 100).toFixed(1);
    const margin = botOk - baseOk;

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`SUMMARY for ${cohort.name}:`);
    console.log(`  Candidate v10: ${botOk} / ${completedLevels} (${botPct}%)`);
    console.log(`  Always 1:      ${baseOk} / ${completedLevels} (${basePct}%)`);
    console.log(`  Margin:        ${margin >= 0 ? '+' : ''}${margin} levels (${margin >= 0 ? '+' : ''}${((botOk - baseOk) / completedLevels * 100).toFixed(1)}%)`);
    console.log(`  Verdict:       ${margin > 0 ? '✓ BEATS BASELINE' : margin === 0 ? '= TIES BASELINE' : '✗ LOSES TO BASELINE'}\n`);

    benchmarkReport.cohorts[cohort.name] = {
      completedLevels,
      botCorrect: botOk,
      baseCorrect: baseOk,
      botPercentage: +botPct,
      basePercentage: +basePct,
      margin,
      beatsBaseline: margin > 0,
      rows
    };

    benchmarkReport.aggregate.totalLevels += completedLevels;
    benchmarkReport.aggregate.botCorrect += botOk;
    benchmarkReport.aggregate.baseCorrect += baseOk;
  }

  // Aggregate scorecard
  const aggTotal = benchmarkReport.aggregate.totalLevels;
  const aggBot = benchmarkReport.aggregate.botCorrect;
  const aggBase = benchmarkReport.aggregate.baseCorrect;
  const aggMargin = aggBot - aggBase;
  benchmarkReport.aggregate.margin = aggMargin;
  benchmarkReport.aggregate.botPercentage = +(((aggBot / aggTotal) * 100).toFixed(1));
  benchmarkReport.aggregate.basePercentage = +(((aggBase / aggTotal) * 100).toFixed(1));

  console.log(`================================================================================`);
  console.log(`OVERALL MULTI-COHORT SCORECARD (Candidate Model v10)`);
  console.log(`================================================================================`);
  console.log(`  Total Completed Levels: ${aggTotal}`);
  console.log(`  Candidate v10 Total:   ${aggBot} / ${aggTotal} (${benchmarkReport.aggregate.botPercentage}%)`);
  console.log(`  Always 1 Total:        ${aggBase} / ${aggTotal} (${benchmarkReport.aggregate.basePercentage}%)`);
  console.log(`  Aggregate Margin:      ${aggMargin >= 0 ? '+' : ''}${aggMargin} levels (+${((aggMargin / aggTotal) * 100).toFixed(1)}%)`);
  console.log(`================================================================================`);

  // Write benchmark results artifact
  fs.writeFileSync(BENCHMARK_OUT, JSON.stringify(benchmarkReport, null, 2), 'utf8');
  console.log(`Saved benchmark results to ${BENCHMARK_OUT}`);
}

module.exports = { derivePointForecast, COHORTS };
