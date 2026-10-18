'use strict';
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { NAMES, CONFIG } = require('./personal_model.js');
const { outcomesOf } = require('./attempt_count.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const { rebuildFeatures } = require('./attempt_features.js');
const Hard = require('../../../www/hard.js');
const filename = path.resolve(__dirname, '../../../analysis/archive/personal-bots/attempt-count-data.json');
const PROFILES = {
  twoPictures: { shortMemory: 2 }, fourPictures: { shortMemory: 4 }, eightPictures: { shortMemory: 8 },
  fourPicturesNoRetryRecall: { shortMemory: 4, memory: [0, 0, 0] },
  fourPicturesMediumRetryRecall: { shortMemory: 4, memory: [0.5, 0.3, 0.5] },
};

function measure(tasks, runs) {
  const results = [];
  for (const task of tasks) {
    const base = { ...Hard.P, w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 })], allMoves: true,
      flips: true, kinds: { ...DEFAULT_KINDS, ...kindsAt(task.name, task.start) }, peek: 0, end: 12, plan: 10,
      memory: CONFIG.memory, learnFromLoss: true, retryPlan: 14, keyPlan: 4 };
    const chains = {};
    for (const [mode, parameters] of Object.entries(PROFILES)) {
      const persona = { ...base, ...parameters };
      chains[mode] = Hard.rateChain(task.game, runs, 20261022, persona, persona.memory, 20);
    }
    results.push({ name: task.name, start: task.start, chains });
    if (results.length % 10 === 0) parentPort.postMessage({ progress: 'Memory worker ' + workerData.index + ': ' + results.length + '/' + tasks.length });
  }
  return results;
}

async function main() {
  const runs = +(process.argv[2] || 64), data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const games = new Map(NAMES.flatMap(name => outcomesOf(name).map(episode => [name + '|' + episode.start, episode.game])));
  const tasks = data.rows.map(row => ({ name: row.name, start: row.start, game: games.get(row.name + '|' + row.start) }));
  const measured = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { memoryAudit: true, index, runs, tasks: tasks.filter((task, position) => position % 3 === index) } });
    worker.on('message', message => message.results ? resolve(message.results) : console.log(message.progress));
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Memory audit worker failed')); });
  })));
  const current = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const index = new Map(measured.flat().map(result => [result.name + '|' + result.start, result]));
  for (const row of current.rows) {
    const result = index.get(row.name + '|' + row.start);
    if (!result) throw new Error('Missing memory measurement');
    row.memoryChains = result.chains;
  }
  rebuildFeatures(current);
  current.memoryAudit = { runs, profiles: PROFILES };
  fs.writeFileSync(filename, JSON.stringify(current));
  console.log('Saved limited-memory forecasts.');
}

if (!isMainThread && workerData?.memoryAudit) parentPort.postMessage({ results: measure(workerData.tasks, workerData.runs) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES };
