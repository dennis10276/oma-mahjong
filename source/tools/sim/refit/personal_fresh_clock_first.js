'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { strategyFactory } = require('./personal_clock_strategy_choice.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function measure(entries, actors, models) {
  return entries.map(entry => {
    const actor = actors.find(actor => actor.id === entry.modelId), model = models.find(model => model.id === entry.modelId).clockStrategy;
    assert(actor && actor.trainingCut <= entry.start && (model.availableThrough === null || model.availableThrough < entry.start));
    assert(!model.trainedAids.some(aid => entry.excludedAids.includes(aid)));
    const game = decodeGame(entry.game), profiles = {};
    for (const [name, scale] of Object.entries({ ownClockZero: 0, ownClockAdaptive: 1 })) {
      const outcomes = [], totals = { computationCaps: 0, planningNodes: 0, boundaries: 0 };
      for (let index = 0; index < 32; index++) {
        const selector = strategyFactory(actor, model, true, scale), stats = {};
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
    const wins = profiles.ownClockZero.outcomes.filter(result => result.win).length;
    assert.equal(wins / 32, entry.controlFirst, 'Fresh zero-clock residual changed the frozen first-attempt control');
    if (!game.clock) assert.deepEqual(profiles.ownClockAdaptive.outcomes, profiles.ownClockZero.outcomes);
    parentPort.postMessage({ progress: { name: entry.name, lv: entry.lv } });
    return { name: entry.name, lv: entry.lv, start: entry.start, board: entry.board, modelId: actor.id, profiles };
  });
}

async function main() {
  const inputFile = path.join(archive, 'personal-fresh-count-input.json');
  const input = JSON.parse(fs.readFileSync(inputFile));
  const clockFile = path.join(archive, 'personal-fresh-clock-models.json'), modelBytes = fs.readFileSync(clockFile);
  const fitted = JSON.parse(modelBytes);
  const nativeFile = path.join(root, 'analysis/personal-bots/fresh-clock-runtime-audit.json');
  const runtime = JSON.parse(fs.readFileSync(nativeFile));
  assert.equal(runtime.modelsSha256, hash(modelBytes)); assert.equal(runtime.prefixes, 445);
  const actorsFile = path.join(root, input.modelSnapshot, 'analysis/archive/personal-bots/personal-fresh-recent-models.json');
  const actors = JSON.parse(fs.readFileSync(actorsFile)).models;
  const countFile = path.join(archive, 'runs/fresh-count-2026-10-18T16-12-34-747Z/analysis/archive/personal-bots/physical-fresh-count-data.json');
  const countManifest = JSON.parse(fs.readFileSync(path.join(archive, 'runs/fresh-count-2026-10-18T16-12-34-747Z/run-manifest.json')));
  assert.equal(hash(fs.readFileSync(inputFile)), countManifest.sourceInputs['analysis/archive/personal-bots/personal-fresh-count-input.json']);
  const counts = JSON.parse(fs.readFileSync(countFile));
  assert.equal(counts.computationCaps, 0);
  const sources = Object.fromEntries([inputFile, clockFile, nativeFile, actorsFile, countFile,
    ...Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))]
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  for (const [name, expected] of Object.entries(runtime.sourceHashes)) if (name !== 'tools/sim/refit/personal_fresh_clock_runtime_audit.js') assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const entries = input.recent.map(entry => ({ ...entry, controlFirst: counts.rows.find(row => row.name === entry.name && row.start === entry.start).chains.ownOutcomeBase0.first }));
  const progressFile = path.join(root, 'analysis/personal-bots/fresh-clock-first-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), entries: entries.length, runs: 32, targetMet: false }) + '\n');
  const workers = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { freshClockFirst: true,
        entries: entries.filter((entry, position) => position % 3 === index), actors, models: fitted.models } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Fresh clock diagnostic failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  for (const [name, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const rows = batches.flat(), summaries = {};
  for (const name of [...new Set(rows.map(row => row.name))]) {
    summaries[name] = Object.fromEntries(['ownClockZero', 'ownClockAdaptive'].map(profile => {
      const own = rows.filter(row => row.name === name), outcomes = own.flatMap(row => row.profiles[profile].outcomes);
      return [profile, { runs: outcomes.length, wins: outcomes.filter(result => result.win).length,
        failures: Object.fromEntries([...new Set(outcomes.filter(result => !result.win).map(result => result.why))]
          .map(reason => [reason, outcomes.filter(result => result.why === reason).length])),
        computationCaps: own.reduce((sum, row) => sum + row.profiles[profile].computationCaps, 0) }];
    }));
  }
  const caps = rows.reduce((sum, row) => sum + Object.values(row.profiles).reduce((total, profile) => total + profile.computationCaps, 0), 0);
  const report = { made: new Date().toISOString(), evidence: 'historical-exploratory-fresh-clock-first-attempt-diagnosis',
    targetMet: false, sourceHashes: sources, exactFirstAttemptControls: rows.length, computationCaps: caps, summaries, rows,
    note: 'Own earlier-only models, all29 recent targets retained,32 exact initial seeds each, zero-residual controls reproduced. '
      + 'Clock/tray failure changes and first-attempt survival are not whole winning-attempt accuracy. '
      + 'No count-head tuning, future numeric overwrite, forced greedy controller or80% claim.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/fresh-clock-first-audit.json'), JSON.stringify(report));
  console.log(JSON.stringify({ controls: rows.length, caps, summaries }, null, 2));
  if (caps) process.exitCode = 2;
}

if (!isMainThread && workerData?.freshClockFirst) parentPort.postMessage({ rows: measure(workerData.entries, workerData.actors, workerData.models) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
