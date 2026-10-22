'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { designed } = require('./boards.js');
const { boardId, publicBoardId } = require('./personal_model.js');
const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
const { derivePointForecast, score } = require('./generate_personal_witness_v8.js');

const TARGETS = {
  Dennisisdebeste: { pid: 'pmuy78xu6tsths9', start: 158, count: 20 },
  'Mrs. Doubtfire': { pid: 'pmv16kj3jr35750', start: 127, count: 20 },
  PUK: { pid: 'pmv2gaa0g00eq3q', start: 59, count: 20 },
  Gerda: { pid: 'pmv6yhzz3x9oxs8', start: 110, count: 20 }
};

function generateTargetList() {
  const list = [];
  for (const [name, cfg] of Object.entries(TARGETS)) {
    for (let i = 0; i < cfg.count; i++) {
      const lv = cfg.start + i;
      const game = designed('1.55', lv);
      if (!game) throw new Error(`Missing layout for ${name} L${lv}`);
      list.push({
        name,
        pid: cfg.pid,
        lv,
        version: '1.55',
        board: boardId(game),
        publicBoardId: publicBoardId(game)
      });
    }
  }
  return list;
}

if (!isMainThread && workerData && workerData.isWorker) {
  const tasks = workerData.tasks;
  const fixedCampaignCount = workerData.campaignsPerTarget || 8;
  const results = [];

  for (const t of tasks) {
    const game = designed(t.version, t.lv);
    const pubId = publicBoardId(game);
    const baseSeed = crypto.createHash('sha256')
      .update([t.name, t.lv, pubId, 'block1_lock'].join('|'))
      .digest().readUInt32LE(0);

    const campaignResults = [];
    for (let m = 0; m < fixedCampaignCount; m++) {
      const campSeed = (baseSeed + m * 7919) >>> 0;
      const sim = simulatePersonalCampaign(game, t.name, {
        maxAttempts: 8,
        seed: campSeed,
        campaign: `block1_${t.name}_L${t.lv}_c${m}`
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
      name: t.name,
      pid: t.pid,
      lv: t.lv,
      version: t.version,
      board: t.board,
      publicBoardId: pubId,
      predictedAttempt,
      expectedCorrectness: expectedScore,
      campaignCount: count,
      campaignDistribution: dist,
      campaignResults,
      clearedFraction: +((campaignResults.filter(r => r.wonOn !== null).length / count).toFixed(3))
    });
  }

  if (parentPort) parentPort.postMessage({ type: 'done', results });
} else if (require.main === module) {
  run().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}

async function run() {
  const targets = generateTargetList();
  console.log(`Prepared ${targets.length} target levels across 4 players (20 levels each).`);

  const numWorkers = 8;
  const chunks = Array.from({ length: numWorkers }, () => []);
  targets.forEach((t, i) => chunks[i % numWorkers].push(t));

  console.log(`Dispatching simulations across ${numWorkers} worker threads (8 campaigns per level)...`);
  const t0 = Date.now();

  const promises = chunks.map((workerTasks, workerId) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          isWorker: true,
          tasks: workerTasks,
          campaignsPerTarget: 8
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
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Simulation complete in ${elapsed}s! Processed ${allFlat.length} levels.`);

  const byPerson = {};
  for (const r of allFlat) {
    byPerson[r.name] = byPerson[r.name] || [];
    byPerson[r.name].push(r);
  }

  for (const [name, list] of Object.entries(byPerson)) {
    list.sort((a, b) => a.lv - b.lv);
    console.log(`\n=== ${name} (${list[0].pid}): levels ${list[0].lv}..${list[list.length-1].lv} ===`);
    const summary = list.map(r => `L${r.lv}: p=${r.predictedAttempt} (clear=${r.clearedFraction})`).join(' | ');
    console.log(summary);
  }

  // Save the full simulation output
  const outPath = path.resolve(__dirname, '../../../analysis/personal-bots/block1-simulation-results.json');
  fs.writeFileSync(outPath, JSON.stringify(allFlat, null, 2), 'utf8');
  console.log(`\nSaved full simulation results to ${outPath}`);
}

module.exports = { generateTargetList };
