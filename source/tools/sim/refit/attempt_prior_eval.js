'use strict';
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { NAMES, CONFIG } = require('./personal_model.js');
const { outcomesOf } = require('./attempt_count.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const { kindsAt } = require('./kinds.js');
const { rebuildFeatures } = require('./attempt_features.js');
const Hard = require('../../../www/hard.js');
const filename = path.resolve(__dirname, '../../../analysis/archive/personal-bots/attempt-count-data.json');
const policies = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/personal-bots/personal-policy.json'), 'utf8'));

function measure(name, runs) {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const games = new Map(outcomesOf(name).map(episode => [episode.start, episode.game]));
  const results = [];
  for (const row of data.rows.filter(episode => episode.name === name)) {
    const game = games.get(row.start), kinds = { ...DEFAULT_KINDS, ...kindsAt(name, row.start) };
    const prior = { ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 })),
      allMoves: true, flips: true, kinds, peek: 0, end: 12, plan: 10, memory: CONFIG.memory };
    const priorChain = Hard.rateChain(game, runs, 20261020, prior, CONFIG.memory, 20);
    const strongChain = Hard.rateChain(game, runs, 20261020, Hard.persona('strong'), CONFIG.memory, 20);
    let learnedChain = priorChain;
    const policy = policies.players[name];
    if (row.start >= policy.trainingCut) {
      const weights = policy.models.full.weights;
      learnedChain = Hard.rateChain(game, runs, 20261020, { ...prior, w: weights.slice(0, Hard.FEAT.length), spatial: weights.slice(Hard.FEAT.length) }, CONFIG.memory, 20);
    }
    results.push({ start: row.start, extraChains: { prior: priorChain, strong: strongChain, learned: learnedChain }, learnedAvailable: row.start >= policy.trainingCut });
    if (results.length % 15 === 0) parentPort.postMessage({ progress: name + ': ' + results.length + ' improved policy forecasts' });
  }
  return { name, results };
}

async function main() {
  const runs = +(process.argv[2] || 64), pending = [...NAMES], measured = [];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (pending.length) {
      const name = pending.shift();
      measured.push(await new Promise((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { priorAudit: true, name, runs } });
        worker.on('message', message => message.result ? resolve(message.result) : console.log(message.progress));
        worker.on('error', reject);
        worker.on('exit', code => { if (code) reject(new Error('Policy audit worker failed')); });
      }));
    }
  }));
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const index = new Map(measured.flatMap(person => person.results.map(result => [person.name + '|' + result.start, result])));
  for (const row of data.rows) {
    const result = index.get(row.name + '|' + row.start);
    if (!result) throw new Error('Missing policy measurement');
    row.extraChains = result.extraChains;
    row.learnedAvailable = result.learnedAvailable;
  }
  rebuildFeatures(data);
  data.policyAuditRuns = runs;
  fs.writeFileSync(filename, JSON.stringify(data));
  console.log('Saved chronological priors and personal move-policy forecasts.');
}

if (!isMainThread && workerData?.priorAudit) parentPort.postMessage({ result: measure(workerData.name, workerData.runs) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
