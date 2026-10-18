'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput, PARAMETERS } = require('./personal_known_plan_data.js');
const { featuresOf } = require('./known_tray_plan_fast.js');
const { referenceData } = require('./known_plan_reference.js');
const root = path.resolve(__dirname, '../../..');
const dataFile = 'analysis/archive/personal-bots/policy-known-plan-prefix-data.json';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function measure(entries) {
  const data = JSON.parse(fs.readFileSync(path.join(root, dataFile))), recorded = recordings();
  return entries.map(({ name, aid }, index) => {
    const original = data.players[name].find(game => game.aid === aid), game = recorded[name].find(game => game.aid === aid);
    assert(original && game);
    const control = reconstruct(game, false, null, true);
    assert(control);
    assert.deepEqual(control.prefix, { ...original, decisions: original.decisions.map(({ knownPlan, ...decision }) => decision) });
    let calls = 0, nodes = 0, boundaries = 0;
    const optimized = reconstruct(retainedInput(game, control), false, null, true, (publicGame, state, actions) => {
      const result = featuresOf(publicGame, state, actions, PARAMETERS);
      calls++; nodes += result.nodes; boundaries += result.boundaries;
      return result;
    });
    assert(optimized);
    assert.deepEqual(optimized.prefix, original);
    assert.deepEqual(optimized.result, control.result);
    assert.deepEqual(optimized.state.physicalLog, control.state.physicalLog);
    assert.equal(calls, original.decisions.length);
    if ((index + 1) % 10 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: index + 1, total: entries.length } });
    return { name, aid, calls, nodes, boundaries };
  });
}

async function main() {
  const { data, referenceFiles, referenceFeatureFingerprint } = referenceData();
  assert.equal(data.prefixes, 398); assert.equal(data.totals.calls, 33543); assert.equal(data.pilot, false);
  const fingerprintFiles = [...new Set([...data.fingerprintFiles, ...referenceFiles, dataFile,
    'tools/sim/refit/known_plan_reference.js', 'tools/sim/refit/personal_known_plan_fast_audit.js', 'tools/sim/refit/known_tray_plan_fast.js'])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const proofFingerprint = fingerprintOf(), began = Date.now();
  const entries = Object.entries(data.players).flatMap(([name, games]) => games.map(game => ({ name, aid: game.aid })));
  const workers = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 2 }, (_, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { index, entries: entries.filter((entry, position) => position % 2 === index) } });
      workers.push(worker);
      worker.on('message', message => {
        if (message.rows) resolve(message.rows);
        else {
          fs.appendFileSync(path.join(root, 'analysis/personal-bots/personal-known-plan-fast-progress.jsonl'),
            JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
          console.log('Fast-feature worker', message.progress.worker, message.progress.completed + '/' + message.progress.total);
        }
      });
      worker.on('error', reject);
      worker.on('exit', code => { if (code) reject(new Error('Fast-feature worker failed: ' + code)); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  const rows = batches.flat(), totals = rows.reduce((total, row) => ({ calls: total.calls + row.calls,
    nodes: total.nodes + row.nodes, boundaries: total.boundaries + row.boundaries }), { calls: 0, nodes: 0, boundaries: 0 });
  assert.equal(rows.length, 398); assert.equal(totals.calls, 33543);
  assert.equal(totals.nodes, data.totals.nodes); assert.equal(totals.boundaries, data.totals.boundaries);
  assert.equal(fingerprintOf(), proofFingerprint);
  const report = { made: new Date().toISOString(), evidence: 'optimized-known-plan-complete-feature-physics-parity', targetMet: false,
    dataSha256: hash(fs.readFileSync(path.join(root, dataFile))), referenceFeatureFingerprint, fingerprint: proofFingerprint, fingerprintFiles,
    prefixes: rows.length, totals, milliseconds: Date.now() - began, rows,
    note: 'All398 unchanged prefixes and33,543 old planning feature vectors, physical frames and outcomes match exactly. '
      + 'Node expansions and bounded unknown counts also remain identical; only redundant legality/state bookkeeping is cached. '
      + 'Randomized public-state tests separately include ice/locks, peeks, clock and Joker finale. '
      + 'Reference training features and fitted weights remain frozen. This is runtime equivalence, not winning-try accuracy.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-known-plan-fast-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ prefixes: report.prefixes, totals, milliseconds: report.milliseconds, fingerprint: proofFingerprint }));
}

if (!isMainThread && require.main === module) parentPort.postMessage({ rows: measure(workerData.entries) });
else if (require.main === module) {
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-known-plan-fast-progress.jsonl'), JSON.stringify({ made: new Date().toISOString() }) + '\n');
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
