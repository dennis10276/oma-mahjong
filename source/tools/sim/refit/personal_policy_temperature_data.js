'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { NAMES, CONFIG, boardId } = require('./personal_model.js');
const { PIDS, boardOf } = require('./mimic_games.js');
const { designed } = require('./boards.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { jointIntentAttemptFactory } = require('./personal_joint_intents_choice.js');
const { temperedAttemptFactory } = require('./personal_tempered_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { PARAMETERS, planFeatures } = require('./personal_joint_planning_fast.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const profiles = Object.freeze({ confidence025: { temperature: .25 }, confidence050: { temperature: .5 },
  confidence100: { temperature: 1 }, confidence150: { temperature: 1.5 } });
const inputName = 'analysis/archive/personal-bots/personal-policy-temperature-input.json';

function eligibleRows(rows, name, cutoff) {
  const eligible = rows.filter(row => row.name === name && row.end < cutoff && Number.isInteger(row.wonOn)
    && row.wonOn >= 1 && row.firstAttempt === 1 && row.firstClear === true
    && !row.assisted && row.boardChangedWithinCampaign === false).sort((left, right) => left.end - right.end).slice(-20);
  assert.equal(eligible.length, 20, 'Need20 verified prior first-clear boards for ' + name);
  assert.equal(new Set(eligible.map(row => row.lv)).size, 20, 'Replay levels cannot duplicate own calibration');
  assert.equal(new Set(eligible.map(row => row.start)).size, 20);
  return eligible;
}

function restoreBoard(row, replays) {
  for (const aid of row.campaignAids || row.excludedAids || []) for (const chunk of Object.values(replays[aid] || {})) {
    if (!chunk?.data) continue;
    const initial = JSON.parse(chunk.data).init;
    if (!initial || initial.partial || initial.track || !initial.state) continue;
    const game = boardOf(initial);
    if (boardId(game) === row.board) return game;
  }
  if (row.source === 'table') {
    const game = designed(row.version, row.lv);
    if (game && boardId(game) === row.board) return game;
  }
  throw new Error('Cannot restore exact prior calibration board: ' + row.name + '/' + row.lv);
}

function prepare() {
  const sources = {}, read = relative => {
    const filename = path.join(root, relative), bytes = fs.readFileSync(filename);
    sources[relative] = hash(bytes); return JSON.parse(bytes);
  };
  const pinned = (folder, relative) => {
    const manifest = read(folder + '/manifest.json'), full = folder + '/' + relative;
    assert(manifest.files[relative], 'Missing immutable calibration dependency: ' + relative);
    const value = read(full); assert.equal(sources[full], manifest.files[relative]); return value;
  };
  const jointSnapshot = 'analysis/archive/personal-bots/experiments/personal-joint-intents-first-2026-10-18T20-50-31-269Z';
  const countsSnapshot = 'analysis/archive/personal-bots/experiments/personal-fresh-count-scored-2026-10-18T16-19-59-198Z';
  const bank = pinned(jointSnapshot, 'analysis/archive/personal-bots/personal-tray-intents-models.json');
  const countsManifest = read(countsSnapshot + '/manifest.json');
  const countsFile = countsManifest.countRun + '/analysis/archive/personal-bots/physical-fresh-count-data.json';
  assert(countsManifest.externalPinnedDependencies[countsFile]);
  const counts = read(countsFile);
  assert.equal(sources[countsFile], countsManifest.externalPinnedDependencies[countsFile]);
  const actorFile = bank.staticActorSnapshot + '/analysis/archive/personal-bots/personal-fresh-own-models.json';
  const actors = read(actorFile).models, cutoff = Date.now(), entries = [], models = [];
  assert.equal(sources[actorFile], bank.inputHashes[actorFile]);
  for (const name of NAMES) {
    const actor = actors.find(value => value.name === name && !value.historicalExploratoryOnly);
    const model = bank.models.find(value => value.id === actor?.id && value.name === name && !value.historicalExploratoryOnly);
    assert(actor && model && actor.trainingCut < cutoff && actor.inputObservedThrough < actor.trainingCut);
    for (const component of [model.clockIntents, model.trayIntents]) assert(component.availableThrough === null || component.availableThrough < cutoff);
    models.push(model);
    const replays = pinned(bank.staticActorSnapshot, 'analysis/archive/replays/' + PIDS[name] + '.json');
    for (const row of eligibleRows(counts.rows, name, cutoff)) {
      const { chains, physical, reference, ...metadata } = row;
      const game = restoreBoard(row, replays);
      assert.equal(boardId(game), row.board);
      entries.push({ ...metadata, campaignAids: row.campaignAids || row.excludedAids,
        modelId: actor.id, game: encodeGame(game) });
    }
  }
  assert.equal(entries.length, 80);
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    sources[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  }
  for (const filename of ['personal_policy_temperature_fit.py', 'attempt_count_fit.py']) {
    const relative = 'tools/sim/refit/' + filename; sources[relative] = hash(fs.readFileSync(path.join(root, relative)));
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-'), runRoot = path.join(archive, 'runs/personal-temperature-' + stamp);
  const input = { made: new Date().toISOString(), evidence: 'own-future-policy-count-calibration-input-training-only', targetMet: false,
    cutoff, profiles, entries, actors, models, sourceHashes: sources,
    note: 'Exactly20 verified unassisted first-clear boards per person. The SAME current own actor is simulated for all of that person’s prior boards. '
      + 'These are training outcomes, not held accuracy; current actors/intents may have seen their recordings. '
      + 'Older verified fixed-table counts without recorded start events remain training-only, never pre-start evidence. No numeric forecast is frozen.' };
  fs.mkdirSync(runRoot, { recursive: true });
  for (const [relative, expected] of Object.entries(sources)) {
    const source = path.join(root, relative), destination = path.join(runRoot, relative);
    assert.equal(hash(fs.readFileSync(source)), expected);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination);
    assert.equal(hash(fs.readFileSync(destination)), expected);
  }
  const inputFile = path.join(runRoot, inputName); fs.mkdirSync(path.dirname(inputFile), { recursive: true });
  fs.writeFileSync(inputFile, JSON.stringify(input), { flag: 'wx' });
  fs.writeFileSync(path.join(runRoot, 'temperature-run-manifest.json'), JSON.stringify({ made: input.made, sourceHashes: sources,
    inputSha256: hash(fs.readFileSync(inputFile)), targetMet: false, workspaceRoot: root,
    evidence: 'immutable-personal-policy-count-calibration-run' }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ runRoot, entries: entries.length,
    levels: Object.fromEntries(NAMES.map(name => [name, entries.filter(row => row.name === name).map(row => row.lv)])) }, null, 2));
}

function chain(game, actor, model, temperature, runs, attempts, control = false) {
  const factory = control ? jointIntentAttemptFactory(actor, model.clockIntents, model.trayIntents, true)
    : temperedAttemptFactory(actor, model, temperature);
  const planning = planningCache(PARAMETERS, 4096, planFeatures), stats = {};
  factory.physicalTrayPlanning = planning;
  const persona = { ...physicalActor(actor), physicalPlan: 0, memory: CONFIG.memory, learnFromLoss: true,
    physicalChoiceForAttempt: factory, physicalTrayPlanning: planning, stats };
  const result = Hard.rateChain(game, runs, 20261028, persona, CONFIG.memory, attempts);
  assert.equal(stats.physicalClockPlans || 0, 0);
  assert.equal(result.computationCensored || 0, stats.contextChoiceLimits || 0);
  return result;
}

function measure(entries, actors, models, runs, attempts, priorPilot) {
  return entries.map(entry => {
    const actor = actors.find(value => value.id === entry.modelId && value.name === entry.name);
    const model = models.find(value => value.id === entry.modelId && value.name === entry.name);
    assert(actor && model && !actor.historicalExploratoryOnly && !model.historicalExploratoryOnly);
    const game = decodeGame(entry.game), chains = {}, computationCaps = {};
    assert.equal(boardId(game), entry.board);
    const control = chain(game, actor, model, 1, 2, 3, true);
    assert.deepEqual(chain(game, actor, model, 1, 2, 3), control, 'Temperature1 changed current own full retry lifecycle');
    const old = priorPilot?.rows.find(row => row.name === entry.name && row.start === entry.start);
    if (old) assert.deepEqual(old.exactBaselineControl, control);
    for (const [profile, settings] of Object.entries(profiles)) {
      if (old) assert.deepEqual(chain(game, actor, model, settings.temperature, 2, 3), old.chains[profile]);
      chains[profile] = chain(game, actor, model, settings.temperature, runs, attempts);
      computationCaps[profile] = chains[profile].computationCensored || 0;
    }
    const { game: encoded, ...metadata } = entry;
    parentPort?.postMessage({ progress: { name: entry.name, lv: entry.lv, caps: computationCaps } });
    return { ...metadata, chains, computationCaps, exactBaselineControl: control };
  });
}

async function main(mode) {
  if (mode === 'prepare') return prepare();
  assert(['pilot', 'full'].includes(mode), 'Use prepare, pilot or full');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'temperature-run-manifest.json')));
  assert.equal(manifest.evidence, 'immutable-personal-policy-count-calibration-run');
  assert.equal(hash(fs.readFileSync(path.join(root, inputName))), manifest.inputSha256);
  const verify = () => { for (const [relative, expected] of Object.entries(manifest.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected); };
  verify();
  const input = JSON.parse(fs.readFileSync(path.join(root, inputName))), isPilot = mode === 'pilot';
  assert.equal(input.entries.length, 80);
  const entries = isPilot ? NAMES.map(name => input.entries.filter(row => row.name === name).at(-1)) : input.entries;
  const pilotFile = path.join(archive, 'personal-policy-temperature-pilot.json');
  const priorPilot = isPilot ? null : JSON.parse(fs.readFileSync(pilotFile));
  if (priorPilot) assert.equal(priorPilot.inputSha256, manifest.inputSha256);
  const output = path.join(archive, 'personal-policy-temperature-' + (isPilot ? 'pilot' : 'data') + '.json');
  assert(!fs.existsSync(output), 'Do not overwrite completed calibration or pilot data');
  const progressFile = path.join(archive, 'personal-policy-temperature-' + mode + '-progress.jsonl');
  assert(!fs.existsSync(progressFile), 'Inspect the owned process before attempting to restart a run');
  const started = new Date().toISOString(), runs = isPilot ? 2 : 8, attempts = isPilot ? 3 : 8, workers = [];
  fs.writeFileSync(progressFile, JSON.stringify({ started, entries: entries.length, runs, attempts }) + '\n', { flag: 'wx' });
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { temperatureCounts: true, actors: input.actors, models: input.models,
        runs, attempts, priorPilot, entries: entries.filter((entry, position) => position % 3 === index) } });
      workers.push(worker);
      worker.on('message', message => { if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n'); });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Temperature count worker failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  verify();
  const rows = batches.flat(), computationCaps = rows.reduce((sum, row) => sum + Object.values(row.computationCaps).reduce((total, value) => total + value, 0), 0);
  assert.equal(rows.length, entries.length);
  const sourceHashes = { ...manifest.sourceHashes, [inputName]: manifest.inputSha256,
    'temperature-run-manifest.json': hash(fs.readFileSync(path.join(root, 'temperature-run-manifest.json'))) };
  const report = { made: new Date().toISOString(), started, sourceRoot: root, sourceHashes, inputSha256: manifest.inputSha256,
    evidence: isPilot ? 'own-policy-temperature-lifecycle-pilot-only' : 'own-future-policy-count-calibration-training-only', targetMet: false,
    runs, attempts, computationCaps, exactBaselineControls: rows.length, pairedPilotControls: isPilot ? 0 : priorPilot.rows.length * 4,
    profiles, actors: Object.fromEntries(input.actors.map(actor => [actor.name, { name: actor.name, id: actor.id }])), rows,
    note: 'Prior own first-clear outcomes are calibration training only, never held or pre-start forecast accuracy. '
      + 'Each person retains their own current actor and preferences; temperature1 matches a freshly paired untempered lifecycle. '
      + 'Full8x8 reruns all frozen2x3 pilots. Computational caps remain explicit censoring, not human failures.' };
  fs.writeFileSync(output, JSON.stringify(report), { flag: 'wx' });
  console.log(JSON.stringify({ mode, rows: rows.length, runs, attempts, computationCaps, output }));
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread && workerData?.temperatureCounts) parentPort.postMessage({ rows: measure(workerData.entries, workerData.actors,
  workerData.models, workerData.runs, workerData.attempts, workerData.priorPilot) });
else if (require.main === module) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { eligibleRows, restoreBoard, chain };
