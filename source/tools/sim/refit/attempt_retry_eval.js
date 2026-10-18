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
  learn: { learnFromLoss: true, retryPlan: 14 },
  keys: { learnFromLoss: true, retryPlan: 14, keyPlan: 4 },
  earlyPlan: { learnFromLoss: true, plan: 14, retryPlan: 14, keyPlan: 4 },
  lowPictureMemory: { learnFromLoss: true, retryPlan: 14, keyPlan: 4, memory: [0.3, 0.15, 0.3] },
};

function measure(name, runs) {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const games = new Map(outcomesOf(name).map(episode => [episode.start, episode.game]));
  const results = [];
  for (const row of data.rows.filter(episode => episode.name === name)) {
    const game = games.get(row.start), chains = {};
    const base = { ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 })), allMoves: true,
      flips: true, kinds: { ...DEFAULT_KINDS, ...kindsAt(name, row.start) }, peek: 0, end: 12, plan: 10, memory: CONFIG.memory };
    for (const [mode, parameters] of Object.entries(PROFILES)) {
      const persona = { ...base, ...parameters };
      chains[mode] = Hard.rateChain(game, runs, 20261021, persona, persona.memory, 20);
    }
    results.push({ start: row.start, chains });
    if (results.length % 15 === 0) parentPort.postMessage({ progress: name + ': ' + results.length + ' mistake-learning forecasts' });
  }
  return { name, results };
}

async function main() {
  const runs = +(process.argv[2] || 64), pending = [...NAMES], results = [];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (pending.length) {
      const name = pending.shift();
      results.push(await new Promise((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { retryAudit: true, name, runs } });
        worker.on('message', message => message.result ? resolve(message.result) : console.log(message.progress));
        worker.on('error', reject);
        worker.on('exit', code => { if (code) reject(new Error('Retry audit worker failed')); });
      }));
    }
  }));
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const index = new Map(results.flatMap(person => person.results.map(result => [person.name + '|' + result.start, result])));
  for (const row of data.rows) {
    const result = index.get(row.name + '|' + row.start);
    if (!result) throw new Error('Missing retry measurement');
    row.retryChains = result.chains;
  }
  rebuildFeatures(data);
  data.retryAudit = { runs, profiles: PROFILES };
  fs.writeFileSync(filename, JSON.stringify(data));
  console.log('Saved mistake-learning and key-planning forecasts.');
}

if (!isMainThread && workerData?.retryAudit) parentPort.postMessage({ result: measure(workerData.name, workerData.runs) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES };
