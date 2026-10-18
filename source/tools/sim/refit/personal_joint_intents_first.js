'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { jointIntentFactory, planFeatures, PARAMETERS } = require('./personal_joint_intents_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function clockPrefix(frames, clock) {
  if (!clock) return { hash: null, frames: 0 };
  const removal = frames.findIndex(frame => frame.alive[clock.i] === 0);
  const prefix = (removal < 0 ? frames : frames.slice(0, removal + 1)).map(frame =>
    ['index', 'kind', 'moves', 'alive', 'tray', 'openPeek'].map(name => frame[name]));
  return { hash: hash(JSON.stringify(prefix)), frames: prefix.length };
}

function measure(entries, actors, models) {
  return entries.map(entry => {
    const actor = actors.find(actor => actor.id === entry.modelId), model = models.find(model => model.id === entry.modelId);
    assert(actor && actor.trainingCut <= entry.start && model.trayIntents.availableThrough < entry.start);
    assert(!model.trayIntents.trainedAids.some(aid => entry.excludedAids.includes(aid)));
    const game = decodeGame(entry.game), profiles = {}, planning = planningCache(PARAMETERS, 16384, planFeatures);
    for (const [name, enabled] of Object.entries({ clockOnly: false, clockAndTray: true })) {
      const outcomes = [], prefixes = [], terminalContexts = [], totals = { computationCaps: 0, planningNodes: 0, boundaries: 0,
        skippedKnownTrayMatch: 0, knownNonPairReinspections: 0 };
      for (let index = 0; index < 32; index++) {
        const selector = jointIntentFactory(actor, model.clockIntents, model.trayIntents, true, enabled), stats = {}, physicalLog = [];
        let lastChoice = null;
        const choose = (decision, draw) => {
          const posteriorBefore = selector.posterior(), selected = selector(decision, draw), feature = decision.F[selected];
          const trayPlan = decision.knownPlan[selected].slice(12), clockActive = decision.kindContext[11] > 0;
          lastChoice = { clockActive, tray: decision.kindContext[1] + 2 * decision.kindContext[2] + 3 * decision.kindContext[3],
            hadTrayMatch: decision.kindContext[20] > 0, hadPeekMatch: decision.kindContext[23] > 0,
            selectedTrayMatch: feature[64] > 0, selectedPeekMatch: feature[66] > 0, selectedPair: feature[14] > 0,
            selectedFatal: feature[18] > 0, selectedInspection: feature[19] > 0, selectedKnownReopen: feature[65] > 0,
            selectedPairPreparation: feature[67] > 0, knownClearOptions: decision.knownPlan.filter(parts => parts[13] > 0).length,
            selectedTrayPlan: trayPlan, posteriorBefore };
          if (!clockActive && lastChoice.hadTrayMatch && !lastChoice.selectedTrayMatch && !lastChoice.selectedPeekMatch) totals.skippedKnownTrayMatch++;
          if (!clockActive && lastChoice.selectedInspection && lastChoice.selectedKnownReopen && !lastChoice.selectedPairPreparation) totals.knownNonPairReinspections++;
          return selected;
        };
        const result = Hard.play({ ...game, memory: null, avoidMoves: new Map(), physicalLog },
          { ...physicalActor(actor), physicalPlan: 0, physicalChoice: choose, physicalTrayPlanning: planning, stats },
          20261028 * 7919 + index * 104729, []);
        assert.equal(stats.physicalClockPlans || 0, 0);
        totals.computationCaps += stats.contextChoiceLimits || 0;
        totals.planningNodes += stats.knownPlanNodes || 0;
        totals.boundaries += stats.knownPlanBoundaries || 0;
        outcomes.push({ win: result.win, why: result.why, left: result.left, moves: result.moves });
        terminalContexts.push(lastChoice);
        prefixes.push(clockPrefix(physicalLog, game.clock));
      }
      profiles[name] = { outcomes, terminalContexts, clockPrefixes: prefixes, ...totals };
    }
    assert.deepEqual(profiles.clockOnly.outcomes, entry.controlOutcomes, 'Clock-only result records changed');
    assert.deepEqual(profiles.clockAndTray.clockPrefixes, profiles.clockOnly.clockPrefixes, 'New tray choices changed an earlier active-clock tap');
    parentPort.postMessage({ progress: { name: entry.name, lv: entry.lv } });
    return { name: entry.name, lv: entry.lv, start: entry.start, board: entry.board, modelId: actor.id,
      clockPrefixPairs: game.clock ? 32 : 0, planningCache: planning.stats(), profiles };
  });
}

async function main() {
  const snapshot = path.join(archive, 'experiments/personal-clock-intents-actions-2026-10-18T20-14-16-102Z');
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json')));
  const inputFile = path.join(archive, 'personal-fresh-count-input.json'), input = JSON.parse(fs.readFileSync(inputFile));
  assert.equal(hash(fs.readFileSync(inputFile)), manifest.files['analysis/archive/personal-bots/personal-fresh-count-input.json']);
  const previousFile = path.join(snapshot, 'analysis/personal-bots/clock-intents-first-audit.json');
  assert.equal(hash(fs.readFileSync(previousFile)), manifest.files['analysis/personal-bots/clock-intents-first-audit.json']);
  const previous = JSON.parse(fs.readFileSync(previousFile));
  const modelFile = path.join(archive, 'personal-tray-intents-models.json'), modelBytes = fs.readFileSync(modelFile), bank = JSON.parse(modelBytes);
  const runtimeFile = path.join(root, 'analysis/personal-bots/joint-intents-runtime-audit.json'), runtime = JSON.parse(fs.readFileSync(runtimeFile));
  assert.equal(hash(modelBytes), runtime.modelsSha256); assert.equal(runtime.prefixes, 445); assert.equal(runtime.decisions, 39268);
  const actorFile = path.join(root, input.modelSnapshot, 'analysis/archive/personal-bots/personal-fresh-recent-models.json');
  assert.equal(hash(fs.readFileSync(actorFile)), bank.inputHashes[path.relative(root, actorFile).replace(/\\/g, '/')]);
  const actors = JSON.parse(fs.readFileSync(actorFile)).models;
  const sources = Object.fromEntries([inputFile, previousFile, modelFile, runtimeFile, actorFile,
    ...Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))]
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  for (const [name, expected] of Object.entries(runtime.sourceHashes)) if (name !== 'tools/sim/refit/personal_joint_intents_runtime_audit.js') assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const entries = input.recent.map(entry => ({ ...entry,
    controlOutcomes: previous.rows.find(row => row.name === entry.name && row.start === entry.start).profiles.ownClockIntents.outcomes }));
  const progressFile = path.join(root, 'analysis/personal-bots/joint-intents-first-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), entries: entries.length, runs: 32, targetMet: false }) + '\n');
  const workers = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { jointIntentsFirst: true,
        entries: entries.filter((entry, position) => position % 3 === index), actors, models: bank.models } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Joint intent diagnostic failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  for (const [name, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const rows = batches.flat(), summaries = {};
  for (const name of [...new Set(rows.map(row => row.name))]) summaries[name] = Object.fromEntries(['clockOnly', 'clockAndTray'].map(profile => {
    const own = rows.filter(row => row.name === name), outcomes = own.flatMap(row => row.profiles[profile].outcomes);
    return [profile, { runs: outcomes.length, wins: outcomes.filter(result => result.win).length,
      failures: Object.fromEntries([...new Set(outcomes.filter(result => !result.win).map(result => result.why))]
        .map(reason => [reason, outcomes.filter(result => result.why === reason).length])),
      computationCaps: own.reduce((sum, row) => sum + row.profiles[profile].computationCaps, 0),
      skippedKnownTrayMatch: own.reduce((sum, row) => sum + row.profiles[profile].skippedKnownTrayMatch, 0),
      knownNonPairReinspections: own.reduce((sum, row) => sum + row.profiles[profile].knownNonPairReinspections, 0),
      trayLossesWithPreActionKnownMatch: own.reduce((sum, row) => sum + row.profiles[profile].outcomes.filter((result, index) =>
        result.why === 'tray' && row.profiles[profile].terminalContexts[index]?.hadTrayMatch).length, 0) }];
  }));
  const caps = rows.reduce((sum, row) => sum + Object.values(row.profiles).reduce((total, profile) => total + profile.computationCaps, 0), 0);
  const report = { made: new Date().toISOString(), evidence: 'historical-exploratory-joint-intent-first-attempts', targetMet: false,
    sourceHashes: sources, exactFirstAttemptResultControls: rows.length, matchedClockPrefixPairs: rows.reduce((sum, row) => sum + row.clockPrefixPairs, 0),
    computationCaps: caps, summaries, rows,
    note: 'All29 recent targets and32 initial seeds. Prior clock-only win/why/left/moves result records retained. '
      + 'Newly retained per-seed hashes prove exact active-clock tap prefixes through removal/failure, not entire post-clock paths. '
      + 'Terminal contexts are pre-action public observations; skipped-match/reinspection counts are diagnostic, not automatic mistake labels. '
      + 'No generic clock controller or existing numeric forecast change. Initial simulation survival is not whole winning-try accuracy or80% evidence.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/joint-intents-first-audit.json'), JSON.stringify(report));
  console.log(JSON.stringify({ resultControls: rows.length, clockPrefixPairs: report.matchedClockPrefixPairs, caps, summaries }, null, 2));
  if (caps) process.exitCode = 2;
}

if (!isMainThread && workerData?.jointIntentsFirst) parentPort.postMessage({ rows: measure(workerData.entries, workerData.actors, workerData.models) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { clockPrefix };
