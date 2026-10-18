'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { pinnedRead, actionPinned } = require('./personal_context_runtime_audit.js');
const { FEATURES, featuresOf, advance, legal } = require('./known_tray_plan.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');
const PARAMETERS = Object.freeze({ taps: 6, nodes: 256, progress: 4 });
const DATA_FILE = 'analysis/archive/personal-bots/policy-value-prefix-data.json';

function auditFrames(game, frames, actions) {
  let position = { alive: game.faces.map(() => 1), pictures: Array.from(game.faces), down: Array.from(game.down),
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const arrivals = new Map();
  let checked = 0, uncertainJoker = 0;
  for (const [index, frame] of frames.entries()) {
    const action = actions[index], time = action?.time ?? (index + 1) * 1000;
    if (action?.settled) arrivals.clear();
    position.arriving = [...arrivals].filter(([, until]) => until > time).map(([face]) => face);
    const allowed = legal(game, position), moved = advance(game, position, frame.index);
    if (moved.uncertain) {
      assert.equal(moved.reason, 'automaticJokerTwin');
      uncertainJoker++;
    } else {
      assert.deepEqual(moved.state.alive, frame.alive);
      assert.deepEqual(moved.state.tray, frame.tray);
      assert.equal(moved.state.moves, frame.moves);
      assert.equal(moved.state.openPeek, frame.openPeek);
      checked++;
    }
    for (const face of arrivals.keys()) if (!frame.tray.includes(face)) arrivals.delete(face);
    for (const face of frame.tray) if (!position.tray.includes(face)) arrivals.set(face, time + 230);
    position = { ...position, alive: frame.alive.slice(), tray: frame.tray.slice(), moves: frame.moves,
      openPeek: frame.openPeek, relieved: allowed.relieved };
  }
  return { checked, uncertainJoker };
}

function retainedInput(game, control) {
  const { decisions, reconstructed, ...metadata } = control.prefix;
  const count = control.state.physicalLog.length;
  return { ...metadata, g: game.g, take: control.state.follow, actions: game.actions.slice(0, count),
    actionTimes: game.actionTimes.slice(0, count) };
}

function measure(entries) {
  const data = pinnedRead(actionPinned, DATA_FILE), recorded = recordings();
  return entries.map(({ name, aid }, index) => {
    const original = data.players[name].find(game => game.aid === aid), game = recorded[name].find(game => game.aid === aid);
    assert(original && game);
    const control = reconstruct(game, false, null, true);
    assert(control);
    assert.deepEqual(control.prefix, original);
    let nodes = 0, boundaries = 0, calls = 0;
    const planned = reconstruct(retainedInput(game, control), false, null, true, (publicGame, state, actions) => {
      const result = featuresOf(publicGame, state, actions, PARAMETERS);
      nodes += result.nodes; boundaries += result.boundaries; calls++;
      return result;
    });
    assert(planned);
    const baseline = { ...planned.prefix, decisions: planned.prefix.decisions.map(({ knownPlan, ...decision }) => decision) };
    assert.deepEqual(baseline, original);
    assert.deepEqual(planned.state.physicalLog, control.state.physicalLog);
    assert.deepEqual(planned.result, control.result);
    assert.equal(calls, original.decisions.length);
    for (const decision of planned.prefix.decisions) {
      assert.equal(decision.knownPlan.length, decision.F.length);
      assert(decision.knownPlan.every(row => row.length === FEATURES.length && row.every(value => Number.isFinite(value) && value >= 0 && value <= 1)));
    }
    const mechanics = auditFrames(game.g, control.state.physicalLog, game.actions);
    if ((index + 1) % 5 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: index + 1, total: entries.length } });
    return { name, prefix: planned.prefix, audit: { nodes, boundaries, calls, ...mechanics } };
  });
}

async function main() {
  const pilot = process.argv[2] === 'pilot';
  if (process.argv[2] && !pilot) throw new Error('Use explicit pilot mode or full known-only planning instrumentation');
  const data = pinnedRead(actionPinned, DATA_FILE);
  const all = Object.entries(data.players).flatMap(([name, games]) => games.map(game => ({ name, aid: game.aid })));
  assert.equal(all.length, 398);
  const entries = pilot ? Object.keys(data.players).flatMap(name => {
    const games = all.filter(game => game.name === name);
    return [games[0], games.at(-1)];
  }) : all;
  const fingerprintFiles = [...new Set([
    'www/hard.js', 'www/layouts.js', 'tools/sim/refit/known_tray_plan.js', 'tools/sim/refit/personal_known_plan_data.js',
    'tools/sim/refit/personal_prefix_data.js', 'tools/sim/refit/personal_context_runtime_audit.js',
    'tools/sim/refit/mimic_games.js', 'tools/sim/refit/personal_followthrough.js', 'tools/sim/refit/personal_pair_followthrough.js',
    'tools/sim/refit/personal_retry_memory.js', 'tools/sim/refit/personal_tray_goal.js', 'tools/sim/refit/attempt_campaigns.js',
    'tools/sim/refit/personal_model.js', 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...['manifest.json', DATA_FILE].map(file => path.relative(root, path.join(actionPinned, file)).replace(/\\/g, '/'))])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), progressFile = path.join(root, 'analysis/personal-bots/personal-known-plan-' + (pilot ? 'pilot' : 'full') + '-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), fingerprint, pilot, prefixes: entries.length }) + '\n');
  const began = Date.now();
  const workers = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 2 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { index, entries: entries.filter((entry, position) => position % 2 === index) } });
    workers.push(worker);
    worker.on('message', message => {
      if (message.rows) resolve(message.rows);
      else {
        fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
        console.log('Known-plan worker', message.progress.worker, message.progress.completed + '/' + message.progress.total);
      }
    });
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Known-plan worker failed: ' + code)); });
    })));
  } catch (error) {
    await Promise.all(workers.map(worker => worker.terminate()));
    throw error;
  }
  assert.equal(fingerprintOf(), fingerprint);
  const rows = batches.flat(), players = Object.fromEntries(Object.keys(data.players).map(name => [name,
    rows.filter(row => row.name === name).map(row => row.prefix).sort((left, right) => left.t - right.t)]));
  const totals = rows.reduce((result, row) => {
    for (const key of Object.keys(result)) result[key] += row.audit[key];
    return result;
  }, { nodes: 0, boundaries: 0, calls: 0, checked: 0, uncertainJoker: 0 });
  if (!pilot) assert.equal(totals.calls, 33543);
  const report = { made: new Date().toISOString(), evidence: 'known-only-planning-feature-parity', targetMet: false,
    pilot, parameters: PARAMETERS, features: FEATURES, fingerprint, fingerprintFiles, prefixes: rows.length,
    milliseconds: Date.now() - began, totals, players,
    note: 'All original action features, physical frames and non-planning results match unchanged natural prefixes. '
      + 'Known-only planning freezes pictures; unknown picture/orientation locations are not supplied. '
      + 'Unknown inspections and automatic Joker twins stop as information opportunities, not invented known transitions. '
      + 'A separate full-truth transition check is a mechanics diagnostic only; its private faces never generate forecast features. '
      + 'Joker transitions are explicitly counted as unsupported by that lightweight transition check, never dropped from action data. '
      + 'Search stops after a known four-removal route or the six-tap/256-node budget; clear/information fields mean found, not proven absent. '
      + 'Known inspections are followed by a physical commit or known peek-pair in two-tap macros; no-information inspection loops cannot invent progress. '
      + 'Complete suffixes are cached in canonical root-index order; node budgets count newly expanded states, and candidate input order cannot alter features. '
      + 'Budget boundaries mean unresolved planning, never a natural game loss. Clock-active planning features are zero; existing clock policy is unchanged. '
      + 'No winning-count score, per-person fit, prospective forecast or 80% claim is produced by instrumentation.' };
  const output = path.join(root, pilot ? 'analysis/personal-bots/personal-known-plan-throughput-audit.json'
    : 'analysis/archive/personal-bots/policy-known-plan-prefix-data.json');
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ output, pilot, prefixes: report.prefixes, milliseconds: report.milliseconds, totals }, null, 2));
}

if (!isMainThread && require.main === module) parentPort.postMessage({ rows: measure(workerData.entries) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PARAMETERS, auditFrames, retainedInput };
