'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { progressionTargets, missingProgressionTasks } = require('./progression_targets.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const snapshotRelative = 'analysis/archive/personal-bots/experiments/profile-cohort-2026-10-17T04-26-13-752Z';
const snapshot = path.join(root, snapshotRelative), refit = path.join(snapshot, 'tools/sim/refit');
const Hard = require(path.join(snapshot, 'www/hard.js'));
const { NAMES, boardId } = require(path.join(refit, 'personal_model.js'));
const { PROFILES } = require(path.join(refit, 'personal_count_profiles.js'));
const { PIDS } = require(path.join(refit, 'mimic_games.js'));
const { kindsAt } = require(path.join(refit, 'kinds.js'));
const { DEFAULT_KINDS } = require(path.join(refit, 'personal_policy_prior.js'));
const { recordings, matchErrorAt } = require(path.join(refit, 'personal_match_error.js'));
const { designed } = require(path.join(refit, 'boards.js'));
const { features } = require(path.join(refit, 'attempt_count.js'));
const historicalRelative = snapshotRelative + '/analysis/archive/personal-bots/count-profile-data.json';
const data = JSON.parse(fs.readFileSync(path.join(root, historicalRelative), 'utf8'));

function fingerprint(files) {
  const digest = crypto.createHash('sha256');
  for (const file of files) digest.update(fs.readFileSync(path.join(root, file)));
  return digest.digest('hex');
}

function measure(tasks, cutoff) {
  const policy = JSON.parse(fs.readFileSync(path.join(snapshot, 'analysis/personal-bots/personal-kind-policy.json'), 'utf8'));
  const recorded = recordings(), references = new Map(data.rows.map(row => [row.board, row.reference]));
  return tasks.map((task, position) => {
    const game = designed('1.55', task.lv);
    if (!game) throw new Error('Unknown progression board ' + task.lv);
    const fitted = policy.players[task.name], identity = boardId(game);
    if (fitted.trainingCut > cutoff) throw new Error('Progression actor is not yet available');
    const base = { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 12, plan: 10,
      kinds: { ...DEFAULT_KINDS, ...kindsAt(task.name, cutoff) }, kindModel: fitted.model };
    const matchError = matchErrorAt(recorded, task.name, cutoff), chains = {};
    for (const [name, { care, observedErrors, ...parameters }] of Object.entries(PROFILES)) {
      const persona = { ...base, ...parameters, w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: care })],
        ...(observedErrors ? { matchError: matchError.probability } : {}) };
      chains[name] = Hard.rateChain(game, data.runs, 20261025, persona, persona.memory, data.attempts);
    }
    const reference = references.get(identity) || { strong: Hard.rate(game, 64, 20261019, Hard.persona('strong')).rate,
      average: Hard.rate(game, 64, 20261019, Hard.persona('average')).rate };
    if ((position + 1) % 4 === 0) parentPort.postMessage({ progress: 'Progression worker ' + workerData.index + ': ' + (position + 1) + '/' + tasks.length });
    return { ...task, version: '1.55', start: cutoff, board: identity, firstAttempt: 1, upcoming: true,
      chains, reference, physical: features(game), matchError, contextAvailable: true };
  });
}

async function main() {
  if (fingerprint(data.fingerprintFiles.map(file => snapshotRelative + '/' + file)) !== data.fingerprint) throw new Error('Archived measurement source mismatch');
  const playsFile = 'analysis/archive/realdata/plays.json', scoresFile = 'analysis/archive/realdata/scores.json';
  const plays = JSON.parse(fs.readFileSync(path.join(root, playsFile), 'utf8')), scores = JSON.parse(fs.readFileSync(path.join(root, scoresFile), 'utf8'));
  const cutoff = Date.now(), targets = Object.fromEntries(NAMES.map(name => [name, progressionTargets(plays[PIDS[name]], scores[PIDS[name]], 24)]));
  const ledgerFile = path.join(root, 'analysis/personal-bots/progression-prospective-forecasts.json');
  const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : [];
  const tasks = missingProgressionTasks(targets, ledger);
  if (!tasks.length) { console.log('All current progression targets already have frozen predictions; nothing is replaced.'); return; }
  const fingerprintFiles = [...new Set([...data.fingerprintFiles.map(file => snapshotRelative + '/' + file), historicalRelative,
    playsFile, scoresFile, ...['progression_forecasts.js', 'progression_targets.js', 'progression_forecasts.py', 'progression_score.py',
      'board_versions.js', 'count_profile_prospective.py', 'personal_count_fit.py', 'attempt_count_fit.py', 'attempt_hazard.py', 'board_recall_eval.py', 'prospective.py']
      .map(file => 'tools/sim/refit/' + file)])];
  const identity = fingerprint(fingerprintFiles);
  console.log('New progression targets:', Object.fromEntries(NAMES.map(name => [name, targets[name].first])));
  const batches = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { progression: true, index, cutoff, tasks: tasks.filter((task, position) => position % 3 === index) } });
    worker.on('message', message => message.rows ? resolve(message.rows) : console.log(message.progress));
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Progression worker failed')); });
  })));
  if (fingerprint(fingerprintFiles) !== identity) throw new Error('Progression inputs changed during measurement');
  const rows = batches.flat().sort((left, right) => NAMES.indexOf(left.name) - NAMES.indexOf(right.name) || left.lv - right.lv);
  const inputs = { scope: 'first-clear-progression-v1', inputsFrozenAt: cutoff, fingerprint: identity, fingerprintFiles,
    historicalDataFile: historicalRelative, measurementFingerprint: data.fingerprint, runs: data.runs, attempts: data.attempts,
    targets, progressionStartLevels: Object.fromEntries(NAMES.map(name => [name, targets[name].first])),
    featureSchema: { version: 'count-profile-v1', profiles: Object.keys(PROFILES), columns: 30 + (Object.keys(PROFILES).length - 1) * 3 },
    rows };
  fs.writeFileSync(path.join(archive, 'progression-profile-input.json'), JSON.stringify(inputs));
  console.log('Saved', rows.length, 'new progression inputs; existing numeric forecasts are never replaced.');
}

if (!isMainThread && workerData?.progression) parentPort.postMessage({ rows: measure(workerData.tasks, workerData.cutoff) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
