'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { pinnedRead, actionPinned } = require('./personal_context_runtime_audit.js');
const { FEATURES, PARAMETERS, featuresOf } = require('./known_clock_plan.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');
const DATA_FILE = 'analysis/archive/personal-bots/policy-value-prefix-data.json';

function measure(entries) {
  const data = pinnedRead(actionPinned, DATA_FILE), recorded = recordings();
  return entries.map(({ name, aid }, index) => {
    const original = data.players[name].find(game => game.aid === aid), game = recorded[name].find(game => game.aid === aid);
    assert(original && game);
    const control = reconstruct(game, false, null, true);
    assert(control); assert.deepEqual(control.prefix, original);
    const totals = { nodes: 0, boundaries: 0, calls: 0, clockCalls: 0 };
    const planned = reconstruct(retainedInput(game, control), false, null, true, (publicGame, state, actions) => {
      const result = featuresOf(publicGame, state, actions);
      totals.nodes += result.nodes; totals.boundaries += result.boundaries; totals.calls++;
      totals.clockCalls += +!result.inactive;
      return result;
    });
    assert(planned);
    assert.deepEqual({ ...planned.prefix, decisions: planned.prefix.decisions.map(({ knownPlan, ...decision }) => decision) }, original);
    assert.deepEqual(planned.state.physicalLog, control.state.physicalLog);
    assert.deepEqual(planned.result, control.result);
    assert.equal(totals.calls, original.decisions.length);
    for (const decision of planned.prefix.decisions) assert(decision.knownPlan.length === decision.F.length
      && decision.knownPlan.every(parts => parts.length === FEATURES.length && parts.every(value => Number.isFinite(value) && value >= 0 && value <= 1)));
    if ((index + 1) % 5 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: index + 1, total: entries.length } });
    return { name, prefix: planned.prefix, totals };
  });
}

async function main() {
  const pilot = process.argv[2] === 'pilot';
  assert(!process.argv[2] || pilot, 'Use pilot or full clock-route feature generation');
  const data = pinnedRead(actionPinned, DATA_FILE);
  const all = Object.entries(data.players).flatMap(([name, games]) => games.map(game => ({ name, aid: game.aid })));
  assert.equal(all.length, 398);
  const entries = pilot ? Object.keys(data.players).flatMap(name => {
    const own = all.filter(game => game.name === name);
    return [own[0], own.at(-1)];
  }) : all;
  const fingerprintFiles = ['www/hard.js', 'www/layouts.js', ...fs.readdirSync(__dirname).filter(file => file.endsWith('.js')).sort()
    .map(file => 'tools/sim/refit/' + file), 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...['manifest.json', DATA_FILE].map(file => path.relative(root, path.join(actionPinned, file)).replace(/\\/g, '/'))];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), began = Date.now();
  const progressFile = path.join(root, 'analysis/personal-bots/personal-clock-route-' + (pilot ? 'pilot' : 'full') + '-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), pilot, fingerprint, prefixes: entries.length }) + '\n');
  const workers = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 2 }, (_, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { index, entries: entries.filter((entry, position) => position % 2 === index) } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject);
      worker.on('exit', code => { if (code) reject(new Error('Clock-route worker failed: ' + code)); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  assert.equal(fingerprintOf(), fingerprint);
  const rows = batches.flat(), totals = { nodes: 0, boundaries: 0, calls: 0, clockCalls: 0 };
  for (const row of rows) for (const field of Object.keys(totals)) totals[field] += row.totals[field];
  if (!pilot) assert.equal(totals.calls, 33543);
  const report = { made: new Date().toISOString(), evidence: 'public-clock-route-feature-parity', targetMet: false,
    pilot, parameters: PARAMETERS, features: FEATURES, fingerprint, fingerprintFiles, prefixes: rows.length,
    milliseconds: Date.now() - began, totals,
    players: Object.fromEntries(Object.keys(data.players).map(name => [name, rows.filter(row => row.name === name)
      .map(row => row.prefix).sort((left, right) => left.t - right.t)])),
    note: 'All original natural-prefix choices/features/frames/results retained exactly. Public frozen pictures only. '
      + 'Each root is one physical tap. Known clock support means a found route, not the best route. '
      + 'Unknown pictures/Joker twins and bounded search are unresolved, not proven traps or human failures. '
      + 'Features are zero after clock exit. They will receive independently fitted own-person weights, not universal greedy priorities. '
      + 'No action fit, winning-count forecast, model promotion or prospective80% result is produced here.' };
  const output = path.join(root, pilot ? 'analysis/personal-bots/personal-clock-route-throughput-audit.json'
    : 'analysis/archive/personal-bots/policy-clock-route-prefix-data.json');
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ output, pilot, prefixes: report.prefixes, milliseconds: report.milliseconds, totals }, null, 2));
}

if (!isMainThread && require.main === module) parentPort.postMessage({ rows: measure(workerData.entries) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
