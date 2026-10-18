'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { tasksOf, selectModels, actorOf } = require('./physical_count_data.js');
const { CONFIG } = require('./personal_model.js');
const { choiceFactory } = require('./personal_context_choice.js');
const { planAttemptFactory } = require('./personal_plan_choice.js');
const { pinnedRead, actionPinned, memoryPinned } = require('./personal_context_runtime_audit.js');
const { episodePinned } = require('./personal_plan_runtime_audit.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const contextPinned = path.join(archive, 'experiments/personal-context-full-2026-10-18T05-17-41-214Z');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const PROFILES = {
  ownLegalRepeatPlan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, episodeMode: 'base' },
  ownStepPlan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, episodeMode: 'step' },
  ownEpisodePlan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, episodeMode: 'episode' },
  ownAdaptiveEpisodePlan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, episodeMode: 'adaptive' },
  ownCarryEpisodePlan8: { scope: 'ownCarryAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, episodeMode: 'episode' },
};

function measure(entries, runs, planRuns, planAttempts) {
  const bank = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const plans = new Map(pinnedRead(episodePinned, 'analysis/archive/personal-bots/personal-plan-models.json').models.map(model => [model.id, model.episodePlan]));
  const contexts = new Map(pinnedRead(actionPinned, 'analysis/archive/personal-bots/personal-context-models.json').models.map(model => [model.id, model.choiceResidual]));
  return entries.map(({ task, original }, position) => {
    const models = selectModels(bank, task), chains = { ...original.chains }, caps = {}, availability = {}, elapsedMs = {};
    for (const [profile, parameters] of Object.entries({ ownAll: {}, ownAllPlan8: { physicalPlan: 8 }, ownAllContext8Plan8: { physicalPlan: 8 } })) {
      const model = models.ownAll, context = contexts.get(model.id), stages = Math.min(8, context.trees.length);
      const persona = { ...actorOf(model), memory: CONFIG.memory, learnFromLoss: true, ...parameters,
        ...(profile === 'ownAllContext8Plan8' && stages ? { physicalChoice: choiceFactory(model, context, stages) } : {}) };
      assert.deepEqual(Hard.rateChain(task.game, runs, 20261028, persona, CONFIG.memory, 32), original.chains[profile],
        'Episode control changed: ' + task.name + '/' + task.lv + '/' + profile);
    }
    for (const [profile, { scope, episodeMode, ...parameters }] of Object.entries(PROFILES)) {
      const actor = models[scope], plan = plans.get(actor.id);
      assert(plan && plan.trainingCut <= task.start && (plan.availableThrough === null || plan.availableThrough < task.start));
      assert(!plan.trainedAids.some(aid => task.excludedAids.includes(aid)));
      const stats = {}, persona = { ...actorOf(actor), ...parameters, stats,
        physicalChoiceForAttempt: planAttemptFactory(actor, plan, episodeMode, task.firstClear && task.firstAttempt === 1) };
      const began = Date.now();
      chains[profile] = Hard.rateChain(task.game, planRuns, 20261028, persona, parameters.memory, planAttempts);
      elapsedMs[profile] = Date.now() - began;
      caps[profile] = stats.contextChoiceLimits || 0;
      assert.equal(chains[profile].computationCensored || 0, caps[profile]);
      availability[profile] = { id: actor.id, trainingCut: plan.trainingCut, availableThrough: plan.availableThrough,
        trainingGames: plan.trainingGames, transitionLinks: plan.transitionLinks.length, episodeMode };
    }
    if ((position + 1) % 5 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: position + 1, total: entries.length } });
    return { ...original, chains, planAvailability: availability, planComputationCaps: caps, planElapsedMs: elapsedMs };
  });
}

async function main() {
  const pilot = process.argv[2] === 'pilot';
  if (process.argv[2] && !pilot) throw new Error('Use explicit pilot mode or the full episode count experiment');
  const parent = pinnedRead(contextPinned, 'analysis/archive/personal-bots/physical-context-count-data.json');
  const fitted = pinnedRead(episodePinned, 'analysis/archive/personal-bots/personal-plan-models.json');
  const auditFile = 'analysis/personal-bots/personal-plan-runtime-audit.json', auditRaw = fs.readFileSync(path.join(root, auditFile)), audit = JSON.parse(auditRaw);
  const auditDigest = crypto.createHash('sha256');
  for (const file of audit.fingerprintFiles) auditDigest.update(file).update(fs.readFileSync(path.join(root, file)));
  assert.equal(auditDigest.digest('hex'), audit.fingerprint, 'Episode probability audit is stale');
  assert.equal(audit.prefixes, 197); assert.equal(audit.probabilityDecisions, 152112); assert.equal(audit.methodComparisons, 1576);
  assert.equal(audit.planModelsSha256, hash(fs.readFileSync(path.join(episodePinned, 'analysis/archive/personal-bots/personal-plan-models.json'))));
  assert.equal(fitted.models.length, 276); assert.equal(parent.runs, 32); assert.equal(parent.contextComputationCaps, 0);
  const manifest = JSON.parse(fs.readFileSync(path.join(contextPinned, 'manifest.json'))), parentDigest = crypto.createHash('sha256');
  for (const file of parent.fingerprintFiles) {
    const external = file.includes('/experiments/'), bytes = fs.readFileSync(path.join(external ? root : contextPinned, file));
    assert.equal(hash(bytes), external ? manifest.externalPinnedDependencies[file] : manifest.files[file]);
    parentDigest.update(bytes);
  }
  assert.equal(parentDigest.digest('hex'), parent.fingerprint);
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
    ...['personal_plan_count_data.js', 'personal_plan_count_fit.py', 'personal_count_fit.py', 'attempt_count_fit.py', 'attempt_hazard.py',
      'board_recall_eval.py', 'physical_count_data.js', 'attempt_count.js', 'attempt_count_labels.js', 'attempt_features.js', 'pdata.js', 'boards.js',
      'board_versions.js', 'kinds.js', 'personal_policy_prior.js', 'personal_model.js', 'attempts.json'].map(file => 'tools/sim/refit/' + file),
    ...fs.readdirSync(path.join(__dirname, 'tables')).filter(file => /^(levels|hard|early)-/.test(file)).sort().map(file => 'tools/sim/refit/tables/' + file),
    ...['manifest.json', 'analysis/archive/personal-bots/physical-context-count-data.json', 'analysis/archive/personal-bots/physical-context-count-scored.json'].map(file => relative(contextPinned) + '/' + file),
    relative(actionPinned) + '/analysis/archive/personal-bots/personal-context-models.json'])];
  const fingerprintOf = () => { const digest = crypto.createHash('sha256'); for (const file of fingerprintFiles) digest.update(fs.readFileSync(path.join(root, file))); return digest.digest('hex'); };
  const fingerprint = fingerprintOf();
  const progressFile = path.join(root, 'analysis/personal-bots/personal-plan-count-' + (pilot ? 'pilot' : 'full') + '-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), fingerprint, pilot, campaigns: entries.length }) + '\n');
  console.log('Measuring', entries.length, 'unchanged campaigns;', pilot ? 'two runs/three attempts for episode quality pilot' : '32 runs/32 attempts for full episode counts');
  const batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { index, runs: parent.runs, planRuns: pilot ? 2 : parent.runs, planAttempts: pilot ? 3 : 32,
      entries: entries.filter((entry, position) => position % 3 === index) } });
    worker.on('message', message => {
      if (message.rows) resolve(message.rows);
      else {
        fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
        console.log('Episode worker', message.progress.worker, message.progress.completed + '/' + message.progress.total);
      }
    });
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Episode count worker failed')); });
  })));
  assert.equal(fingerprintOf(), fingerprint);
  const rows = batches.flat().sort((left, right) => left.start - right.start);
  const caps = rows.reduce((sum, row) => sum + Object.values(row.planComputationCaps).reduce((total, count) => total + count, 0), 0);
  if (pilot) {
    const report = { made: new Date().toISOString(), evidence: 'episode-lifecycle-throughput-pilot-only', targetMet: false,
      fingerprint, fingerprintFiles, planRuns: 2, planAttempts: 3, controlRuns: 32, controlAttempts: 32, controlChainsMatched: tasks.length * 3,
      computationCaps: caps, rows: rows.map(row => ({ name: row.name, lv: row.lv, start: row.start, board: row.board,
        computationCaps: row.planComputationCaps, elapsedMs: row.planElapsedMs })),
      note: 'All276 campaigns and three full32-run/32-try controls are retained. Two episode runs/up tothree attempts exercise isolated plans and simulated-failure transitions. No human winning outcomes, predicted winning counts or accuracy score are exported. This cannot replace full count testing or frozen future evidence.' };
    fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-plan-throughput-audit.json'), JSON.stringify(report, null, 2));
    console.log('Saved episode quality pilot;', rows.length, 'campaigns;', caps, 'computation boundaries');
    return;
  }
  const data = { ...parent, measuredAt: new Date().toISOString(), scope: 'recent-first-clear-own-coherent-episode-preferences-development-v1',
    profiles: { ...parent.profiles, ...PROFILES }, rows, fingerprint, fingerprintFiles,
    parentMeasurementFingerprint: parent.fingerprint, planRuntimeAuditSha256: hash(auditRaw), planModelsSha256: audit.planModelsSha256,
    controlChainsMatched: tasks.length * 3, planComputationCaps: caps, validUncensoredSimulation: caps === 0,
    note: 'Same276 campaigns/80 fixed new-level held IDs, including assisted wins. All three32-run/32-try old control chains reproduce their immutable parent before previous controls/covariates are reused. Earlier own models sample isolated attempt preferences, optionally transitioning only after their own simulated failures. Independent-step and zero-residual legal-repeat ablations are declared; no held-target behavior selects a style. Computation boundaries are censored and invalidate count scoring. Existing numeric forecasts are unchanged; historical evidence is not genuine future80% success.' };
  const file = caps ? 'physical-plan-censored-count-data.json' : 'physical-plan-count-data.json';
  fs.writeFileSync(path.join(archive, file), JSON.stringify(data));
  console.log('Saved', rows.length, 'episode-count campaigns;', data.controlChainsMatched, 'matched controls;', caps, 'computation boundaries;', file);
  if (caps) process.exitCode = 2;
}

if (!isMainThread) parentPort.postMessage({ rows: measure(workerData.entries, workerData.runs, workerData.planRuns, workerData.planAttempts) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES, contextPinned };
