'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { NAMES, CONFIG } = require('./personal_model.js');
const { outcomesOf, features } = require('./attempt_count.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const { recordings, matchErrorAt } = require('./personal_match_error.js');
const Hard = require('../../../www/hard.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const PROFILES = {
  baseline: { care: 2, memory: CONFIG.memory },
  cautious: { care: 0.7, memory: CONFIG.memory },
  noisy: { care: 5, memory: CONFIG.memory },
  recalled: { care: 2, memory: 1 },
  cautiousRecalled: { care: 0.7, memory: 1 },
  noisyRecalled: { care: 5, memory: 1 },
  learning: { care: 2, memory: CONFIG.memory, learnFromLoss: true, retryPlan: 14 },
  recalledLearning: { care: 2, memory: 1, learnFromLoss: true, retryPlan: 14 },
  observedErrorsLearning: { care: 2, memory: CONFIG.memory, learnFromLoss: true, retryPlan: 14, observedErrors: true },
};

function measure(tasks, runs, attempts) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/personal-kind-policy.json'), 'utf8'));
  const recorded = recordings();
  return tasks.map(({ game, ...row }, position) => {
    const fitted = policy.players[row.name], available = fitted.trainingCut <= row.start;
    const base = { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 12, plan: 10,
      kinds: { ...DEFAULT_KINDS, ...kindsAt(row.name, row.start) }, ...(available ? { kindModel: fitted.model } : {}) };
    const matchError = matchErrorAt(recorded, row.name, row.start), chains = {};
    for (const [name, { care, observedErrors, ...parameters }] of Object.entries(PROFILES)) {
      const persona = { ...base, ...parameters, w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: care })],
        ...(observedErrors ? { matchError: matchError.probability } : {}) };
      chains[name] = Hard.rateChain(game, runs, 20261025, persona, persona.memory, attempts);
    }
    const reference = { strong: Hard.rate(game, 64, 20261019, Hard.persona('strong')).rate,
      average: Hard.rate(game, 64, 20261019, Hard.persona('average')).rate };
    if ((position + 1) % 10 === 0) parentPort.postMessage({ progress: 'Count-profile worker ' + workerData.index + ': ' + (position + 1) + '/' + tasks.length });
    return { ...row, chains, reference, physical: features(game), matchError, contextAvailable: available };
  });
}

async function main() {
  const runs = +(process.argv[2] || 64), attempts = 32;
  if (!Number.isInteger(runs) || runs < 2) throw new Error('At least two simulation runs are required');
  const previous = JSON.parse(fs.readFileSync(path.join(archive, 'attempt-count-data.json'), 'utf8'));
  const evaluation = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/attempt-count-evaluation.json'), 'utf8'));
  const comparisonEpisodes = previous.rows.filter(row => row.firstAttempt === 1 && row.wonOn !== null && row.start >= evaluation.playerTestStartsAt[row.name])
    .map(row => row.name + '|' + row.start);
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'), 'utf8'));
  const tasks = NAMES.flatMap(name => outcomesOf(name).map(({ events, ...row }) => ({ ...row,
    openingRecorded: Object.values(plays[require('./mimic_games.js').PIDS[name]] || {}).some(event => event.k === 'start'
      && event.aid && event.aid === events[0]?.aid && event.t === row.start), aid: events[0]?.aid }))).sort((left, right) => left.start - right.start);
  const fingerprintFiles = ['www/hard.js', 'www/layouts.js', 'tools/sim/refit/personal_count_profiles.js',
    'tools/sim/refit/kinds.js', 'tools/sim/refit/personal_model.js', 'tools/sim/refit/personal_policy_prior.js',
    'tools/sim/refit/personal_match_error.js', 'tools/sim/refit/failure_audit.js', 'tools/sim/refit/attempt_count.js',
    'tools/sim/refit/attempt_count_labels.js', 'tools/sim/refit/attempt_features.js', 'tools/sim/refit/mimic_games.js',
    'tools/sim/refit/boards.js', 'tools/sim/refit/pdata.js', 'tools/sim/refit/attempts.json',
    'analysis/personal-bots/personal-kind-policy.json', 'analysis/archive/realdata/plays.json',
    'analysis/archive/personal-bots/attempt-count-data.json', 'analysis/personal-bots/attempt-count-evaluation.json',
    ...Object.values(require('./mimic_games.js').PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...fs.readdirSync(path.join(__dirname, 'tables')).filter(filename => /^(levels|hard|early)-/.test(filename)).sort().map(filename => 'tools/sim/refit/tables/' + filename),
    ...NAMES.map(name => 'tools/sim/refit/mimic/' + (name === 'Mrs. Doubtfire' ? 'Mrs_Doubtfire' : name) + '.json')];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const filename of fingerprintFiles) digest.update(fs.readFileSync(path.join(root, filename)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf();
  const batches = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { countProfiles: true, index, runs, attempts,
      tasks: tasks.filter((task, position) => position % 3 === index) } });
    worker.on('message', message => message.rows ? resolve(message.rows) : console.log(message.progress));
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Count-profile worker failed')); });
  })));
  if (fingerprintOf() !== fingerprint) throw new Error('Profile measurement inputs changed while workers ran');
  const data = { measuredAt: new Date().toISOString(), runs, attempts, profiles: PROFILES, fingerprint, fingerprintFiles,
    comparisonEpisodes, rows: batches.flat().sort((left, right) => left.start - right.start) };
  fs.writeFileSync(path.join(archive, 'count-profile-data.json'), JSON.stringify(data));
  console.log('Saved count profiles:', data.rows.length, 'episodes,', Object.keys(PROFILES).length, 'profiles');
}

if (!isMainThread && workerData?.countProfiles) parentPort.postMessage({ rows: measure(workerData.tasks, workerData.runs, workerData.attempts) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES };
