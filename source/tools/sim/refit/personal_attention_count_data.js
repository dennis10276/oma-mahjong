'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { CONFIG, NAMES, boardId } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { attentionAttemptFactory } = require('./personal_attention_count_choice.js');
const { chain: baselineChain } = require('./personal_policy_temperature_data.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inputName = 'analysis/archive/personal-bots/personal-attention-count-input.json';
const profiles = Object.freeze({ confidence025: { temperature: .25 }, confidence050: { temperature: .5 },
  confidence100: { temperature: 1 }, confidence150: { temperature: 1.5 } });

function controllerIdentity(actor, base, attention) {
  assert(actor.id === base.id && actor.id === attention.id && actor.name === base.name && actor.name === attention.name);
  const definition = JSON.stringify({ name: actor.name, staticActorId: actor.id,
    staticSha256: hash(JSON.stringify(actor)), jointSha256: hash(JSON.stringify(base)), attentionSha256: hash(JSON.stringify(attention)) });
  return { id: hash(definition), name: actor.name, staticActorId: actor.id, definition };
}

function prepare(argument) {
  assert(argument, 'Supply the original owned immutable calibration run');
  const originalRoot = path.resolve(argument);
  assert(originalRoot.startsWith(path.join(archive, 'runs') + path.sep));
  const sources = {}, read = filename => {
    const resolved = path.resolve(filename); assert(resolved.startsWith(root + path.sep));
    const bytes = fs.readFileSync(resolved); sources[path.relative(root, resolved).replace(/\\/g, '/')] = hash(bytes); return JSON.parse(bytes);
  };
  const originalManifest = read(path.join(originalRoot, 'temperature-run-manifest.json'));
  const originalFile = path.join(originalRoot, 'analysis/archive/personal-bots/personal-policy-temperature-input.json');
  const original = read(originalFile); assert.equal(hash(fs.readFileSync(originalFile)), originalManifest.inputSha256);
  const modelFile = path.join(archive, 'personal-attention-log-models.json'), bank = read(modelFile);
  const runtime = read(path.join(root, 'analysis/personal-bots/attention-log-runtime-audit.json'));
  assert.equal(bank.variant, 'log'); assert.equal(runtime.modelsSha256, hash(fs.readFileSync(modelFile)));
  assert.equal(runtime.prefixes, 445); assert.equal(runtime.decisions, 39268);
  for (const [relative, expected] of Object.entries({ ...bank.inputHashes, ...runtime.sourceHashes })) {
    const bytes = fs.readFileSync(path.join(root, relative)); sources[relative] = hash(bytes);
    assert.equal(sources[relative], expected);
  }
  for (const [name, expected] of Object.entries({ ...bank.sourceHashes, ...bank.runtimeSourceHashes })) {
    const filename = path.join(__dirname, name); assert.equal(hash(fs.readFileSync(filename)), expected);
    sources['tools/sim/refit/' + name] = expected;
  }
  const baselineBank = JSON.parse(fs.readFileSync(path.join(root, bank.baseFile))), bindings = {};
  const cutoff = Date.now(); assert(Date.parse(bank.made) < Date.parse(runtime.made) && Date.parse(runtime.made) < cutoff);
  assert.equal(original.entries.length, 80);
  for (const actor of original.actors) {
    const base = original.models.find(value => value.id === actor.id), attention = bank.models.find(value => value.id === actor.id && value.name === actor.name);
    assert(attention && attention.attention.type === 'personalInspectionAttentionLog-v2' && attention.attention.strengthLimit === null);
    assert.deepEqual(base, baselineBank.models.find(value => value.id === actor.id));
    assert(attention.attention.availableThrough < cutoff);
    bindings[actor.name] = controllerIdentity(actor, base, attention);
  }
  const entries = original.entries.map(entry => ({ ...entry, staticActorId: entry.modelId, modelId: bindings[entry.name].id }));
  for (const name of NAMES) assert.equal(entries.filter(entry => entry.name === name).length, 20);
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    sources[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  }
  for (const name of ['personal_attention_count_fit.py', 'personal_policy_temperature_fit.py', 'personal_value_fit.py', 'attempt_count_fit.py']) {
    sources['tools/sim/refit/' + name] = hash(fs.readFileSync(path.join(__dirname, name)));
  }
  const input = { made: new Date().toISOString(), cutoff, targetMet: false,
    evidence: 'own-attention-log-count-calibration-input-training-only', profiles, entries, actors: original.actors,
    models: original.models, attentionModels: bank.models, bindings, sourceHashes: sources,
    originalRunRoot: originalRoot, originalInputSha256: originalManifest.inputSha256,
    attentionModelReadyAt: bank.made, attentionModelSha256: hash(fs.readFileSync(modelFile)),
    note: 'Same exact20 prior first-clear boards per person, but a NEW source-bound own attention controller. '
      + 'Old no-attention counts cannot be substituted as calibration. Zero controls may compare completed original counts separately.' };
  const runRoot = path.join(archive, 'runs/personal-attention-count-' + input.made.replace(/[:.]/g, '-'));
  fs.mkdirSync(runRoot);
  for (const [relative, expected] of Object.entries(sources)) {
    const source = path.join(root, relative), destination = path.join(runRoot, relative);
    assert.equal(hash(fs.readFileSync(source)), expected);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination);
    assert.equal(hash(fs.readFileSync(destination)), expected);
  }
  const filename = path.join(runRoot, inputName); fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(input), { flag: 'wx' });
  fs.writeFileSync(path.join(runRoot, 'attention-count-run-manifest.json'), JSON.stringify({ made: input.made, targetMet: false,
    evidence: 'immutable-own-attention-count-calibration-run', sourceHashes: sources, inputSha256: hash(fs.readFileSync(filename)),
    workspaceRoot: root }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ runRoot, entries: entries.length, controllerIds: bindings }, null, 2));
}

function chain(game, actor, base, model, temperature, runs, attempts) {
  const factory = attentionAttemptFactory(actor, base, model, temperature), stats = {};
  const persona = { ...physicalActor(actor), physicalPlan: 0, memory: CONFIG.memory, learnFromLoss: true,
    physicalChoiceForAttempt: factory, physicalTrayPlanning: factory.physicalTrayPlanning, stats };
  const result = Hard.rateChain(game, runs, 20261028, persona, CONFIG.memory, attempts);
  assert.equal(result.computationCensored || 0, stats.contextChoiceLimits || 0);
  assert.equal(stats.physicalClockPlans || 0, 0);
  return result;
}

function measure(entries, input, isPilot, priorPilot, oldFull) {
  const runs = isPilot ? 2 : 8, attempts = isPilot ? 3 : 8;
  return entries.map(entry => {
    const actor = input.actors.find(value => value.id === entry.staticActorId && value.name === entry.name);
    const base = input.models.find(value => value.id === actor.id), model = input.attentionModels.find(value => value.id === actor.id);
    assert.deepEqual(controllerIdentity(actor, base, model), input.bindings[entry.name]);
    assert.equal(entry.modelId, input.bindings[entry.name].id);
    const game = decodeGame(entry.game); assert.equal(boardId(game), entry.board);
    const zero = { ...model, attention: { ...model.attention, weights: [0, 0] } };
    const control = baselineChain(game, actor, base, 1, 2, 3, true);
    assert.deepEqual(chain(game, actor, base, zero, 1, 2, 3), control, 'Zero attention changed own retry lifecycle');
    const oldPilot = priorPilot?.rows.find(row => row.name === entry.name && row.start === entry.start);
    const chains = {}, computationCaps = {};
    for (const [profile, settings] of Object.entries(profiles)) {
      if (oldPilot) assert.deepEqual(chain(game, actor, base, model, settings.temperature, 2, 3), oldPilot.chains[profile]);
      chains[profile] = chain(game, actor, base, model, settings.temperature, runs, attempts);
      computationCaps[profile] = chains[profile].computationCensored || 0;
    }
    let fullBaseline = null;
    if (!isPilot) {
      fullBaseline = chain(game, actor, base, zero, 1, 8, 8);
      assert.deepEqual(fullBaseline, baselineChain(game, actor, base, 1, 8, 8, true),
        'Fresh full zero-attention and untempered own lifecycles differ');
    }
    if (oldFull) {
      const previous = oldFull.rows.find(row => row.name === entry.name && row.start === entry.start && row.board === entry.board);
      assert(previous && previous.modelId === actor.id);
      assert.deepEqual(fullBaseline, previous.chains.confidence100, 'Completed old baseline differs from current exact zero controller');
    }
    parentPort?.postMessage({ progress: { name: entry.name, lv: entry.lv, caps: computationCaps } });
    const { game: encoded, ...metadata } = entry;
    return { ...metadata, chains, computationCaps, exactZeroPilotControl: control, fullBaseline };
  });
}

async function main(mode, argument) {
  if (mode === 'prepare') return prepare(argument);
  assert(['pilot', 'full'].includes(mode));
  const manifestFile = path.join(root, 'attention-count-run-manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestFile));
  assert.equal(manifest.evidence, 'immutable-own-attention-count-calibration-run');
  const inputFile = path.join(root, inputName); assert.equal(hash(fs.readFileSync(inputFile)), manifest.inputSha256);
  const input = JSON.parse(fs.readFileSync(inputFile)), isPilot = mode === 'pilot';
  const verify = () => { for (const [relative, expected] of Object.entries(manifest.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected); };
  verify();
  const pilotFile = path.join(archive, 'personal-attention-count-pilot.json');
  const priorPilot = isPilot ? null : JSON.parse(fs.readFileSync(pilotFile));
  const priorPilotSha256 = isPilot ? null : hash(fs.readFileSync(pilotFile));
  if (priorPilot) assert.equal(priorPilot.inputSha256, manifest.inputSha256);
  let oldFull = null, oldFullFile = null, oldFullSha256 = null;
  if (!isPilot) {
    oldFullFile = path.join(input.originalRunRoot, 'analysis/archive/personal-bots/personal-policy-temperature-data.json');
    if (fs.existsSync(oldFullFile)) {
      oldFullSha256 = hash(fs.readFileSync(oldFullFile)); oldFull = JSON.parse(fs.readFileSync(oldFullFile));
      assert.equal(oldFull.evidence, 'own-future-policy-count-calibration-training-only');
      assert.equal(oldFull.runs, 8); assert.equal(oldFull.attempts, 8); assert.equal(oldFull.rows.length, 80);
      assert.equal(oldFull.inputSha256, input.originalInputSha256);
      assert.equal(path.resolve(oldFull.sourceRoot), path.resolve(input.originalRunRoot));
      for (const [relative, expected] of Object.entries(oldFull.sourceHashes)) {
        assert.equal(hash(fs.readFileSync(path.join(input.originalRunRoot, relative))), expected);
      }
    } else {
      oldFullFile = null;
    }
  }
  const entries = isPilot ? NAMES.map(name => input.entries.filter(row => row.name === name).at(-1)) : input.entries;
  const output = path.join(archive, 'personal-attention-count-' + (isPilot ? 'pilot' : 'data') + '.json');
  const progressFile = path.join(archive, 'personal-attention-count-' + mode + '-progress.jsonl');
  assert(!fs.existsSync(output) && !fs.existsSync(progressFile), 'Inspect the owned process; completed or live count runs cannot be overwritten/restarted');
  const started = new Date().toISOString(), workers = [];
  fs.writeFileSync(progressFile, JSON.stringify({ started, entries: entries.length, mode }) + '\n', { flag: 'wx' });
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { attentionCounts: true, input, isPilot, priorPilot, oldFull,
        entries: entries.filter((entry, position) => position % 3 === index) } });
      workers.push(worker);
      worker.on('message', message => { if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n'); });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Attention count worker failed')); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  verify();
  if (oldFullFile) assert.equal(hash(fs.readFileSync(oldFullFile)), oldFullSha256);
  if (priorPilotSha256) assert.equal(hash(fs.readFileSync(pilotFile)), priorPilotSha256);
  const rows = batches.flat(), computationCaps = rows.reduce((sum, row) => sum + Object.values(row.computationCaps).reduce((total, value) => total + value, 0), 0);
  assert.equal(rows.length, entries.length);
  const report = { made: new Date().toISOString(), started, targetMet: false, sourceRoot: root, inputSha256: manifest.inputSha256,
    evidence: isPilot ? 'own-attention-policy-lifecycle-pilot-only' : 'own-future-attention-policy-count-calibration-training-only',
    sourceHashes: { ...manifest.sourceHashes, [inputName]: manifest.inputSha256, 'attention-count-run-manifest.json': hash(fs.readFileSync(manifestFile)),
      ...(priorPilotSha256 ? { 'analysis/archive/personal-bots/personal-attention-count-pilot.json': priorPilotSha256 } : {}) },
    runs: isPilot ? 2 : 8, attempts: isPilot ? 3 : 8, profiles, actors: input.bindings, attentionModelSha256: input.attentionModelSha256,
    computationCaps, exactZeroPilotControls: rows.length, pairedPilotControls: isPilot ? 0 : priorPilot.rows.length * 4,
    exactCompletedBaselineControls: isPilot ? 0 : rows.length, optionalOriginalBaselineCrossControls: oldFull ? rows.length : 0,
    oldFullFile, oldFullSha256, rows,
    note: 'New source-bound current-own attention controllers are calibrated to prior counts only. Old no-attention samples are exact '
      + 'zero controls, not this candidate’s training chains. Every full row pairs freshly computed zero/untempered8x8 chains, '
      + 'independent of whether the separate old-controller run has completed. Optional old full crosschecks never use partial progress. '
      + 'Pilot counts cannot fit winning tries; all caps stay explicit censoring. '
      + 'No historical/future80% claim or numeric forecast is established by this simulation.' };
  fs.writeFileSync(output, JSON.stringify(report), { flag: 'wx' });
  console.log(JSON.stringify({ mode, rows: rows.length, computationCaps, output }));
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread && workerData?.attentionCounts) parentPort.postMessage({ rows: measure(workerData.entries, workerData.input,
  workerData.isPilot, workerData.priorPilot, workerData.oldFull) });
else if (require.main === module) main(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { controllerIdentity, chain };
