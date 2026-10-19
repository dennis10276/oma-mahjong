'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { NAMES, boardId } = require('./personal_model.js');
const { PIDS } = require('./mimic_games.js');
const { progressionTargets } = require('./progression_targets.js');
const { tableVersion } = require('./board_versions.js');
const { designed } = require('./boards.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { controllerIdentity, chain } = require('./personal_attention_count_data.js');
const { chain: baselineChain } = require('./personal_policy_temperature_data.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inputName = 'analysis/archive/personal-bots/personal-attention-future-input.json';

function unopenedLevels(target, events) {
  const opened = new Set(Object.values(events || {}).filter(event => event.k === 'start' && event.m !== 'd' && !event.tk).map(event => event.lv));
  return target.levels.filter(level => level >= target.first && !opened.has(level));
}

function prepare(argument) {
  assert(argument, 'Supply a new read-only opening snapshot after the actual own confidence fit');
  const sources = {}, read = filename => {
    const resolved = path.resolve(filename); assert(resolved.startsWith(root + path.sep));
    const bytes = fs.readFileSync(resolved); sources[path.relative(root, resolved).replace(/\\/g, '/')] = hash(bytes); return JSON.parse(bytes);
  };
  const confidenceFile = path.join(archive, 'personal-attention-log-temperature-models.json'), confidence = read(confidenceFile);
  assert.equal(confidence.evidence, 'own-future-attention-confidence-fit-to-prior-counts-training-only');
  for (const [name, expected] of Object.entries(confidence.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(__dirname, name))), expected);
  const calibration = read(confidence.dataFile); assert.equal(hash(fs.readFileSync(confidence.dataFile)), confidence.dataSha256);
  const calibrationRoot = path.resolve(confidence.dataSourceRoot);
  assert(calibrationRoot.startsWith(path.join(archive, 'runs') + path.sep));
  for (const [relative, expected] of Object.entries(calibration.sourceHashes)) {
    const filename = path.resolve(calibrationRoot, relative); assert(filename.startsWith(calibrationRoot + path.sep));
    assert.equal(hash(fs.readFileSync(filename)), expected);
  }
  assert.equal(calibration.evidence, 'own-future-attention-policy-count-calibration-training-only');
  assert.equal(calibration.runs, 8); assert.equal(calibration.attempts, 8); assert.equal(calibration.rows.length, 80);
  assert.deepEqual(calibration.actors, confidence.controllers);
  const calibratedInputName = 'analysis/archive/personal-bots/personal-attention-count-input.json';
  const calibratedInput = read(path.join(calibrationRoot, calibratedInputName));
  assert.equal(hash(fs.readFileSync(path.join(calibrationRoot, calibratedInputName))), calibration.inputSha256);
  assert.equal(calibration.attentionModelSha256, confidence.attentionModelSha256);
  const live = path.resolve(argument); assert(live.startsWith(path.join(archive, 'live-openings-')));
  const liveManifest = read(path.join(live, 'manifest.json')), preparedAt = Date.now();
  assert.equal(liveManifest.evidence, 'read-only-live-opening-check');
  assert(Date.parse(confidence.made) < Date.parse(liveManifest.made));
  assert(Date.parse(liveManifest.made) <= preparedAt && preparedAt - Date.parse(liveManifest.made) < 120000);
  const plays = read(path.join(live, 'plays.json')), scores = read(path.join(live, 'scores.json'));
  for (const name of ['plays', 'scores']) assert.equal(hash(fs.readFileSync(path.join(live, name + '.json'))), liveManifest.files[name + '.json']);
  const targets = {}, entries = [];
  for (const name of NAMES) {
    const latestVersion = Object.values(plays[PIDS[name]] || {}).filter(event => event.v)
      .sort((left, right) => left.t - right.t).at(-1)?.v;
    assert.equal(tableVersion(latestVersion), '1.55', 'An unsupported app version cannot borrow older normal-level tables');
    const binding = confidence.controllers[name], selected = confidence.selected[name];
    const actor = calibratedInput.actors.find(value => value.name === name && value.id === binding.staticActorId);
    const base = calibratedInput.models.find(value => value.id === actor?.id), model = calibratedInput.attentionModels.find(value => value.id === actor?.id);
    assert(actor && base && model); assert.deepEqual(controllerIdentity(actor, base, model), binding);
    assert.equal(selected.actorId, binding.id);
    assert.equal(calibration.profiles[selected.selectedProfile].temperature, selected.temperature);
    assert(!selected.computationCensoredCandidates.includes(selected.selectedProfile));
    const own = calibration.rows.filter(row => row.name === name);
    assert.equal(own.length, 20);
    assert(own.every(row => row.modelId === binding.id && row.end < confidence.actualFitRequest
      && !row.computationCaps[selected.selectedProfile] && !row.chains[selected.selectedProfile].computationCensored));
    const target = progressionTargets(plays[PIDS[name]], scores[PIDS[name]], 24), levels = unopenedLevels(target, plays[PIDS[name]]);
    assert(levels.length >= 20, 'At least20 unopened future levels are required for each own candidate');
    targets[name] = { ...target, unopened: levels };
    for (const lv of levels) {
      const game = designed(target.version, lv); assert(game);
      entries.push({ name, lv, version: target.version, board: boardId(game), modelId: binding.id,
        staticActorId: actor.id, selectedProfile: selected.selectedProfile, temperature: selected.temperature,
        firstAttempt: 1, firstClear: true, game: encodeGame(game) });
    }
  }
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    sources[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  }
  for (const filename of ['personal_attention_future.py', 'personal_attention_future_head.py', 'personal_attention_count_fit.py',
    'personal_policy_temperature_fit.py', 'attempt_count_fit.py', 'personal_value_fit.py', 'prospective.py', 'progression_score.py']) {
    const relative = 'tools/sim/refit/' + filename; sources[relative] = hash(fs.readFileSync(path.join(root, relative)));
  }
  for (const filename of fs.readdirSync(path.join(__dirname, 'tables')).filter(name => /^(levels|hard|early)-.*\.js$/.test(name))) {
    const relative = 'tools/sim/refit/tables/' + filename; sources[relative] = hash(fs.readFileSync(path.join(root, relative)));
  }
  const made = new Date().toISOString(), runRoot = path.join(archive, 'runs/personal-attention-future-' + made.replace(/[:.]/g, '-'));
  const input = { made, preparedAt, evidence: 'own-log-attention-unopened-future-input-not-numeric-forecasts', targetMet: false,
    entries, targets, actors: calibratedInput.actors, models: calibratedInput.models, attentionModels: calibratedInput.attentionModels,
    controllers: confidence.controllers, selected: confidence.selected, confidenceReadyAt: confidence.made,
    confidenceSha256: hash(fs.readFileSync(confidenceFile)), calibrationSha256: confidence.dataSha256,
    liveSnapshot: path.relative(root, live).replace(/\\/g, '/'), liveManifestSha256: hash(fs.readFileSync(path.join(live, 'manifest.json'))),
    sourceHashes: sources,
    note: 'Source-bound selected own controllers on exact unopened fixed boards. No human target outcomes or generic reference scores. '
      + 'This is planning eligibility only, not a numeric forecast freeze. Actual opening timestamps must be checked again after measurement.' };
  fs.mkdirSync(runRoot);
  for (const [relative, expected] of Object.entries(sources)) {
    const source = path.join(root, relative), destination = path.join(runRoot, relative); assert.equal(hash(fs.readFileSync(source)), expected);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination);
    assert.equal(hash(fs.readFileSync(destination)), expected);
  }
  const filename = path.join(runRoot, inputName); fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(input), { flag: 'wx' });
  fs.writeFileSync(path.join(runRoot, 'attention-future-run-manifest.json'), JSON.stringify({ made, targetMet: false,
    evidence: 'immutable-own-log-attention-future-measurement-run', sourceHashes: sources, inputSha256: hash(fs.readFileSync(filename)),
    workspaceRoot: root }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ runRoot, entries: entries.length,
    levels: Object.fromEntries(NAMES.map(name => [name, targets[name].unopened])),
    temperatures: Object.fromEntries(NAMES.map(name => [name, confidence.selected[name].temperature])) }, null, 2));
}

function measure(entries, input, isPilot, priorPilot) {
  const runs = isPilot ? 2 : 32, attempts = isPilot ? 3 : 9;
  return entries.map(entry => {
    const actor = input.actors.find(value => value.id === entry.staticActorId && value.name === entry.name);
    const base = input.models.find(value => value.id === actor.id), model = input.attentionModels.find(value => value.id === actor.id);
    assert.deepEqual(controllerIdentity(actor, base, model), input.controllers[entry.name]);
    assert.equal(input.controllers[entry.name].id, entry.modelId);
    const game = decodeGame(entry.game); assert.equal(boardId(game), entry.board);
    const zero = { ...model, attention: { ...model.attention, weights: [0, 0] } };
    const control = baselineChain(game, actor, base, 1, 2, 3, true);
    assert.deepEqual(chain(game, actor, base, zero, 1, 2, 3), control, 'Fresh future zero-attention lifecycle changed');
    if (priorPilot) {
      const prior = priorPilot.rows.find(row => row.name === entry.name && row.lv === entry.lv && row.board === entry.board);
      assert(prior && prior.modelId === entry.modelId);
      assert.deepEqual(chain(game, actor, base, model, entry.temperature, 2, 3), prior.chain);
    }
    const measured = chain(game, actor, base, model, entry.temperature, runs, attempts);
    parentPort?.postMessage({ progress: { name: entry.name, lv: entry.lv, caps: measured.computationCensored || 0 } });
    const { game: encoded, ...metadata } = entry;
    return { ...metadata, chain: measured, computationCaps: measured.computationCensored || 0, exactZeroPilotControl: control };
  });
}

async function main(mode, argument) {
  if (mode === 'prepare') return prepare(argument);
  assert(['pilot', 'full'].includes(mode));
  const manifestFile = path.join(root, 'attention-future-run-manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestFile));
  assert.equal(manifest.evidence, 'immutable-own-log-attention-future-measurement-run');
  assert.equal(hash(fs.readFileSync(path.join(root, inputName))), manifest.inputSha256);
  const input = JSON.parse(fs.readFileSync(path.join(root, inputName))), isPilot = mode === 'pilot';
  const verify = () => { for (const [relative, expected] of Object.entries(manifest.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected); };
  verify();
  const pilotFile = path.join(archive, 'personal-attention-future-pilot.json'), priorPilot = isPilot ? null : JSON.parse(fs.readFileSync(pilotFile));
  const priorPilotSha = isPilot ? null : hash(fs.readFileSync(pilotFile));
  if (priorPilot) assert.equal(priorPilot.inputSha256, manifest.inputSha256);
  const output = path.join(archive, 'personal-attention-future-' + (isPilot ? 'pilot' : 'data') + '.json');
  const progressFile = path.join(archive, 'personal-attention-future-' + mode + '-progress.jsonl');
  assert(!fs.existsSync(output) && !fs.existsSync(progressFile), 'Inspect actual owned process status; never overwrite/restart a live or completed measurement');
  const started = new Date().toISOString(), workers = [];
  fs.writeFileSync(progressFile, JSON.stringify({ started, entries: input.entries.length, mode, runs: isPilot ? 2 : 32, attempts: isPilot ? 3 : 9 }) + '\n', { flag: 'wx' });
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { attentionFuture: true, input, isPilot, priorPilot,
        entries: input.entries.filter((entry, position) => position % 3 === index) } });
      workers.push(worker);
      worker.on('message', message => { if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n'); });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Own future measurement worker failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  verify(); if (priorPilotSha) assert.equal(hash(fs.readFileSync(pilotFile)), priorPilotSha);
  const rows = batches.flat(); assert.equal(rows.length, input.entries.length);
  const computationCaps = rows.reduce((sum, row) => sum + row.computationCaps, 0);
  const report = { made: new Date().toISOString(), started, targetMet: false, sourceRoot: root,
    evidence: isPilot ? 'own-log-attention-future-pilot-only' : 'own-log-attention-future-counts-not-frozen',
    inputSha256: manifest.inputSha256, confidenceReadyAt: input.confidenceReadyAt, confidenceSha256: input.confidenceSha256,
    calibrationSha256: input.calibrationSha256, runs: isPilot ? 2 : 32, attempts: isPilot ? 3 : 9,
    computationCaps, validUncensoredSimulation: computationCaps === 0, pairedPilotControls: isPilot ? 0 : rows.length,
    exactZeroPilotControls: rows.length, controllers: input.controllers, selected: input.selected, targets: input.targets,
    sourceHashes: { ...manifest.sourceHashes, [inputName]: manifest.inputSha256, 'attention-future-run-manifest.json': hash(fs.readFileSync(manifestFile)),
      ...(priorPilotSha ? { 'analysis/archive/personal-bots/personal-attention-future-pilot.json': priorPilotSha } : {}) }, rows,
    note: 'New32x9 selected own-controller simulation, not reused calibration/pilot chains or a numeric pre-opening freeze. '
      + 'All prepared targets remain; caps invalidate freezing rather than hiding hard levels. Exact1..9 and unresolved10+ preserve the full user scoring.' };
  fs.writeFileSync(output, JSON.stringify(report), { flag: 'wx' });
  console.log(JSON.stringify({ mode, rows: rows.length, computationCaps, output }));
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread && workerData?.attentionFuture) parentPort.postMessage({ rows: measure(workerData.entries, workerData.input,
  workerData.isPilot, workerData.priorPilot) });
else if (require.main === module) main(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { unopenedLevels };
