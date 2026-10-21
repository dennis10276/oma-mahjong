'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { play } = require('./public_witness_screen.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function measure(entries, profiles, prior, expected, progress) {
  return entries.map(({ entry, position }) => {
    const measured = {};
    for (const [name, options] of Object.entries(profiles)) {
      const started = performance.now(), result = play(entry, prior, options);
      if (name === 'baseline') assert.deepEqual(result, expected[position].measured, 'Unchanged baseline must reproduce all result/planner/physics counters');
      measured[name] = result; progress({ position, name: entry.name, lv: entry.lv, cohort: entry.cohort, profile: name,
        elapsedMs: performance.now() - started, ...result });
    }
    const { game, ...metadata } = entry; return { ...metadata, position, profiles: measured };
  });
}

async function main(filename, variant = 'pruning') {
  assert(['pruning', 'information'].includes(variant));
  const baselineFile = path.resolve(filename), bytes = fs.readFileSync(baselineFile), baseline = JSON.parse(bytes); assert.equal(baseline.entries.length, 29);
  const profiles = variant === 'pruning' ? { baseline: baseline.options,
    continuation128: { ...baseline.options, continuationPruning: true },
    continuation256: { ...baseline.options, continuationPruning: true, proofNodes: 256 },
    continuationFromTwo: { ...baseline.options, continuationPruning: true, continuationTrayMin: 2 } }
    : { baseline: baseline.options, continuation128: { ...baseline.options, continuationPruning: true },
      safeInformation: { ...baseline.options, safeInformationEscape: true },
      combined: { ...baseline.options, continuationPruning: true, safeInformationEscape: true },
      combinedFromTwo: { ...baseline.options, continuationPruning: true, continuationTrayMin: 2, safeInformationEscape: true } };
  const expected = baseline.entries.map(entry => baseline.rows.find(row => row.name === entry.name && row.start === entry.start && row.board === entry.board && row.cohort === entry.cohort));
  assert(expected.every(Boolean));
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/reference-continuation-screen-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder); const sourceHashes = {};
  for (const source of Object.keys(require.cache).filter(source => source.startsWith(root + path.sep))) {
    const relative = path.relative(root, source).replace(/\\/g, '/'), content = fs.readFileSync(source), target = path.join(folder, 'sources', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content, { flag: 'wx' }); sourceHashes[relative] = hash(content);
  }
  const input = { made, targetMet: false, baselineFile, baselineSha256: hash(bytes), entries: baseline.entries, profiles,
    settings: baseline.settings, observation: baseline.observation, sourceHashes, workers: 2, variant,
    note: 'Complete29-case matched first-trial experiment, four predeclared profiles, constant production seed and512 physical-choice limit. The stronger optional proof exhausts known safe removals as well as inspections; unknown/bounded/unsupported probes never prune. Original beam budget retained; bounded subproof work is separately reported by continuationProof counters, not hidden in beam-node counts. Retain all regressions and computation censoring. This is symbolic-observer reference development, not a personal attempt forecast or screenshot proof.' };
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(input), { flag: 'wx' });
  const workers = [], progress = [];
  let batches;
  try {
    batches = await Promise.all(Array.from({ length: 2 }, (unused, worker) => new Promise((resolve, reject) => {
      const instance = new Worker(__filename, { workerData: { continuationScreen: true, profiles, prior: input.observation.prior, expected,
        entries: baseline.entries.map((entry, position) => ({ entry, position })).filter(item => item.position % 2 === worker) } });
      workers.push(instance); let delivered = false;
      instance.on('message', message => {
        if (message.rows) { delivered = true; resolve(message.rows); }
        else { progress.push(message.progress); fs.appendFileSync(path.join(folder, 'progress.jsonl'), JSON.stringify(message.progress) + '\n'); }
      });
      instance.on('error', reject); instance.on('exit', code => { if (code || !delivered) reject(Error('Continuation worker incomplete: ' + code)); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  const rows = batches.flat().sort((left, right) => left.position - right.position); assert.equal(rows.length, 29);
  const scores = {};
  for (const cohort of ['pinnedLaterResearch', 'priorCalibrationControl']) for (const profile of Object.keys(profiles)) {
    const own = rows.filter(row => row.cohort === cohort).map(row => row.profiles[profile]);
    scores[cohort + '|' + profile] = { n: own.length, wins: own.filter(row => row.result.win && !row.computationCensored).length,
      computationCensored: own.filter(row => row.computationCensored).length, unsupportedChoices: own.reduce((sum, row) => sum + row.unsupportedChoices, 0),
      knownPhysicalControls: own.reduce((sum, row) => sum + row.knownPhysicalControls, 0),
      subproofNodes: own.reduce((sum, row) => sum + (row.planner.continuationProofNodes || 0), 0),
      elapsedMs: progress.filter(row => row.cohort === cohort && row.profile === profile).reduce((sum, row) => sum + row.elapsedMs, 0) };
  }
  for (const [relative, expectedHash] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expectedHash);
  assert.equal(hash(fs.readFileSync(baselineFile)), hash(bytes));
  fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ ...input, rows, scores }), { flag: 'wx' });
  console.log(JSON.stringify({ folder, scores }));
}

if (!isMainThread && workerData?.continuationScreen) parentPort.postMessage({ rows: measure(workerData.entries, workerData.profiles,
  workerData.prior, workerData.expected, progress => parentPort.postMessage({ progress })) });
else if (isMainThread && require.main === module) main(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
