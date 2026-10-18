'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { tasksOf, selectModels, actorOf } = require('./physical_count_data.js');
const { CONFIG } = require('./personal_model.js');
const { choiceFactory } = require('./personal_context_choice.js');
const { knownPlanFactory } = require('./personal_known_plan_choice.js');
const { pinnedRead, memoryPinned } = require('./personal_context_runtime_audit.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const parentPinned = path.join(archive, 'experiments/personal-episode-full-2026-10-18T06-19-34-227Z');
const modelPinned = path.join(archive, 'experiments/personal-known-plan-actions-2026-10-18T07-00-31-837Z');
const pilotPinned = path.join(archive, 'experiments/personal-known-plan-count-pilot-2026-10-18T10-06-57-033Z');
const PreviousHard = require(path.join(parentPinned, 'www/hard.js'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const PROFILES = {
  ownKnownZeroPlan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, knownPlan: false },
  ownKnownPlan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, knownPlan: true },
};

function measure(entries, runs, attempts, pilot) {
  const bank = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const models = new Map(pinnedRead(modelPinned, 'analysis/archive/personal-bots/personal-known-plan-models.json').models.map(model => [model.id, model.knownPlan]));
  const priorPilot = pilot ? pinnedRead(pilotPinned, 'analysis/personal-bots/personal-known-plan-count-throughput-audit.json') : null;
  return entries.map(({ task, original }, position) => {
    const actor = selectModels(bank, task).ownAll, model = models.get(actor.id);
    assert(model && model.trainingCut <= task.start && (model.availableThrough === null || model.availableThrough < task.start));
    assert(!model.trainedAids.some(aid => task.excludedAids.includes(aid)));
    for (const [profile, parameters] of Object.entries({ ownAll: {}, ownAllPlan8: { physicalPlan: 8 } })) {
      const persona = { ...actorOf(actor), memory: CONFIG.memory, learnFromLoss: true, ...parameters };
      assert.deepEqual(PreviousHard.rateChain(task.game, 32, 20261028, persona, CONFIG.memory, 32), original.chains[profile],
        'Immutable old-engine control changed: ' + task.name + '/' + task.lv + '/' + profile);
    }
    const chains = { ...original.chains }, statsByProfile = {}, elapsedMs = {}, cacheStats = {};
    for (const [profile, { knownPlan, ...parameters }] of Object.entries(PROFILES)) {
      const stats = {}, choose = knownPlan ? knownPlanFactory(actor, model) : choiceFactory(actor,
        { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0);
      const persona = { ...actorOf(actor), ...parameters, physicalChoice: choose, stats,
        ...(knownPlan ? { physicalTrayPlanning: choose.physicalTrayPlanning } : {}) };
      const began = Date.now();
      chains[profile] = Hard.rateChain(task.game, runs, 20261028, persona, CONFIG.memory, attempts);
      if (priorPilot) {
        const originalPilot = priorPilot.rows.find(row => row.name === task.name && row.start === task.start);
        assert(originalPilot && originalPilot.board === task.board);
        assert.deepEqual(chains[profile], originalPilot.chains[profile], 'Optimized planning changed a preregistered paired pilot chain');
      }
      elapsedMs[profile] = Date.now() - began;
      statsByProfile[profile] = { contextChoiceLimits: stats.contextChoiceLimits || 0,
        knownPlanNodes: stats.knownPlanNodes || 0, knownPlanBoundaries: stats.knownPlanBoundaries || 0 };
      assert.equal(chains[profile].computationCensored || 0, statsByProfile[profile].contextChoiceLimits);
      if (knownPlan) cacheStats[profile] = choose.physicalTrayPlanning.stats();
    }
    if ((position + 1) % 5 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: position + 1, total: entries.length } });
    return { ...original, chains, knownPlanAvailability: { id: actor.id, trainingCut: model.trainingCut,
      availableThrough: model.availableThrough, trainingGames: model.trainingGames }, knownPlanStats: statsByProfile,
      knownPlanElapsedMs: elapsedMs, knownPlanCache: cacheStats };
  });
}

async function main() {
  const pilot = process.argv[2] === 'pilot';
  if (process.argv[2] && !pilot) throw new Error('Use explicit pilot mode or full paired known-plan count measurement');
  const parent = pinnedRead(parentPinned, 'analysis/archive/personal-bots/physical-plan-count-data.json');
  const fitted = pinnedRead(modelPinned, 'analysis/archive/personal-bots/personal-known-plan-models.json');
  const report = pinnedRead(modelPinned, 'analysis/personal-bots/personal-known-plan-action-evaluation.json');
  assert.equal(fitted.models.length, 138); assert.equal(parent.rows.length, 276); assert.equal(parent.planComputationCaps, 0);
  const previousManifest = JSON.parse(fs.readFileSync(path.join(parentPinned, 'manifest.json')));
  for (const name of ['www/hard.js', 'www/layouts.js']) assert.equal(hash(fs.readFileSync(path.join(parentPinned, name))), previousManifest.files[name]);
  const auditFile = 'analysis/personal-bots/personal-known-plan-runtime-audit.json', auditBytes = fs.readFileSync(path.join(root, auditFile)), audit = JSON.parse(auditBytes);
  const auditHash = crypto.createHash('sha256');
  for (const file of audit.fingerprintFiles) auditHash.update(file).update(fs.readFileSync(path.join(root, file)));
  assert.equal(auditHash.digest('hex'), audit.fingerprint);
  assert.equal(audit.prefixes, 197); assert.equal(audit.probabilityDecisions, 38028);
  assert.equal(hash(fs.readFileSync(path.join(root, 'analysis/archive/personal-bots/personal-known-plan-models.json'))), report.modelsSha256);
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
    ...['personal_known_plan_count_data.js', 'physical_count_data.js', 'attempt_count.js', 'attempt_count_labels.js', 'attempt_features.js',
      'pdata.js', 'boards.js', 'board_versions.js', 'kinds.js', 'personal_policy_prior.js', 'personal_model.js', 'attempts.json',
      'personal_count_fit.py', 'attempt_count_fit.py', 'attempt_hazard.py', 'board_recall_eval.py'].map(name => 'tools/sim/refit/' + name),
    ...fs.readdirSync(path.join(__dirname, 'tables')).filter(name => /^(levels|hard|early)-/.test(name)).sort().map(name => 'tools/sim/refit/tables/' + name),
    ...['manifest.json', 'www/hard.js', 'www/layouts.js', 'analysis/archive/personal-bots/physical-plan-count-data.json',
      'analysis/archive/personal-bots/physical-plan-count-scored.json'].map(name => relative(parentPinned) + '/' + name),
    ...['manifest.json', 'analysis/archive/personal-bots/personal-known-plan-models.json',
      'analysis/personal-bots/personal-known-plan-action-evaluation.json'].map(name => relative(modelPinned) + '/' + name),
    ...['manifest.json', 'analysis/personal-bots/personal-known-plan-count-throughput-audit.json'].map(name => relative(pilotPinned) + '/' + name)])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const name of fingerprintFiles) digest.update(fs.readFileSync(path.join(root, name)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), progressFile = path.join(root, 'analysis/personal-bots/personal-known-plan-count-' + (pilot ? 'pilot' : 'full') + '-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), fingerprint, pilot, campaigns: tasks.length }) + '\n');
  const workers = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { index, entries: entries.filter((entry, position) => position % 3 === index),
        runs: pilot ? 2 : 32, attempts: pilot ? 3 : 32, pilot } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else { fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
          console.log('Known-count worker', message.progress.worker, message.progress.completed + '/' + message.progress.total); }
      });
      worker.on('error', reject);
      worker.on('exit', code => { if (code) reject(new Error('Known-count worker failed: ' + code)); });
    })));
  } catch (error) {
    await Promise.all(workers.map(worker => worker.terminate()));
    throw error;
  }
  assert.equal(fingerprintOf(), fingerprint);
  const rows = batches.flat().sort((left, right) => left.start - right.start);
  const caps = rows.reduce((total, row) => total + Object.values(row.knownPlanStats).reduce((sum, stats) => sum + stats.contextChoiceLimits, 0), 0);
  const note = 'Own-person action-fitted known-route preferences versus zero-residual legal-repeat control under the repaired current engine. '
    + 'Both use their own simulated observations/failures only, never supplied human target trajectories. '
    + 'Retained old profiles are immutable old-engine forecast features, not falsely claimed to match repaired-engine retry physics. '
    + 'Two old-engine full control chains match all276 boards exactly; old labels/covariates and all80 held new-level IDs are unchanged. '
    + 'Per-option bounded planning unknowns are not human losses; context-choice computation caps censor simulation and cannot be scored. '
    + 'Cached planning uses public state only and never imports hidden outcomes or other persons\' choices. '
    + 'Historical or pilot results cannot establish a genuinely frozen future80% winning-count goal.';
  if (pilot) {
    const output = path.join(root, 'analysis/personal-bots/personal-known-plan-count-throughput-audit.json');
    fs.writeFileSync(output, JSON.stringify({ made: new Date().toISOString(), evidence: 'known-plan-count-pilot', targetMet: false,
      fingerprint, fingerprintFiles, runs: 2, attempts: 3, controlRuns: 32, controlAttempts: 32, controlChainsMatched: tasks.length * 2,
      computationCaps: caps, comparisonEpisodes: parent.comparisonEpisodes, profiles: PROFILES,
      optimizedCurrentChainsMatched: tasks.length * Object.keys(PROFILES).length,
      rows: rows.map(row => ({ name: row.name, lv: row.lv, start: row.start, board: row.board, source: row.source,
        availability: row.knownPlanAvailability, stats: row.knownPlanStats, elapsedMs: row.knownPlanElapsedMs, cache: row.knownPlanCache,
        chains: Object.fromEntries(Object.keys(PROFILES).map(profile => [profile, row.chains[profile]])) })), note }));
    console.log('Saved known-plan pilot:', rows.length, 'campaigns,', tasks.length * 2, 'old-engine controls,', caps, 'computation caps');
    return;
  }
  const outputName = caps ? 'physical-known-plan-censored-count-data.json' : 'physical-known-plan-count-data.json';
  fs.writeFileSync(path.join(archive, outputName), JSON.stringify({ measuredAt: new Date().toISOString(), runs: 32, attempts: 32,
    scope: 'recent-first-clear-own-known-tray-plan-development-v1', targetMet: false, personalOnly: true,
    profiles: { ...parent.profiles, ...PROFILES }, rows, comparisonEpisodes: parent.comparisonEpisodes, fingerprint, fingerprintFiles,
    knownPlanComputationCaps: caps, validUncensoredSimulation: !caps, controlChainsMatched: tasks.length * 2,
    retainedControlEngineSha256: previousManifest.files['www/hard.js'], currentEngineSha256: hash(fs.readFileSync(path.join(root, 'www/hard.js'))),
    knownPlanModelsSha256: report.modelsSha256, knownPlanRuntimeAuditSha256: hash(auditBytes), note }));
  console.log('Saved', rows.length, 'paired known-plan campaigns;', caps, 'computation caps;', outputName);
  if (caps) process.exitCode = 2;
}

if (!isMainThread && require.main === module) parentPort.postMessage({ rows: measure(workerData.entries, workerData.runs, workerData.attempts, workerData.pilot) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES };
