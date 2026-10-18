'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { pinnedRead, actionPinned } = require('./personal_context_runtime_audit.js');
const { FEATURES, PARAMETERS, featuresOf } = require('./known_clock_strategy.js');
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
    assert.equal(planned.prefix.decisions.filter(decision => decision.knownPlan.some(parts => parts.some(value => value !== 0))).length, totals.clockCalls);
    for (const decision of planned.prefix.decisions) assert(decision.knownPlan.length === decision.F.length
      && decision.knownPlan.every(parts => parts.length === FEATURES.length && parts.every(value => Number.isFinite(value) && value >= 0 && value <= 1)));
    if ((index + 1) % 5 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: index + 1, total: entries.length } });
    return { name, prefix: planned.prefix, totals };
  });
}

async function main() {
  const pilot = process.argv[2] === 'pilot';
  assert(!process.argv[2] || pilot, 'Use pilot or full clock-strategy instrumentation');
  const data = pinnedRead(actionPinned, DATA_FILE);
  const all = Object.entries(data.players).flatMap(([name, games]) => games.map(game => ({ name, aid: game.aid })));
  assert.equal(all.length, 398);
  const entries = pilot ? Object.keys(data.players).flatMap(name => {
    const own = all.filter(game => game.name === name);
    return [own[0], own.at(-1)];
  }) : all;
  const fingerprintFiles = [...new Set([...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep))
    .map(file => path.relative(root, file).replace(/\\/g, '/')).sort(), 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...['manifest.json', DATA_FILE].map(file => path.relative(root, path.join(actionPinned, file)).replace(/\\/g, '/'))])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), began = Date.now();
  const progressFile = path.join(root, 'analysis/personal-bots/personal-clock-strategy-' + (pilot ? 'pilot' : 'full') + '-progress.jsonl');
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
      worker.on('exit', code => { if (code) reject(new Error('Clock-strategy worker failed: ' + code)); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  assert.equal(fingerprintOf(), fingerprint);
  const rows = batches.flat(), totals = { nodes: 0, boundaries: 0, calls: 0, clockCalls: 0 };
  for (const row of rows) for (const field of Object.keys(totals)) totals[field] += row.totals[field];
  if (!pilot) assert.equal(totals.calls, 33543);
  const report = { made: new Date().toISOString(), evidence: 'public-clock-strategy-feature-parity', targetMet: false,
    pilot, parameters: PARAMETERS, features: FEATURES, fingerprint, fingerprintFiles, prefixes: rows.length,
    milliseconds: Date.now() - began, totals,
    players: Object.fromEntries(Object.keys(data.players).map(name => [name, rows.filter(row => row.name === name)
      .map(row => row.prefix).sort((left, right) => left.t - right.t)])),
    note: 'All original natural-prefix actions, features, frames and results retained. Public known pictures only. '
      + 'Found routes distinguish at-most-two occupied tray slots, three with a known free tray mate, and pairing before clock exit within the real budget. '
      + 'Digging/probing, urgency and crowding are observable features, not compulsory actions or shared personal weights. '
      + 'Unknown pictures/Joker twins/bounds are unresolved, never fabricated traps or human losses. '
      + 'The clock-active marker is checked against every instrumentation callback. '
      + 'No adaptive policy fit, winning-count forecast, model promotion or future80% result is claimed.' };
  const output = path.join(root, pilot ? 'analysis/personal-bots/personal-clock-strategy-throughput-audit.json'
    : 'analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json');
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ output, pilot, prefixes: report.prefixes, milliseconds: report.milliseconds, totals }));
}

if (!isMainThread && require.main === module) parentPort.postMessage({ rows: measure(workerData.entries) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
