'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { NAMES, boardId } = require('./personal_model.js');
const { PROFILES } = require('./personal_count_profiles.js');
const { PIDS } = require('./mimic_games.js');
const { currentTarget } = require('./personal_bot.js');
const { designed } = require('./boards.js');
const { features } = require('./attempt_count.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const { recordings, matchErrorAt } = require('./personal_match_error.js');
const Hard = require('../../../www/hard.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');

function targetsFor(events, horizon) {
  const target = currentTarget(events);
  if (!target || target.version !== '1.55') throw new Error('Profile cohort needs a known current 1.55 player');
  const first = target.lv + (target.active || target.at > 1 ? 1 : 0);
  if (first < 53 || first + horizon - 1 > 269) throw new Error('Upcoming targets must have fixed known 1.55 boards');
  const upcoming = Array.from({ length: horizon }, (_, index) => first + index);
  const replay = Object.values(events || {}).filter(event => ['start', 'end'].includes(event.k) && event.m !== 'd' && !event.tk
    && Number.isInteger(event.lv) && (event.lv === 51 || event.lv >= 53) && event.lv <= 269).map(event => event.lv);
  return { target, first, levels: [...new Set([...upcoming, ...replay])].sort((left, right) => left - right) };
}

function fingerprint(files) {
  const digest = crypto.createHash('sha256');
  for (const filename of files) digest.update(fs.readFileSync(path.join(root, filename)));
  return digest.digest('hex');
}

function measure(tasks, runs, attempts, cutoff) {
  const data = JSON.parse(fs.readFileSync(path.join(archive, 'count-profile-data.json'), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/personal-kind-policy.json'), 'utf8'));
  const recorded = recordings(), references = new Map(data.rows.map(row => [row.board, row.reference]));
  return tasks.map((task, position) => {
    const game = designed('1.55', task.lv);
    if (!game) throw new Error('Missing fixed forecast board ' + task.lv);
    const identity = boardId(game), fitted = policy.players[task.name];
    if (fitted.trainingCut > cutoff) throw new Error('Context actor is not available at input cutoff');
    const base = { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 12, plan: 10,
      kinds: { ...DEFAULT_KINDS, ...kindsAt(task.name, cutoff) }, kindModel: fitted.model };
    const matchError = matchErrorAt(recorded, task.name, cutoff), chains = {};
    for (const [name, { care, observedErrors, ...parameters }] of Object.entries(PROFILES)) {
      const persona = { ...base, ...parameters, w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: care })],
        ...(observedErrors ? { matchError: matchError.probability } : {}) };
      chains[name] = Hard.rateChain(game, runs, 20261025, persona, persona.memory, attempts);
    }
    const reference = references.get(identity) || { strong: Hard.rate(game, 64, 20261019, Hard.persona('strong')).rate,
      average: Hard.rate(game, 64, 20261019, Hard.persona('average')).rate };
    if ((position + 1) % 10 === 0) parentPort.postMessage({ progress: 'Future profile worker ' + workerData.index + ': ' + (position + 1) + '/' + tasks.length });
    return { ...task, start: cutoff, version: '1.55', board: identity, firstAttempt: 1, chains, reference,
      physical: features(game), matchError, contextAvailable: true };
  });
}

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(archive, 'count-profile-data.json'), 'utf8'));
  const runs = +(process.argv[2] || data.runs), horizon = +(process.argv[3] || 24), cutoff = Date.now();
  if (runs !== data.runs || !Number.isInteger(horizon) || horizon < 20) throw new Error('Match measured runs and provide at least twenty upcoming levels');
  if (JSON.stringify(data.profiles) !== JSON.stringify(PROFILES)) throw new Error('Profile protocol differs from historical measurement');
  if (fingerprint(data.fingerprintFiles) !== data.fingerprint) throw new Error('Profile measurements are stale; rebuild before forecasting');
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'), 'utf8'));
  const targets = Object.fromEntries(NAMES.map(name => [name, targetsFor(plays[PIDS[name]], horizon)]));
  const tasks = NAMES.flatMap(name => targets[name].levels.map(lv => ({ name, lv,
    upcoming: lv >= targets[name].first && lv < targets[name].first + horizon,
    priorCounter: Math.max(0, ...Object.values(plays[PIDS[name]] || {}).filter(event => event.m !== 'd' && !event.tk && event.lv === lv && event.t < cutoff)
      .map(event => Number(event.at) || 0)) })));
  const fingerprintFiles = [...new Set([...data.fingerprintFiles, 'analysis/archive/personal-bots/count-profile-data.json',
    'tools/sim/refit/count_profile_prospective.js', 'tools/sim/refit/count_profile_prospective.py',
    'tools/sim/refit/personal_count_fit.py', 'tools/sim/refit/attempt_count_fit.py', 'tools/sim/refit/attempt_hazard.py',
    'tools/sim/refit/board_recall_eval.py', 'tools/sim/refit/prospective.py', 'tools/sim/refit/personal_bot.js',
    'tools/sim/refit/prospective_data.js', 'tools/sim/refit/prospective_openings.js'])];
  const sourcesAtStart = fingerprint(fingerprintFiles);
  const batches = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { futureProfiles: true, index, runs, attempts: data.attempts, cutoff,
      tasks: tasks.filter((task, position) => position % 3 === index) } });
    worker.on('message', message => message.rows ? resolve(message.rows) : console.log(message.progress));
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Future profile worker failed')); });
  })));
  if (fingerprint(fingerprintFiles) !== sourcesAtStart) throw new Error('Forecast inputs changed during simulation');
  const rows = batches.flat().sort((left, right) => NAMES.indexOf(left.name) - NAMES.indexOf(right.name) || left.lv - right.lv);
  const featureSchema = { version: 'count-profile-v1', profiles: Object.keys(PROFILES), columns: 30 + (Object.keys(PROFILES).length - 1) * 3 };
  fs.writeFileSync(path.join(archive, 'count-profile-prospective-input.json'), JSON.stringify({ inputsFrozenAt: cutoff,
    fingerprint: sourcesAtStart, fingerprintFiles, measurementFingerprint: data.fingerprint, runs, attempts: data.attempts,
    featureSchema, targets, rows }));
  console.log('Saved', rows.length, 'future profile inputs; forecasts are not frozen until the Python freezer completes.');
}

if (!isMainThread && workerData?.futureProfiles) parentPort.postMessage({ rows: measure(workerData.tasks, workerData.runs, workerData.attempts, workerData.cutoff) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { targetsFor };
