'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { tasksOf, selectModels, actorOf } = require('./physical_count_data.js');
const { CONFIG } = require('./personal_model.js');
const { choiceFactory } = require('./personal_context_choice.js');
const { pinnedRead, actionPinned, memoryPinned } = require('./personal_context_runtime_audit.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const PROFILES = {
  ownAllContext8Plan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, contextStages: 8 },
  ownAllContext24Plan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, contextStages: 24 },
  ownCarryContext8Plan8: { scope: 'ownCarryAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, contextStages: 8 },
};

function measure(entries, runs, contextRuns = runs, contextAttempts = 32) {
  const bank = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const fitted = pinnedRead(actionPinned, 'analysis/archive/personal-bots/personal-context-models.json');
  const residuals = new Map(fitted.models.map(model => [model.id, model.choiceResidual]));
  return entries.map(({ task, original }, position) => {
    const models = selectModels(bank, task), chains = { ...original.chains }, computationCaps = {}, availability = {}, elapsedMs = {};
    for (const [profile, parameters] of Object.entries({ ownAll: {}, ownAllPlan8: { physicalPlan: 8 } })) {
      const persona = { ...actorOf(models.ownAll), memory: CONFIG.memory, learnFromLoss: true, ...parameters };
      const control = Hard.rateChain(task.game, runs, 20261028, persona, CONFIG.memory, 32);
      assert.deepEqual(control, original.chains[profile], 'Pinned autonomous control changed: ' + task.name + '/' + task.lv + '/' + profile);
    }
    for (const [profile, { scope, contextStages, ...parameters }] of Object.entries(PROFILES)) {
      const model = models[scope], residual = residuals.get(model.id);
      assert(residual);
      assert(residual.trainingCut <= task.start && (residual.availableThrough === null || residual.availableThrough < task.start));
      assert(!residual.trainedAids.some(aid => task.excludedAids.includes(aid)));
      const stages = Math.min(contextStages, residual.trees.length), stats = {};
      const persona = { ...actorOf(model), ...parameters, stats,
        ...(stages ? { physicalChoice: choiceFactory(model, residual, stages) } : {}) };
      const began = Date.now();
      chains[profile] = Hard.rateChain(task.game, contextRuns, 20261028, persona, parameters.memory, contextAttempts);
      elapsedMs[profile] = Date.now() - began;
      computationCaps[profile] = stats.contextChoiceLimits || 0;
      availability[profile] = { id: model.id, trainingCut: residual.trainingCut, availableThrough: residual.availableThrough,
        trainingGames: residual.trainingGames, stages };
    }
    if ((position + 1) % 5 === 0) parentPort.postMessage({ progress: 'Context-count worker ' + workerData.index + ': ' + (position + 1) + '/' + entries.length });
    return { ...original, chains, contextAvailability: availability, contextComputationCaps: computationCaps, contextElapsedMs: elapsedMs };
  });
}

async function main() {
  const pilot = process.argv[2] === 'pilot';
  if (process.argv[2] && !pilot) throw new Error('Only the explicit pilot mode or full measurement is supported');
  const parent = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-count-data.json');
  const fitted = pinnedRead(actionPinned, 'analysis/archive/personal-bots/personal-context-models.json');
  const prefix = pinnedRead(actionPinned, 'analysis/archive/personal-bots/policy-value-prefix-data.json');
  assert.equal(fitted.prefixFingerprint, prefix.fingerprint);
  assert.equal(fitted.inputHashes['analysis/archive/personal-bots/policy-value-prefix-data.json'], hash(fs.readFileSync(path.join(actionPinned, 'analysis/archive/personal-bots/policy-value-prefix-data.json'))));
  const auditFile = 'analysis/personal-bots/personal-context-runtime-audit.json', auditRaw = fs.readFileSync(path.join(root, auditFile)), audit = JSON.parse(auditRaw);
  const runtimeDigest = crypto.createHash('sha256');
  for (const file of audit.fingerprintFiles) runtimeDigest.update(file).update(fs.readFileSync(path.join(root, file)));
  assert.equal(runtimeDigest.digest('hex'), audit.fingerprint, 'Runtime parity audit is stale');
  const decisions = Object.values(prefix.players).flat().reduce((sum, game) => sum + game.decisions.length, 0);
  const prefixes = Object.values(prefix.players).flat().length;
  assert.equal(audit.controlPrefixes, prefixes);
  assert.equal(audit.runtimePrefixes, prefixes);
  assert.equal(audit.controlDecisions, decisions);
  assert.equal(audit.runtimeDecisions, decisions);
  assert.equal(audit.unsupported.length, 0);
  assert.equal(audit.maskedInspectionRows, 0);
  assert.equal(fitted.models.length, 276);
  assert.equal(parent.runs, 32);
  const parentDigest = crypto.createHash('sha256');
  for (const file of parent.fingerprintFiles) parentDigest.update(fs.readFileSync(path.join(memoryPinned, file)));
  assert.equal(parentDigest.digest('hex'), parent.fingerprint, 'Pinned parent simulation sources changed');
  const tasks = tasksOf();
  assert.equal(tasks.length, parent.rows.length);
  const entries = tasks.map(task => {
    const original = parent.rows.find(row => row.name === task.name && row.start === task.start);
    assert(original);
    for (const field of ['name', 'lv', 'start', 'end', 'board', 'wonOn', 'firstAttempt', 'firstClear', 'openingRecorded', 'source']) assert.deepEqual(task[field], original[field]);
    return { task, original };
  });
  const relative = folder => path.relative(root, folder).replace(/\\/g, '/');
  const fingerprintFiles = [...new Set([...audit.fingerprintFiles, auditFile,
    ...['personal_context_count_data.js', 'personal_context_count_fit.py', 'personal_count_fit.py', 'attempt_count_fit.py', 'attempt_hazard.py',
      'board_recall_eval.py', 'attempt_count.js', 'attempt_count_labels.js', 'attempt_features.js', 'pdata.js', 'boards.js', 'board_versions.js', 'kinds.js', 'personal_policy_prior.js', 'attempts.json'].map(file => 'tools/sim/refit/' + file),
    ...fs.readdirSync(path.join(__dirname, 'tables')).filter(file => /^(levels|hard|early)-/.test(file)).sort().map(file => 'tools/sim/refit/tables/' + file),
    ...['manifest.json', 'analysis/archive/personal-bots/personal-context-models.json', 'analysis/personal-bots/personal-context-action-evaluation.json',
      'analysis/archive/personal-bots/policy-value-prefix-data.json'].map(file => relative(actionPinned) + '/' + file),
    ...['manifest.json', 'analysis/archive/personal-bots/physical-memory-policy-bank.json', 'analysis/archive/personal-bots/physical-count-requests.json',
      'analysis/archive/personal-bots/physical-memory-count-data.json', 'analysis/archive/personal-bots/physical-memory-count-scored.json'].map(file => relative(memoryPinned) + '/' + file)])];
  const fingerprintOf = () => { const digest = crypto.createHash('sha256'); for (const file of fingerprintFiles) digest.update(fs.readFileSync(path.join(root, file))); return digest.digest('hex'); };
  const fingerprint = fingerprintOf();
  console.log('Measuring', entries.length, 'unchanged campaigns with', parent.comparisonEpisodes.length, 'fixed new-level comparisons;', pilot ? 'throughput pilot:2 contextual first tries,32-run full controls' : '32 runs/32 tries');
  const batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { index, runs: parent.runs, contextRuns: pilot ? 2 : parent.runs, contextAttempts: pilot ? 1 : 32,
      entries: entries.filter((entry, position) => position % 3 === index) } });
    worker.on('message', message => message.rows ? resolve(message.rows) : console.log(message.progress));
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Context-count worker failed')); });
  })));
  assert.equal(fingerprintOf(), fingerprint);
  const rows = batches.flat().sort((left, right) => left.start - right.start);
  const computationCaps = rows.reduce((sum, row) => sum + Object.values(row.contextComputationCaps).reduce((total, count) => total + count, 0), 0);
  if (pilot) {
    const report = { made: new Date().toISOString(), evidence: 'context-throughput-boundary-pilot-only', targetMet: false,
      fingerprint, fingerprintFiles, contextRuns: 2, contextAttempts: 1, controlRuns: 32, controlAttempts: 32,
      controlChainsMatched: tasks.length * 2, computationCaps,
      rows: rows.map(row => ({ name: row.name, lv: row.lv, start: row.start, board: row.board,
        computationCaps: row.contextComputationCaps, elapsedMs: row.contextElapsedMs,
        firstSuccess: Object.fromEntries(Object.keys(PROFILES).map(profile => [profile, row.chains[profile].first])) })),
      note: 'All276 campaigns are retained for throughput/computation-boundary checks; contextual actors receive only two first-try samples. Both32-run/32-try control chains match the parent for every board. No human outcomes or winning-count score are exported, and this pilot cannot be used as an accuracy claim or replace the full32-run/32-try experiment.' };
    fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-context-throughput-audit.json'), JSON.stringify(report, null, 2));
    console.log('Saved throughput pilot for', rows.length, 'campaigns; computation boundaries:', computationCaps);
    return;
  }
  const data = { ...parent, measuredAt: new Date().toISOString(), scope: 'recent-first-clear-own-contextual-choices-development-v1',
    profiles: { ...parent.profiles, ...PROFILES }, rows, fingerprint, fingerprintFiles,
    parentMeasurementFingerprint: parent.fingerprint, actionModelSha256: hash(fs.readFileSync(path.join(actionPinned, 'analysis/archive/personal-bots/personal-context-models.json'))),
    runtimeAuditSha256: hash(auditRaw), controlChainsMatched: tasks.length * 2, contextComputationCaps: computationCaps,
    validUncensoredSimulation: computationCaps === 0,
    note: 'Every original276 campaign and80 held new-level ID remains. OwnAll and ownAllPlan8 control chains reproduce the immutable parent exactly before previous controls/covariates are reused. Context8/24 and configured-memory context8 actors use only earlier own fitted choices; no target labels select stages. Legal repeated inspections replace the old arbitrary two-reinspection mask only for contextual actors. Any computation boundary is explicitly censored, never a valid observed human loss; data with such boundaries must not be scored as an accuracy claim. Numeric prospective ledgers are unchanged. Historical exploratory evidence is not genuine future80% proof.' };
  const file = computationCaps ? 'physical-context-censored-count-data.json' : 'physical-context-count-data.json';
  fs.writeFileSync(path.join(archive, file), JSON.stringify(data));
  console.log('Saved', rows.length, 'campaigns; matched', data.controlChainsMatched, 'control chains; computation boundaries:', computationCaps, ';', file);
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread) parentPort.postMessage({ rows: measure(workerData.entries, workerData.runs, workerData.contextRuns, workerData.contextAttempts) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES };
