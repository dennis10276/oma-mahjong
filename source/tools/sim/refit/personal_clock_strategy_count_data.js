'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { actorOf, selectModels } = require('./physical_count_data.js');
const { CONFIG } = require('./personal_model.js');
const { choiceFactory } = require('./personal_context_choice.js');
const { strategyAttemptFactory } = require('./personal_clock_strategy_choice.js');
const { pinnedRead, memoryPinned } = require('./personal_context_runtime_audit.js');
const root = path.resolve(__dirname, '../../..');
const parentPinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-episode-full-2026-10-18T06-19-34-227Z');
const PreviousHard = require(path.join(parentPinned, 'www/hard.js'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const PROFILES = {
  ownAdaptiveClockZero: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 0, adaptiveClock: false },
  ownAdaptiveClock: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 0, adaptiveClock: true },
};

function measure(entries, snapshot, runs, attempts) {
  const bank = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const fitted = pinnedRead(snapshot, 'analysis/archive/personal-bots/personal-clock-strategy-models.json');
  const models = new Map(fitted.models.map(model => [model.id, model.clockStrategy]));
  return entries.map(({ task, original }, position) => {
    const actor = selectModels(bank, task).ownAll, model = models.get(actor.id);
    assert(model && model.trainingCut <= task.start && (model.availableThrough === null || model.availableThrough < task.start));
    assert(!model.trainedAids.some(aid => task.excludedAids.includes(aid)));
    assert.deepEqual(model.trainedAids.slice().sort(), actor.trainedAids.slice().sort());
    for (const [profile, extra] of Object.entries({ ownAll: {}, ownAllPlan8: { physicalPlan: 8 } })) {
      assert.deepEqual(PreviousHard.rateChain(task.game, 32, 20261028,
        { ...actorOf(actor), memory: CONFIG.memory, learnFromLoss: true, ...extra }, CONFIG.memory, 32), original.chains[profile],
      'Old-engine control changed: ' + task.name + '/' + task.lv + '/' + profile);
    }
    const chains = { ...original.chains }, clockStrategyStats = {}, elapsedMs = {};
    for (const [profile, { adaptiveClock, ...parameters }] of Object.entries(PROFILES)) {
      const stats = {}, factory = adaptiveClock ? strategyAttemptFactory(actor, model, task.firstClear) : null;
      const choice = adaptiveClock ? { physicalChoiceForAttempt: factory, physicalTrayPlanning: factory.physicalTrayPlanning }
        : { physicalChoice: choiceFactory(actor, { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0) };
      const began = Date.now();
      chains[profile] = Hard.rateChain(task.game, runs, 20261028, { ...actorOf(actor), ...parameters, ...choice, stats }, CONFIG.memory, attempts);
      elapsedMs[profile] = Date.now() - began;
      assert.equal(stats.physicalClockPlans || 0, 0, 'Generic clock controller bypassed the personal strategy');
      assert.equal(stats.contextChoiceLimits || 0, chains[profile].computationCensored || 0);
      clockStrategyStats[profile] = { contextChoiceLimits: stats.contextChoiceLimits || 0, genericClockPlans: stats.physicalClockPlans || 0,
        knownPlanNodes: stats.knownPlanNodes || 0, knownPlanBoundaries: stats.knownPlanBoundaries || 0,
        ...(adaptiveClock ? { cache: factory.physicalTrayPlanning.stats() } : {}) };
    }
    if (!task.game.clock) assert.deepEqual(chains.ownAdaptiveClock, chains.ownAdaptiveClockZero, 'No-clock strategy changed its zero-residual chain');
    if ((position + 1) % 5 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: position + 1, total: entries.length } });
    return { ...original, chains, clockStrategyStats, clockStrategyElapsedMs: elapsedMs,
      clockStrategyAvailability: { id: actor.id, trainingCut: model.trainingCut, availableThrough: model.availableThrough } };
  });
}

async function main() {
  const [mode, snapshotArgument, inputArgument] = process.argv.slice(2);
  assert(['pilot', 'full'].includes(mode) && snapshotArgument && inputArgument,
    'Use pilot|full <immutable-adaptive-clock-action-snapshot> <immutable-copied-input-root>');
  const pilot = mode === 'pilot', snapshot = path.resolve(snapshotArgument), inputRoot = path.resolve(inputArgument);
  const modelManifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json')));
  assert.equal(modelManifest.mode, 'actions'); assert.equal(modelManifest.targetMet, false);
  const report = pinnedRead(snapshot, 'analysis/personal-bots/personal-clock-strategy-action-evaluation.json');
  const runtime = pinnedRead(snapshot, 'analysis/personal-bots/personal-clock-strategy-runtime-audit.json');
  assert.equal(report.models, 138); assert.equal(report.actionControlsMatched, 197);
  assert.equal(runtime.prefixes, 197); assert.equal(runtime.probabilityDecisions, 38028);
  const parent = pinnedRead(parentPinned, 'analysis/archive/personal-bots/physical-plan-count-data.json');
  const runManifest = JSON.parse(fs.readFileSync(path.join(inputRoot, 'run-manifest.json')));
  for (const [file, expected] of Object.entries(runManifest.sourceInputs)) assert.equal(hash(fs.readFileSync(path.join(inputRoot, file))), expected);
  assert.equal(hash(fs.readFileSync(path.join(inputRoot, 'www/hard.js'))), hash(fs.readFileSync(path.join(root, 'www/hard.js'))));
  const relative = folder => path.relative(root, folder).replace(/\\/g, '/');
  const fingerprintFiles = [...new Set([...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep))
    .map(file => path.relative(root, file).replace(/\\/g, '/')).sort(),
    relative(snapshot) + '/manifest.json', ...Object.keys(modelManifest.files).map(file => relative(snapshot) + '/' + file),
    ...Object.keys(modelManifest.externalPinnedDependencies), relative(inputRoot) + '/run-manifest.json',
    ...Object.keys(runManifest.sourceInputs).map(file => relative(inputRoot) + '/' + file),
    ...['manifest.json', 'www/hard.js', 'www/layouts.js', 'analysis/archive/personal-bots/physical-plan-count-data.json']
      .map(file => relative(parentPinned) + '/' + file)])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), progressFile = path.join(root, 'analysis/personal-bots/personal-clock-strategy-count-' + mode + '-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), pilot, fingerprint, stage: 'reconstruct-frozen-boards' }) + '\n');
  process.env.TABLES = path.join(inputRoot, 'tools/sim/refit/tables');
  const tasks = require(path.join(inputRoot, 'tools/sim/refit/physical_count_data.js')).tasksOf();
  assert.equal(tasks.length, 276);
  const entries = tasks.map(task => {
    const original = parent.rows.find(row => row.name === task.name && row.start === task.start);
    assert(original);
    for (const field of ['name', 'lv', 'start', 'end', 'board', 'wonOn', 'firstAttempt', 'firstClear', 'openingRecorded', 'source']) assert.deepEqual(task[field], original[field]);
    return { task, original };
  });
  const workers = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { index, snapshot, runs: pilot ? 2 : 32, attempts: pilot ? 3 : 32,
        entries: entries.filter((entry, position) => position % 3 === index) } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject);
      worker.on('exit', code => { if (code) reject(new Error('Adaptive clock worker failed: ' + code)); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  assert.equal(fingerprintOf(), fingerprint);
  const rows = batches.flat().sort((left, right) => left.start - right.start);
  const caps = rows.reduce((total, row) => total + Object.values(row.clockStrategyStats).reduce((sum, stats) => sum + stats.contextChoiceLimits, 0), 0);
  const metadata = { made: new Date().toISOString(), evidence: pilot ? 'adaptive-clock-count-pilot' : 'historical-exploratory',
    targetMet: false, pilot, personalOnly: true, fingerprint, fingerprintFiles, runs: pilot ? 2 : 32, attempts: pilot ? 3 : 32,
    profiles: { ...parent.profiles, ...PROFILES }, comparisonEpisodes: parent.comparisonEpisodes,
    controlChainsMatched: 552, clockStrategyComputationCaps: caps, validUncensoredSimulation: !caps,
    modelSnapshot: relative(snapshot), frozenInputRoot: relative(inputRoot),
    note: 'Same276 boards/80 held IDs, own-person adaptive clock strategies versus zero residual under the repaired current engine. '
      + 'Fresh causal filter per attempt; personal planning uses simulated public observations and past bot actions only. '
      + 'No generic clock controller, target human trajectory or future state smoothing in autonomous prediction. '
      + '552 old-engine full controls exact; old profiles remain explicitly old-engine forecast features. '
      + 'No-clock current chains must match exactly. Computation caps censor chains, never human losses. '
      + 'Pilot exports no human winning labels and cannot establish accuracy or future80% success.' };
  const output = pilot ? 'analysis/personal-bots/personal-clock-strategy-count-throughput-audit.json'
    : 'analysis/archive/personal-bots/physical-clock-strategy-' + (caps ? 'censored-' : '') + 'count-data.json';
  const selectedRows = pilot ? rows.map(row => ({ name: row.name, lv: row.lv, start: row.start, board: row.board,
    availability: row.clockStrategyAvailability, stats: row.clockStrategyStats, elapsedMs: row.clockStrategyElapsedMs,
    chains: Object.fromEntries(Object.keys(PROFILES).map(profile => [profile, row.chains[profile]])) })) : rows;
  fs.writeFileSync(path.join(root, output), JSON.stringify({ ...metadata, rows: selectedRows }));
  console.log(JSON.stringify({ output, campaigns: rows.length, held: parent.comparisonEpisodes.length, controlChainsMatched: 552, caps }));
  if (caps && !pilot) process.exitCode = 2;
}

if (!isMainThread && require.main === module) parentPort.postMessage({ rows: measure(workerData.entries, workerData.snapshot, workerData.runs, workerData.attempts) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES };
