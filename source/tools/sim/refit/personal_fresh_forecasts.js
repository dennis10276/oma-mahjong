'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { PIDS } = require('./mimic_games.js');
const { progressionTargets } = require('./progression_targets.js');
const { designed } = require('./boards.js');
const { boardId } = require('./personal_model.js');
const root = path.resolve(__dirname, '../../..');
const protocol = 'fresh-own-first-clear-prequential-v1';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function chooseUnopened(candidates, events, frontier, covered = new Set()) {
  const starts = new Set(events.filter(event => event.k === 'start' && event.m !== 'd' && !event.tk).map(event => event.lv));
  return candidates.filter(row => row.lv >= frontier && !starts.has(row.lv) && !covered.has(row.name + '|' + row.lv));
}

function main(runArgument, liveArgument) {
  assert(runArgument && liveArgument, 'Supply the completed count run and a new live opening snapshot');
  const run = path.resolve(runArgument), live = path.resolve(liveArgument);
  assert(run.startsWith(path.join(root, 'analysis/archive/personal-bots/runs') + path.sep));
  assert(live.startsWith(path.join(root, 'analysis/archive/personal-bots/live-openings-')));
  const runManifest = JSON.parse(fs.readFileSync(path.join(run, 'run-manifest.json')));
  for (const [name, expected] of Object.entries(runManifest.sourceInputs)) assert.equal(hash(fs.readFileSync(path.join(run, name))), expected);
  const dataBytes = fs.readFileSync(path.join(run, 'analysis/archive/personal-bots/physical-fresh-count-data.json'));
  const data = JSON.parse(dataBytes), evaluationBytes = fs.readFileSync(path.join(run, 'analysis/personal-bots/personal-fresh-count-evaluation.json'));
  const evaluation = JSON.parse(evaluationBytes);
  assert.equal(data.computationCaps, 0); assert(data.validUncensoredSimulation);
  assert.equal(data.runs, 32); assert.equal(data.attempts, 32); assert.equal(data.pairedPilotChainsMatched, 248);
  assert.equal(evaluation.protocol, protocol); assert.equal(evaluation.dataSha256, hash(dataBytes));
  assert.equal(evaluation.measurementFingerprint, data.fingerprint);
  const fingerprint = crypto.createHash('sha256');
  for (const name of data.fingerprintFiles) fingerprint.update(name).update(fs.readFileSync(path.join(run, name)));
  assert.equal(fingerprint.digest('hex'), data.fingerprint);
  for (const [name, expected] of Object.entries(evaluation.scoringSourceHashes)) assert.equal(hash(fs.readFileSync(path.join(__dirname, name))), expected);
  const liveManifest = JSON.parse(fs.readFileSync(path.join(live, 'manifest.json')));
  assert.equal(liveManifest.evidence, 'read-only-live-opening-check');
  const readLive = name => {
    const bytes = fs.readFileSync(path.join(live, name)); assert.equal(hash(bytes), liveManifest.files[name]);
    return JSON.parse(bytes);
  };
  const plays = readLive('plays.json'), scores = readLive('scores.json');
  const ledger = path.join(root, 'analysis/personal-bots/personal-fresh-forecasts.jsonl');
  const oldBytes = fs.existsSync(ledger) ? fs.readFileSync(ledger) : Buffer.alloc(0);
  const previous = oldBytes.toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert(previous.every(snapshot => snapshot.model === protocol));
  const covered = new Set(previous.flatMap(snapshot => snapshot.forecasts.map(row => row.name + '|' + row.lv)));
  const forecasts = [], targets = {}, omitted = [];
  const frozenAt = Date.now();
  assert(Date.parse(data.futureModelReadyAt) < data.inputFrozenAt && data.inputFrozenAt < Date.parse(data.made));
  assert(Date.parse(data.made) <= Date.parse(evaluation.made) && Date.parse(evaluation.made) < frozenAt);
  assert(Date.parse(liveManifest.made) > Date.parse(evaluation.made) && frozenAt - Date.parse(liveManifest.made) < 120000);
  for (const [name, pid] of Object.entries(PIDS)) {
    const events = Object.values(plays[pid] || {}), target = progressionTargets(events, scores[pid], 24);
    const candidates = evaluation.future.filter(row => row.name === name);
    const unopened = chooseUnopened(candidates, events, target.first, covered);
    for (const row of candidates) if (!unopened.includes(row)) omitted.push({ name, lv: row.lv, reason: 'opened-below-frontier-or-already-frozen' });
    for (const row of unopened) {
      const measured = data.future.find(entry => entry.name === name && entry.lv === row.lv);
      assert(measured && row.board === measured.board && row.modelId === measured.modelId);
      assert(row.version === target.version && boardId(designed(target.version, row.lv)) === row.board);
      assert(row.trainingAvailableThrough === null || row.trainingAvailableThrough < data.inputFrozenAt);
      assert(row.selectionAvailableThrough === null || row.selectionAvailableThrough < data.inputFrozenAt);
      const predictedAttempt = row.predictions.selectedPrequential;
      assert(Number.isInteger(predictedAttempt) && predictedAttempt >= 1 && predictedAttempt <= 8);
      forecasts.push({ ...row, predictedAttempt, upcoming: true, numericForecastFrozen: true });
    }
    targets[name] = { ...target, newlyFrozen: unopened.length };
    const retainedCoverage = previous.flatMap(snapshot => snapshot.forecasts).filter(row => row.name === name && row.lv >= target.first
      && !events.some(event => event.k === 'start' && event.m !== 'd' && !event.tk && event.lv === row.lv));
    assert(new Set([...retainedCoverage, ...unopened].map(row => row.lv)).size >= 20, 'Need20 distinct unopened forecasts per person');
  }
  assert(forecasts.length, 'No new numeric forecasts to append');
  const snapshot = { frozenAt, model: protocol, scope: 'first-clear-progression-v1', targetMet: false,
    progressionStartLevels: previous[0]?.progressionStartLevels || Object.fromEntries(Object.entries(targets).map(([name, target]) => [name, target.first])),
    targets, forecasts, omitted, inputFrozenAt: data.inputFrozenAt, futureModelReadyAt: data.futureModelReadyAt,
    dataSha256: hash(dataBytes), evaluationSha256: hash(evaluationBytes), liveManifestSha256: hash(fs.readFileSync(path.join(live, 'manifest.json'))),
    freezeSourceSha256: hash(fs.readFileSync(__filename)), scoringSourceHashes: evaluation.scoringSourceHashes,
    run: path.relative(root, run).replace(/\\/g, '/'), liveSnapshot: path.relative(root, live).replace(/\\/g, '/'),
    note: 'Experimental different own-only actor/head protocol, not a promotion or replacement of the failed earlier primary. '
      + 'All older numeric ledgers and misses remain immutable. Same-protocol updates never reset its first-freeze cohort. '
      + 'Primary scoring is the first20 newly opened progression campaigns per person after the earliest freeze; missing forecasts and unfinished levels remain. '
      + 'An8 prediction is the shared8+ scoring bucket. Actual opening timestamps must later confirm pre-start eligibility. No80% claim is established.' };
  assert((fs.existsSync(ledger) ? fs.readFileSync(ledger) : Buffer.alloc(0)).equals(oldBytes));
  fs.appendFileSync(ledger, JSON.stringify(snapshot) + '\n', { flag: previous.length ? 'a' : 'ax' });
  const written = fs.readFileSync(ledger); assert(written.subarray(0, oldBytes.length).equals(oldBytes));
  console.log(JSON.stringify({ frozenAt, forecasts: forecasts.length, next: Object.fromEntries(Object.entries(PIDS).map(([name]) => [name,
    forecasts.filter(row => row.name === name).sort((left, right) => left.lv - right.lv).slice(0, 3).map(row => ({ lv: row.lv, predictedAttempt: row.predictedAttempt, selectedMethod: row.selectedMethod }))])) }, null, 2));
}

if (require.main === module) main(process.argv[2], process.argv[3]);
module.exports = { chooseUnopened };
