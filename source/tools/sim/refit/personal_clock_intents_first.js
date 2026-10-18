'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { intentFactory } = require('./personal_clock_intents_choice.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function measure(entries, actors, models) {
  return entries.map(entry => {
    const actor = actors.find(actor => actor.id === entry.modelId), model = models.find(model => model.id === entry.modelId).clockIntents;
    assert(actor && actor.trainingCut <= entry.start && (model.availableThrough === null || model.availableThrough < entry.start));
    assert(!model.trainedAids.some(aid => entry.excludedAids.includes(aid)));
    const game = decodeGame(entry.game), profiles = {};
    for (const [name, enabled] of Object.entries({ ownIntentZero: false, ownClockIntents: true })) {
      const outcomes = [], totals = { computationCaps: 0, planningNodes: 0, boundaries: 0 };
      for (let index = 0; index < 32; index++) {
        const selector = intentFactory(actor, model, true, enabled), stats = {};
        const result = Hard.play({ ...game, memory: null, avoidMoves: new Map() },
          { ...physicalActor(actor), physicalPlan: 0, physicalChoice: selector,
            physicalTrayPlanning: selector.physicalTrayPlanning, stats }, 20261028 * 7919 + index * 104729, []);
        assert.equal(stats.physicalClockPlans || 0, 0);
        totals.computationCaps += stats.contextChoiceLimits || 0;
        totals.planningNodes += stats.knownPlanNodes || 0;
        totals.boundaries += stats.knownPlanBoundaries || 0;
        outcomes.push({ win: result.win, why: result.why, left: result.left, moves: result.moves });
      }
      profiles[name] = { outcomes, ...totals };
    }
    assert.deepEqual(profiles.ownIntentZero.outcomes, entry.controlOutcomes, 'Persistent-intent zero control changed a frozen first-attempt trajectory');
    if (!game.clock || model.trainingClockChoices === 0) assert.deepEqual(profiles.ownClockIntents.outcomes, profiles.ownIntentZero.outcomes);
    parentPort.postMessage({ progress: { name: entry.name, lv: entry.lv } });
    return { name: entry.name, lv: entry.lv, start: entry.start, board: entry.board, modelId: actor.id, profiles };
  });
}

async function main() {
  const snapshot = path.join(archive, 'experiments/personal-fresh-clock-actions-2026-10-18T16-30-12-344Z');
  const inputFile = path.join(archive, 'personal-fresh-count-input.json');
  const input = JSON.parse(fs.readFileSync(inputFile));
  const oldFile = path.join(snapshot, 'analysis/personal-bots/fresh-clock-first-audit.json');
  const previous = JSON.parse(fs.readFileSync(oldFile)), manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json')));
  assert.equal(hash(fs.readFileSync(oldFile)), manifest.files['analysis/personal-bots/fresh-clock-first-audit.json']);
  assert.equal(hash(fs.readFileSync(inputFile)), manifest.files['analysis/archive/personal-bots/personal-fresh-count-input.json']);
  const modelFile = path.join(archive, 'personal-clock-intents-models.json'), modelBytes = fs.readFileSync(modelFile), fitted = JSON.parse(modelBytes);
  const runtimeFile = path.join(root, 'analysis/personal-bots/clock-intents-runtime-audit.json'), runtime = JSON.parse(fs.readFileSync(runtimeFile));
  assert.equal(runtime.modelsSha256, hash(modelBytes)); assert.equal(runtime.prefixes, 445); assert.equal(runtime.decisions, 39268);
  const actorsFile = path.join(root, input.modelSnapshot, 'analysis/archive/personal-bots/personal-fresh-recent-models.json');
  const actors = JSON.parse(fs.readFileSync(actorsFile)).models;
  const sources = Object.fromEntries([inputFile, oldFile, modelFile, runtimeFile, actorsFile,
    ...Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))]
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  for (const [name, expected] of Object.entries(runtime.sourceHashes)) if (name !== 'tools/sim/refit/personal_clock_intents_runtime_audit.js') assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const entries = input.recent.map(entry => ({ ...entry,
    controlOutcomes: previous.rows.find(row => row.name === entry.name && row.start === entry.start).profiles.ownClockZero.outcomes }));
  const progressFile = path.join(root, 'analysis/personal-bots/clock-intents-first-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), entries: entries.length, runs: 32, targetMet: false }) + '\n');
  const workers = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { clockIntentsFirst: true,
        entries: entries.filter((entry, position) => position % 3 === index), actors, models: fitted.models } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Clock intent diagnostic failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  for (const [name, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const rows = batches.flat(), summaries = {};
  for (const name of [...new Set(rows.map(row => row.name))]) {
    summaries[name] = Object.fromEntries(['ownIntentZero', 'ownClockIntents'].map(profile => {
      const own = rows.filter(row => row.name === name), outcomes = own.flatMap(row => row.profiles[profile].outcomes);
      return [profile, { runs: outcomes.length, wins: outcomes.filter(result => result.win).length,
        failures: Object.fromEntries([...new Set(outcomes.filter(result => !result.win).map(result => result.why))]
          .map(reason => [reason, outcomes.filter(result => result.why === reason).length])),
        computationCaps: own.reduce((sum, row) => sum + row.profiles[profile].computationCaps, 0) }];
    }));
  }
  const caps = rows.reduce((sum, row) => sum + Object.values(row.profiles).reduce((total, profile) => total + profile.computationCaps, 0), 0);
  const report = { made: new Date().toISOString(), evidence: 'historical-exploratory-persistent-clock-intent-first-attempts', targetMet: false,
    sourceHashes: sources, exactFirstAttemptControls: rows.length, computationCaps: caps, summaries, rows,
    note: 'All29 recent targets, own earlier-only memberships,32 exact initial seeds and exact zero-control trajectories. '
      + 'No generic clock controller, new human outcome labels or existing numeric forecast changes. '
      + 'Initial survival changes are not complete winning-attempt accuracy or80% evidence.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/clock-intents-first-audit.json'), JSON.stringify(report));
  console.log(JSON.stringify({ controls: rows.length, caps, summaries }, null, 2));
  if (caps) process.exitCode = 2;
}

if (!isMainThread && workerData?.clockIntentsFirst) parentPort.postMessage({ rows: measure(workerData.entries, workerData.actors, workerData.models) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
