'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const frozenRelative = 'analysis/archive/personal-bots/runs/known-plan-2026-10-18T10-47-22-831Z';
const frozen = path.join(root, frozenRelative);
process.env.TABLES = path.join(frozen, 'tools/sim/refit/tables');
const Hard = require('../../../www/hard.js');
const { tasksOf, selectModels, actorOf } = require(path.join(frozen, 'tools/sim/refit/physical_count_data.js'));
const { CONFIG } = require('./personal_model.js');
const { styleAttemptFactory } = require('./personal_outcome_styles_choice.js');
const parentRelative = 'analysis/archive/personal-bots/experiments/personal-known-plan-count-scored-2026-10-18T15-09-37-493Z';
const parentPinned = path.join(root, parentRelative);
const oldEngine = path.join(frozen, 'analysis/archive/personal-bots/experiments/personal-episode-full-2026-10-18T06-19-34-227Z/www/hard.js');
const PreviousHard = require(oldEngine);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const modelFile = 'analysis/archive/personal-bots/personal-outcome-styles-models.json';
const auditFile = 'analysis/personal-bots/personal-outcome-styles-runtime-audit.json';
const PROFILES = {
  ownOutcomeBase0: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 0, outcomeStyle: false },
  ownOutcomeStyles0: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 0, outcomeStyle: true },
};

function pinnedRead(folder, filename) {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'))), bytes = fs.readFileSync(path.join(folder, filename));
  assert.equal(hash(bytes), manifest.files[filename]);
  return JSON.parse(bytes);
}

function measure(entries, runs, attempts) {
  const bank = JSON.parse(fs.readFileSync(path.join(frozen, 'analysis/archive/personal-bots/experiments/personal-memory-2026-10-18T00-43-24-647Z/analysis/archive/personal-bots/physical-memory-policy-bank.json')));
  const models = new Map(JSON.parse(fs.readFileSync(path.join(root, modelFile))).models.map(row => [row.id, row.outcomeStyles]));
  return entries.map(({ task, original }, position) => {
    const actor = selectModels(bank, task).ownAll, model = models.get(actor.id);
    assert(model && model.trainingCut <= task.start && (model.availableThrough === null || model.availableThrough < task.start));
    assert(!model.trainedAids.some(aid => task.excludedAids.includes(aid)));
    assert.deepEqual(model.trainedAids.slice().sort(), actor.trainedAids.slice().sort());
    assert(model.labelledGames.every(game => game.availableAt < task.start));
    const base = { ...actorOf(actor), memory: CONFIG.memory, learnFromLoss: true };
    assert.deepEqual(PreviousHard.rateChain(task.game, 32, 20261028, base, CONFIG.memory, 32), original.chains.ownAll,
      'Immutable old-engine chain changed: ' + task.name + '/' + task.lv);
    const chains = { ...original.chains }, caps = {}, elapsedMs = {};
    for (const [profile, { scope, outcomeStyle, ...parameters }] of Object.entries(PROFILES)) {
      const stats = {}, persona = { ...base, ...parameters, stats,
        physicalChoiceForAttempt: styleAttemptFactory(actor, model, task.firstClear && task.firstAttempt === 1, outcomeStyle) };
      const began = Date.now();
      chains[profile] = Hard.rateChain(task.game, runs, 20261028, persona, CONFIG.memory, attempts);
      caps[profile] = stats.contextChoiceLimits || 0;
      assert.equal(chains[profile].computationCensored || 0, caps[profile]);
      assert.equal(stats.physicalClockPlans || 0, 0);
      elapsedMs[profile] = Date.now() - began;
    }
    if ((position + 1) % 5 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: position + 1, total: entries.length } });
    return { ...original, chains, outcomeStyleAvailability: { id: actor.id, trainingCut: model.trainingCut,
      availableThrough: model.availableThrough, trainingGames: model.trainingGames }, outcomeStyleComputationCaps: caps, outcomeStyleElapsedMs: elapsedMs };
  });
}

async function main() {
  const pilot = process.argv[2] === 'pilot';
  if (process.argv[2] && !pilot) throw new Error('Use explicit pilot mode or full outcome-style count measurement');
  const closureFile = path.join(frozen, 'run-manifest.json'), closure = JSON.parse(fs.readFileSync(closureFile));
  for (const [name, digest] of Object.entries(closure.sourceInputs)) assert.equal(hash(fs.readFileSync(path.join(frozen, name))), digest);
  assert.equal(hash(fs.readFileSync(path.join(root, 'www/hard.js'))), closure.sourceInputs['www/hard.js']);
  const parent = pinnedRead(parentPinned, 'analysis/archive/personal-bots/physical-known-plan-count-data.json');
  assert.equal(parent.rows.length, 276); assert.equal(parent.comparisonEpisodes.length, 80); assert.equal(parent.knownPlanComputationCaps, 0);
  const audit = JSON.parse(fs.readFileSync(path.join(root, auditFile))), fitted = JSON.parse(fs.readFileSync(path.join(root, modelFile)));
  assert.equal(audit.prefixes, 197); assert.equal(audit.probabilityDecisions, 38028); assert.equal(fitted.models.length, 138);
  const auditDigest = crypto.createHash('sha256');
  for (const name of audit.fingerprintFiles) auditDigest.update(name).update(fs.readFileSync(path.join(root, name)));
  assert.equal(auditDigest.digest('hex'), audit.fingerprint);
  const evaluation = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/personal-outcome-styles-action-evaluation.json')));
  assert.equal(hash(fs.readFileSync(path.join(root, modelFile))), evaluation.modelsSha256);
  const entries = tasksOf().map(task => {
    const original = parent.rows.find(row => row.name === task.name && row.start === task.start);
    assert(original);
    for (const field of ['name', 'lv', 'start', 'end', 'board', 'wonOn', 'firstAttempt', 'firstClear', 'openingRecorded', 'source']) assert.deepEqual(task[field], original[field]);
    return { task, original };
  });
  assert.equal(entries.length, 276);
  const fingerprintFiles = [...new Set([...audit.fingerprintFiles, auditFile, modelFile,
    ...Object.keys(closure.sourceInputs).map(name => frozenRelative + '/' + name), frozenRelative + '/run-manifest.json',
    parentRelative + '/manifest.json', parentRelative + '/analysis/archive/personal-bots/physical-known-plan-count-data.json',
    ...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep)).map(file => path.relative(root, file).replace(/\\/g, '/'))])].sort();
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const name of fingerprintFiles) digest.update(name).update(fs.readFileSync(path.join(root, name)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), runs = pilot ? 2 : 32, attempts = pilot ? 3 : 32;
  const progress = path.join(root, 'analysis/personal-bots/personal-outcome-styles-count-' + (pilot ? 'pilot' : 'full') + '-progress.jsonl');
  fs.writeFileSync(progress, JSON.stringify({ made: new Date().toISOString(), fingerprint, pilot, runs, attempts, campaigns: 276 }) + '\n');
  const batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { outcomeStyleCounts: true, index, runs, attempts,
      entries: entries.filter((entry, position) => position % 3 === index) } });
    worker.on('message', message => {
      if (message.rows) resolve(message.rows);
      else fs.appendFileSync(progress, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
    });
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Outcome-style count worker failed')); });
  })));
  assert.equal(fingerprintOf(), fingerprint);
  const rows = batches.flat().sort((left, right) => left.start - right.start);
  const computationCaps = rows.reduce((sum, row) => sum + Object.values(row.outcomeStyleComputationCaps).reduce((total, count) => total + count, 0), 0);
  const report = { made: new Date().toISOString(), evidence: pilot ? 'outcome-style-lifecycle-pilot-only' : 'historical-outcome-style-count-development',
    targetMet: false, fingerprint, fingerprintFiles, runs, attempts, controlRuns: 32, controlAttempts: 32,
    comparisonEpisodes: parent.comparisonEpisodes,
    controlChainsMatched: 276, computationCaps, validUncensoredSimulation: computationCaps === 0,
    outcomeStyleModelsSha256: hash(fs.readFileSync(path.join(root, modelFile))), outcomeStyleRuntimeAuditSha256: hash(fs.readFileSync(path.join(root, auditFile))),
    currentEngineSha256: hash(fs.readFileSync(path.join(root, 'www/hard.js'))), retainedControlEngineSha256: hash(fs.readFileSync(oldEngine)),
    note: 'Same276 boards/80 fixed held progression IDs. Immutable old-engine controls reproduce all276 full32-run/32-try chains. '
      + 'Personal whole-attempt styles are sampled before play from own earlier labels, never target outcomes. '
      + 'Current paired zero-residual control keeps the same physicalPlan0/no-generic-clock lifecycle. '
      + 'Computation caps invalidate count scoring. Pilot exports no human labels or accuracy; full historical evidence is not prospective80% success.' };
  if (pilot) {
    report.rows = rows.map(row => ({ name: row.name, lv: row.lv, start: row.start, board: row.board,
      chains: Object.fromEntries(Object.keys(PROFILES).map(profile => [profile, row.chains[profile]])),
      computationCaps: row.outcomeStyleComputationCaps, elapsedMs: row.outcomeStyleElapsedMs }));
    fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-outcome-styles-count-pilot.json'), JSON.stringify(report));
  } else {
    fs.writeFileSync(path.join(archive, 'physical-outcome-styles-count-data.json'), JSON.stringify({ ...parent, ...report,
      profiles: { ...parent.profiles, ...PROFILES }, rows }));
  }
  console.log(JSON.stringify({ pilot, campaigns: rows.length, controlChainsMatched: 276, computationCaps, runs, attempts }));
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread && workerData?.outcomeStyleCounts) parentPort.postMessage({ rows: measure(workerData.entries, workerData.runs, workerData.attempts) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES };
