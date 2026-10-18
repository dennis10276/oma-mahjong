'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { decodeGame } = require('./personal_game_io.js');
const { boardId } = require('./personal_model.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { handoffFactory } = require('./personal_handoff_choice.js');
const { cueOf } = require('./personal_handoff_cues.js');
const { planFeatures, PARAMETERS } = require('./personal_joint_intents_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { clockPrefix } = require('./personal_joint_intents_first.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const frameParts = frame => ['index', 'kind', 'moves', 'alive', 'tray', 'openPeek'].map(name => frame[name]);

function firstDivergence(before, after, cues) {
  assert.equal(after.length, cues.length, 'Public handoff cues must correspond exactly to physical taps');
  const length = Math.min(before.length, after.length);
  for (let index = 0; index < length; index++) {
    if (JSON.stringify(frameParts(before[index])) === JSON.stringify(frameParts(after[index]))) continue;
    assert(cues[index], 'First changed tap must have an eligible public handoff cue');
    return { index, cue: cues[index], before: before[index].index, after: after[index].index };
  }
  assert.equal(before.length, after.length, 'Path length changed without an earlier changed physical tap');
  return null;
}

function loadContext() {
  const files = new Set();
  const read = filename => { files.add(filename); return JSON.parse(fs.readFileSync(filename)); };
  const modelFile = path.join(archive, 'personal-handoff-models.json'), bank = read(modelFile);
  const snapshot = path.join(root, bank.baseSnapshot), manifest = read(path.join(snapshot, 'manifest.json'));
  const pinned = name => {
    const filename = path.join(snapshot, name);
    assert(manifest.files[name], 'Missing immutable handoff baseline input: ' + name);
    assert.equal(hash(fs.readFileSync(filename)), manifest.files[name]);
    return read(filename);
  };
  const input = pinned('analysis/archive/personal-bots/personal-fresh-count-input.json');
  const previous = pinned('analysis/personal-bots/joint-intents-first-audit.json');
  const base = read(path.join(root, bank.baseFile)), actors = read(path.join(root, bank.historicalActorFile)).models;
  const runtime = read(path.join(root, 'analysis/personal-bots/handoff-runtime-audit.json'));
  assert.equal(hash(fs.readFileSync(modelFile)), runtime.modelsSha256);
  assert.equal(runtime.prefixes, 445); assert.equal(runtime.decisions, 39268);
  for (const [name, expected] of Object.entries(bank.inputHashes)) {
    const filename = path.join(root, name); assert.equal(hash(fs.readFileSync(filename)), expected); files.add(filename);
  }
  for (const [name, expected] of Object.entries(runtime.sourceHashes)) {
    const filename = path.join(root, name); assert.equal(hash(fs.readFileSync(filename)), expected); files.add(filename);
  }
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) files.add(filename);
  const sources = Object.fromEntries([...files].map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  const entries = input.recent.map(entry => {
    const control = previous.rows.find(row => row.name === entry.name && row.start === entry.start);
    assert(control && control.board === entry.board && control.modelId === entry.modelId);
    return { ...entry, controlOutcomes: control.profiles.clockAndTray.outcomes, controlClockPrefixes: control.profiles.clockAndTray.clockPrefixes };
  });
  return { entries, actors, models: bank.models, baseModels: base.models, sources };
}

function checkedModels(entry, actors, models, baseModels) {
  const actor = actors.find(actor => actor.id === entry.modelId), model = models.find(model => model.id === entry.modelId);
  const base = baseModels.find(model => model.id === entry.modelId);
  assert(actor && model && base && actor.name === entry.name && model.name === entry.name);
  assert(actor.historicalExploratoryOnly && actor.trainingCut <= entry.start);
  for (const fitted of [actor, model.handoff, base.clockIntents, base.trayIntents]) {
    assert(fitted.availableThrough === null || fitted.availableThrough < entry.start);
    assert(!fitted.trainedAids.some(aid => entry.excludedAids.includes(aid)));
  }
  return { actor, model: model.handoff, base };
}

function measure(entries, actors, models, baseModels) {
  return entries.map(entry => {
    const { actor, model, base } = checkedModels(entry, actors, models, baseModels);
    const game = decodeGame(entry.game), profiles = {}, logs = {}, divergences = [];
    assert.equal(boardId(game), entry.board);
    const planning = planningCache(PARAMETERS, 16384, planFeatures);
    for (const [name, enabled] of Object.entries({ handoffZero: false, handoff: true })) {
      const outcomes = [], prefixes = [], paths = [], cueCounts = {};
      let computationCaps = 0;
      logs[name] = [];
      for (let run = 0; run < 32; run++) {
        const selector = handoffFactory(actor, base, model, true, enabled), stats = {}, physicalLog = [], cues = [];
        const choose = (decision, draw) => {
          const cue = cueOf(decision, selector.previous());
          const publicCue = cue ? { type: cue.type, clock: decision.kindContext[11] > 0, recipients: cue.indices.slice() } : null;
          cues.push(publicCue);
          if (cue) cueCounts[cue.type] = (cueCounts[cue.type] || 0) + 1;
          return selector(decision, draw);
        };
        const result = Hard.play({ ...game, memory: null, avoidMoves: new Map(), physicalLog },
          { ...physicalActor(actor), physicalPlan: 0, physicalChoice: choose, physicalTrayPlanning: planning, stats },
          20261028 * 7919 + run * 104729, []);
        assert.equal(stats.physicalClockPlans || 0, 0); assert.equal(cues.length, physicalLog.length);
        computationCaps += stats.contextChoiceLimits || 0;
        outcomes.push({ win: result.win, why: result.why, left: result.left, moves: result.moves });
        prefixes.push(clockPrefix(physicalLog, game.clock));
        paths.push(hash(JSON.stringify(physicalLog.map(frameParts))));
        if (!enabled) logs[name].push(physicalLog);
        else divergences.push(firstDivergence(logs.handoffZero[run], physicalLog, cues));
      }
      profiles[name] = { outcomes, clockPrefixes: prefixes, pathHashes: paths, cueCounts, computationCaps };
    }
    assert.deepEqual(profiles.handoffZero.outcomes, entry.controlOutcomes, 'Disabled handoff changed baseline result records');
    assert.deepEqual(profiles.handoffZero.clockPrefixes, entry.controlClockPrefixes, 'Disabled handoff changed baseline clock taps');
    parentPort.postMessage({ progress: { name: entry.name, lv: entry.lv } });
    return { name: entry.name, lv: entry.lv, start: entry.start, board: entry.board, modelId: actor.id, profiles, divergences, planningCache: planning.stats() };
  });
}

async function main() {
  const context = loadContext(), workers = [];
  const progressFile = path.join(root, 'analysis/personal-bots/handoff-first-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), entries: context.entries.length, runs: 32, targetMet: false }) + '\n');
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { handoffFirst: true, ...context,
        entries: context.entries.filter((entry, position) => position % 3 === index) } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Handoff initial diagnostic failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  for (const [name, expected] of Object.entries(context.sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const rows = batches.flat(), summaries = {};
  assert.equal(rows.length, 29);
  for (const name of [...new Set(rows.map(row => row.name))]) summaries[name] = Object.fromEntries(['handoffZero', 'handoff'].map(profile => {
    const own = rows.filter(row => row.name === name), outcomes = own.flatMap(row => row.profiles[profile].outcomes);
    return [profile, { runs: outcomes.length, wins: outcomes.filter(result => result.win).length,
      failures: Object.fromEntries([...new Set(outcomes.filter(result => !result.win).map(result => result.why))]
        .map(reason => [reason, outcomes.filter(result => result.why === reason).length])),
      computationCaps: own.reduce((sum, row) => sum + row.profiles[profile].computationCaps, 0) }];
  }));
  const computationCaps = rows.reduce((sum, row) => sum + Object.values(row.profiles).reduce((total, profile) => total + profile.computationCaps, 0), 0);
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'historical-exploratory-handoff-initial-survival',
    sourceHashes: context.sources, resultControls: rows.length, firstDivergenceCueControls: rows.length * 32,
    computationCaps, summaries, rows,
    note: 'All29 earlier-own recent targets and32 initial seeds. Disabled modifier retains exact baseline result records and active-clock prefixes. '
      + 'Every first changed physical tap has an eligible public handoff cue; enabled clock paths may legitimately change. '
      + 'Full path hashes are retained for this paired comparison. Initial simulation survival is not winning-try accuracy or80% evidence. '
      + 'Common retry memory is not individually fitted; no numeric forecast is replaced or promoted.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/handoff-first-audit.json'), JSON.stringify(report));
  console.log(JSON.stringify({ resultControls: rows.length, computationCaps, summaries }, null, 2));
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread && workerData?.handoffFirst) parentPort.postMessage({ rows: measure(workerData.entries, workerData.actors, workerData.models, workerData.baseModels) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { firstDivergence, loadContext, checkedModels };
