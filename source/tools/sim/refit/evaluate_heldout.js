'use strict';
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { designed } = require('./boards.js');
const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
const ForecastScore = require('./official_forecast_score.js');

const plays = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/archive/realdata/plays.json'), 'utf8'));

// Mrs. Doubtfire held-out cohort: levels 107..126 (20 levels)
const DOUBTFIRE_PID = 'pmv16kj3jr35750';
const ev = Object.values(plays[DOUBTFIRE_PID] || {}).filter(e => e && e.t).sort((a,b)=>a.t-b.t);

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
  if ((dist.noClear || 0) > maxTryProb) mode = 8;

  let bestP = 1;
  let bestScore = -1;
  for (let p = 1; p <= 8; p++) {
    let s = 0;
    for (let a = 1; a <= 8; a++) {
      s += (dist[`try${a}`] || 0) * (ForecastScore.correct(p, a) ? 1 : 0);
    }
    s += (dist.noClear || 0) * (ForecastScore.correct(p, 8) ? 1 : 0);
    if (s > bestScore) {
      bestScore = s;
      bestP = p;
    }
  }
  return { predictedAttempt: bestP, expectedScore: bestScore };
}

if (!isMainThread && workerData && workerData.isWorker) {
  const tasks = workerData.tasks;
  const results = [];
  for (const t of tasks) {
    const game = designed('1.55', t.lv);
    const campaignResults = [];
    for (let m = 0; m < 6; m++) {
      const campSeed = (10007 * t.lv + m * 7919) >>> 0;
      const sim = simulatePersonalCampaign(game, t.name, {
        maxAttempts: 8,
        seed: campSeed,
        campaign: `eval_${t.name}_L${t.lv}_c${m}`
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
    results.push({
      lv: t.lv,
      predictedAttempt,
      exactDist,
      campaignResults
    });
  }
  if (parentPort) parentPort.postMessage({ type: 'done', results });
} else if (require.main === module) {
  run().catch(console.error);
}

async function run() {
  const levels = [];
  for (let lv = 107; lv <= 126; lv++) levels.push({ lv, name: 'Mrs. Doubtfire' });

  const numWorkers = 5;
  const chunks = Array.from({ length: numWorkers }, () => []);
  levels.forEach((l, i) => chunks[i % numWorkers].push(l));

  console.log(`Evaluating Mrs. Doubtfire on held-out levels 107..126 across ${numWorkers} worker threads...`);
  const t0 = Date.now();

  const promises = chunks.map((workerTasks, workerId) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { isWorker: true, tasks: workerTasks }
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
  const results = allNested.flat().sort((a,b) => a.lv - b.lv);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Evaluated ${results.length} levels in ${elapsed}s.\n`);

  let botOk = 0;
  let baseOk = 0;
  let total = 0;

  console.log('Level | Actual | Bot Pred | Base Pred | Bot Correct | Base Correct | Dist (1, 2, 3, 4, 5, 8+)');
  console.log('-----------------------------------------------------------------------------------------');
  for (const r of results) {
    const o = ForecastScore.outcome(ev, r.lv);
    if (o.winAt != null) {
      total++;
      const isBot = ForecastScore.correct(r.predictedAttempt, o.winAt);
      const isBase = ForecastScore.correct(1, o.winAt);
      if (isBot) botOk++;
      if (isBase) baseOk++;
      const distStr = `1:${(r.exactDist.try1||0).toFixed(2)} 2:${(r.exactDist.try2||0).toFixed(2)} noClr:${(r.exactDist.noClear||0).toFixed(2)}`;
      console.log(
        `L${r.lv}`.padEnd(6) + '| ' +
        String(o.winAt).padEnd(7) + '| ' +
        String(r.predictedAttempt).padEnd(9) + '| ' +
        '1'.padEnd(10) + '| ' +
        (isBot ? 'YES' : 'no ').padEnd(12) + '| ' +
        (isBase ? 'YES' : 'no ').padEnd(13) + '| ' +
        distStr
      );
    }
  }
  console.log('-----------------------------------------------------------------------------------------');
  console.log(`Mrs. Doubtfire (levels 107..126):`);
  console.log(`  Bot score:    ${botOk} / ${total} (${(botOk/total*100).toFixed(1)}%)`);
  console.log(`  Always 1:     ${baseOk} / ${total} (${(baseOk/total*100).toFixed(1)}%)`);
  console.log(`  Old Model v8: 3 / 20 (15.0%)`);
}
