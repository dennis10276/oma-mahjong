'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { CONFIG, boardId } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { jointIntentAttemptFactory } = require('./personal_joint_intents_choice.js');
const { planFeatures, PARAMETERS } = require('./personal_joint_planning_fast.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { physicalFeatures } = require('./personal_fresh_count_data.js');
const { loadContext, checkedModels } = require('./personal_handoff_first.js');
const { checkFirst } = require('./personal_handoff_count_data.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function measure(entries, actors, models, baseModels, runs, attempts, pilot, oldPilot) {
  return entries.map(entry => {
    const { actor, base } = checkedModels(entry, actors, models, baseModels), game = decodeGame(entry.game);
    assert.equal(boardId(game), entry.board);
    const planning = planningCache(PARAMETERS, 16384, planFeatures), chains = {}, computationCaps = {};
    for (const [profile, memory] of Object.entries({ configuredControl: CONFIG.memory, noInheritedPictures: 0 })) {
      const factory = jointIntentAttemptFactory(actor, base.clockIntents, base.trayIntents), stats = {};
      const persona = { ...physicalActor(actor), physicalPlan: 0, memory, learnFromLoss: true,
        physicalChoiceForAttempt: factory, physicalTrayPlanning: planning, stats };
      const paired = Hard.rateChain(game, 2, 20261028, persona, memory, 3);
      if (profile === 'configuredControl') {
        const previous = oldPilot.rows.find(row => row.name === entry.name && row.start === entry.start);
        assert(previous && previous.board === entry.board);
        assert.deepEqual(paired, previous.chains.handoffZero, 'Cached planning/direct joint factory changed original configured pilot');
      }
      if (pilot) {
        const previous = pilot.rows.find(row => row.name === entry.name && row.start === entry.start);
        assert(previous && previous.board === entry.board);
        assert.deepEqual(paired, previous.chains[profile], 'Consistent recall paired pilot changed');
      }
      assert.equal(stats.contextChoiceLimits || 0, paired.computationCensored || 0);
      assert.equal(stats.physicalClockPlans || 0, 0);
      if (!pilot || profile === 'configuredControl') {
        chains[profile] = paired; computationCaps[profile] = stats.contextChoiceLimits || 0;
        continue;
      }
      assert.equal(stats.contextChoiceLimits || 0, 0);
      stats.contextChoiceLimits = 0;
      chains[profile] = Hard.rateChain(game, runs, 20261028, persona, memory, attempts);
      computationCaps[profile] = stats.contextChoiceLimits || 0;
      assert.equal(chains[profile].computationCensored || 0, computationCaps[profile]);
      assert.equal(stats.physicalClockPlans || 0, 0);
      checkFirst(chains[profile], entry.controlOutcomes, runs);
    }
    const { game: encoded, controlOutcomes, controlClockPrefixes, ...metadata } = entry;
    parentPort.postMessage({ progress: { name: entry.name, lv: entry.lv } });
    return { ...metadata, chains, computationCaps, physical: physicalFeatures(game) };
  });
}

async function main(mode) {
  assert(['pilot', 'full'].includes(mode), 'Supply explicit pilot or full mode');
  const isPilot = mode === 'pilot', context = loadContext();
  const read = filename => {
    const bytes = fs.readFileSync(path.join(root, filename)); context.sources[filename] = hash(bytes); return JSON.parse(bytes);
  };
  const fast = read('analysis/personal-bots/clock-fast-audit.json');
  assert.equal(fast.prefixes, 445); assert.equal(fast.decisions, 39268); assert.equal(fast.exactAutonomousPathPairs, 6);
  assert(fast.paths.every(row => row.caps === 0));
  for (const [name, expected] of Object.entries(fast.sourceHashes)) {
    assert.equal(hash(fs.readFileSync(path.join(root, name))), expected); context.sources[name] = expected;
  }
  const recall = read('analysis/archive/personal-bots/personal-recall-models.json');
  assert.equal(recall.models.length, 24); assert(Object.values(recall.selectedRecallMode).every(mode => mode === 'none'));
  const oldPilot = read('analysis/personal-bots/handoff-count-pilot.json');
  assert.equal(oldPilot.computationCaps, 0); assert.equal(oldPilot.rows.length, 29);
  for (const [name, expected] of Object.entries(oldPilot.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const pilotFile = 'analysis/personal-bots/recall-count-pilot.json';
  const pilot = isPilot ? null : read(pilotFile), runs = isPilot ? 2 : 32, attempts = isPilot ? 3 : 32;
  if (pilot) {
    assert.equal(pilot.computationCaps, 0); assert.equal(pilot.rows.length, 29);
    for (const [name, expected] of Object.entries(pilot.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  }
  const progressFile = path.join(root, 'analysis/personal-bots/recall-count-' + mode + '-progress.jsonl'), workers = [];
  const started = new Date().toISOString();
  fs.writeFileSync(progressFile, JSON.stringify({ made: started, entries: context.entries.length, runs, attempts, targetMet: false }) + '\n');
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { recallCounts: true, ...context, runs, attempts, pilot, oldPilot,
        entries: context.entries.filter((entry, position) => position % 3 === index) } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Recall count worker failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  for (const [name, expected] of Object.entries(context.sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const rows = batches.flat(), computationCaps = rows.reduce((sum, row) => sum + Object.values(row.computationCaps).reduce((total, caps) => total + caps, 0), 0);
  assert.equal(rows.length, 29);
  const report = { made: new Date().toISOString(), started, targetMet: false,
    evidence: isPilot ? 'consistent-recall-lifecycle-pilot-only' : 'posthoc-historical-exploratory-consistent-recall-first-clear-counts',
    sourceHashes: context.sources, runs, attempts, computationCaps, validUncensoredSimulation: computationCaps === 0,
    originalConfiguredPilotControls: 29, pairedPilotChainsMatched: isPilot ? 0 : 58, firstAttemptRateControls: isPilot ? 0 : 29,
    profiles: { configuredControl: { runs: 2, attempts: 3, scope: 'lifecycle-control-only', memory: CONFIG.memory },
      noInheritedPictures: { runs, attempts, scope: 'own-asof-joint-actor-fixed-zero-recall-hypothesis', memory: 0 } }, rows,
    note: 'All29 recent boards retain earlier-own static/joint models and target exclusions. Default4096 choice cap and all physics/seed rules are unchanged. '
      + 'Configured control remains explicitly2x3; its full32x32 chain is NOT regenerated or silently inferred while the separate owned run is live. '
      + 'Full candidate32x32 reruns both paired pilots and matches original32-seed initial survival. '
      + 'Fixed zero incoming pictures is a consistency hypothesis, not a claim of zero human memory. Simulated-loss avoidance remains enabled. '
      + 'Recall calibration used later recent data: this historical candidate comparison is post-hoc research, NOT an independently held/pre-opening accuracy claim. '
      + 'No older differing-controller chain is reused as candidate calibration, no existing numeric forecast or miss changes, and no80% success is established.' };
  const output = isPilot ? path.join(root, pilotFile) : path.join(root, 'analysis/archive/personal-bots/personal-recall-count-data.json');
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ mode, rows: rows.length, computationCaps, originalConfiguredPilotControls: 29,
    pairedPilotChainsMatched: report.pairedPilotChainsMatched, firstAttemptRateControls: report.firstAttemptRateControls }));
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread && workerData?.recallCounts) parentPort.postMessage({ rows: measure(workerData.entries, workerData.actors, workerData.models,
  workerData.baseModels, workerData.runs, workerData.attempts, workerData.pilot, workerData.oldPilot) });
else if (require.main === module) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
