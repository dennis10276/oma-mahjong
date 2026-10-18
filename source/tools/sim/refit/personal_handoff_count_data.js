'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { CONFIG, boardId } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { handoffAttemptFactory } = require('./personal_handoff_choice.js');
const { planFeatures, PARAMETERS } = require('./personal_joint_intents_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { physicalFeatures } = require('./personal_fresh_count_data.js');
const { loadContext, checkedModels } = require('./personal_handoff_first.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const profiles = { handoffZero: false, handoff: true };

function checkFirst(chain, outcomes, runs) {
  assert.equal(outcomes.length, runs);
  assert.equal(chain.first, outcomes.filter(outcome => outcome.win).length / runs, 'Full chain changed first-attempt survival');
}

function measure(entries, actors, models, baseModels, runs, attempts, priorPilot, first) {
  return entries.map(entry => {
    const { actor, model, base } = checkedModels(entry, actors, models, baseModels), game = decodeGame(entry.game);
    assert.equal(boardId(game), entry.board);
    const planning = planningCache(PARAMETERS, 16384, planFeatures), chains = {}, computationCaps = {};
    for (const [profile, enabled] of Object.entries(profiles)) {
      const factory = handoffAttemptFactory(actor, base, model, true, enabled), stats = {};
      factory.physicalTrayPlanning = planning;
      const persona = { ...physicalActor(actor), physicalPlan: 0, memory: CONFIG.memory, learnFromLoss: true,
        physicalChoiceForAttempt: factory, physicalTrayPlanning: planning, stats };
      if (priorPilot) {
        const control = priorPilot.rows.find(row => row.name === entry.name && row.start === entry.start);
        assert(control && control.board === entry.board);
        assert.deepEqual(Hard.rateChain(game, 2, 20261028, persona, CONFIG.memory, 3), control.chains[profile], 'Paired handoff pilot changed');
        assert.equal(stats.contextChoiceLimits || 0, 0);
      }
      stats.contextChoiceLimits = 0;
      chains[profile] = Hard.rateChain(game, runs, 20261028, persona, CONFIG.memory, attempts);
      computationCaps[profile] = stats.contextChoiceLimits || 0;
      assert.equal(chains[profile].computationCensored || 0, computationCaps[profile]);
      assert.equal(stats.physicalClockPlans || 0, 0);
      if (first) {
        const initial = first.rows.find(row => row.name === entry.name && row.start === entry.start);
        assert(initial && initial.board === entry.board);
        checkFirst(chains[profile], initial.profiles[profile].outcomes, runs);
      }
    }
    const { game: encoded, controlOutcomes, controlClockPrefixes, ...metadata } = entry;
    parentPort.postMessage({ progress: { name: entry.name, lv: entry.lv } });
    return { ...metadata, chains, computationCaps, physical: physicalFeatures(game) };
  });
}

async function main(mode) {
  assert(['pilot', 'full'].includes(mode), 'Supply explicit pilot or full mode');
  const pilot = mode === 'pilot', context = loadContext(), runs = pilot ? 2 : 32, attempts = pilot ? 3 : 32;
  const pilotFile = path.join(root, 'analysis/personal-bots/handoff-count-pilot.json');
  const firstFile = path.join(root, 'analysis/personal-bots/handoff-first-audit.json');
  const priorPilot = pilot ? null : JSON.parse(fs.readFileSync(pilotFile));
  const first = pilot ? null : JSON.parse(fs.readFileSync(firstFile));
  if (priorPilot) {
    assert.equal(priorPilot.computationCaps, 0); assert.equal(priorPilot.runs, 2); assert.equal(priorPilot.attempts, 3);
    assert.equal(priorPilot.rows.length, context.entries.length);
    assert.equal(first.computationCaps, 0); assert.equal(first.resultControls, 29);
    for (const [name, expected] of Object.entries(priorPilot.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
    for (const [name, expected] of Object.entries(first.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
    context.sources[path.relative(root, pilotFile).replace(/\\/g, '/')] = hash(fs.readFileSync(pilotFile));
    context.sources[path.relative(root, firstFile).replace(/\\/g, '/')] = hash(fs.readFileSync(firstFile));
  }
  const progressFile = path.join(root, 'analysis/personal-bots/handoff-count-' + mode + '-progress.jsonl'), workers = [];
  const started = new Date().toISOString();
  fs.writeFileSync(progressFile, JSON.stringify({ made: started, entries: context.entries.length, runs, attempts, targetMet: false }) + '\n');
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { handoffCounts: true, ...context, runs, attempts, priorPilot, first,
        entries: context.entries.filter((entry, position) => position % 3 === index) } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Handoff count worker failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  for (const [name, expected] of Object.entries(context.sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const rows = batches.flat(), computationCaps = rows.reduce((sum, row) => sum + Object.values(row.computationCaps).reduce((total, caps) => total + caps, 0), 0);
  assert.equal(rows.length, 29);
  const report = { made: new Date().toISOString(), started, targetMet: false,
    evidence: pilot ? 'historical-handoff-lifecycle-pilot-only' : 'historical-exploratory-handoff-first-clear-counts',
    runs, attempts, sourceHashes: context.sources, computationCaps, validUncensoredSimulation: computationCaps === 0,
    pairedPilotChainsMatched: pilot ? 0 : rows.length * 2, firstAttemptRateControls: pilot ? 0 : rows.length * 2,
    profiles, rows,
    note: 'All29 earlier-own recent boards, two paired autonomous controllers, per-attempt posterior/cue resets and simulated-failure learning. '
      + 'Common retry memory remains controlled at[.75,.5,.75], not individually fitted. '
      + 'Pilot is lifecycle evidence only; full32x32 reruns every paired2x3 pilot and matches32-seed initial rates. '
      + 'No older controller chains are silently reused as new bot calibration. Caps are censoring, not human losses. '
      + 'Historical client-time action fits are exploratory; no pre-opening numeric forecast or80% success is established.' };
  const output = pilot ? pilotFile : path.join(root, 'analysis/archive/personal-bots/personal-handoff-count-data.json');
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ mode, rows: rows.length, runs, attempts, computationCaps, pairedPilotChainsMatched: report.pairedPilotChainsMatched }));
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread && workerData?.handoffCounts) parentPort.postMessage({ rows: measure(workerData.entries, workerData.actors, workerData.models,
  workerData.baseModels, workerData.runs, workerData.attempts, workerData.priorPilot, workerData.first) });
else if (require.main === module) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { checkFirst };
