'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { NAMES, CONFIG, conditional } = require('./personal_model.js');
const { outcomesOf, features } = require('./attempt_count.js');
const { histories } = require('./attempt_features.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const Hard = require('../../../www/hard.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/personal-kind-policy.json'), 'utf8'));

function measure(tasks, runs, mode) {
  const results = [];
  const goals = mode === 'goal' ? JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/personal-goal-policy.json'), 'utf8')) : null;
  const inspection = mode === 'inspection' ? require('./personal_inspection.js') : null;
  const recorded = inspection ? inspection.recordings() : null;
  const clockPlan = mode === 'clock' ? require('./personal_clock_plan.js') : null;
  const clockData = clockPlan ? JSON.parse(fs.readFileSync(path.join(archive, 'clock-plan-data.json'), 'utf8')) : null;
  const matchModel = mode === 'match' ? require('./personal_match_error.js') : null;
  const matchRecorded = matchModel ? matchModel.recordings() : null;
  for (const { game, ...episode } of tasks) {
    const persona = { ...Hard.P, w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 })], allMoves: true,
      flips: true, kinds: { ...DEFAULT_KINDS, ...kindsAt(episode.name, episode.start) }, peek: 0, end: 12, plan: 10, memory: CONFIG.memory };
    const fitted = policy.players[episode.name], modelAvailable = fitted.trainingCut <= episode.start;
    const contextPersona = modelAvailable ? { ...persona, kindModel: fitted.model } : persona;
    const controlChain = Hard.rateChain(game, runs, 20261023, mode === 'kind' ? persona : contextPersona, CONFIG.memory, 20);
    const goalAvailable = goals && goals.players[episode.name].trainingCut <= episode.start;
    const scan = inspection ? inspection.inspectionAt(recorded, episode.name, episode.start) : null;
    const clock = clockPlan ? clockPlan.clockPlanAt(clockData.rows, episode.name, episode.start) : null;
    const match = matchModel ? matchModel.matchErrorAt(matchRecorded, episode.name, episode.start) : null;
    const contextChain = match ? Hard.rateChain(game, runs, 20261023,
      { ...contextPersona, matchError: match.probability }, CONFIG.memory, 20) : clock ? Hard.rateChain(game, runs, 20261023,
      { ...contextPersona, plan: clock.horizon }, CONFIG.memory, 20) : scan ? Hard.rateChain(game, runs, 20261023,
      { ...contextPersona, scanBeforeMatch: scan.probability }, CONFIG.memory, 20) : mode === 'goal' ? goalAvailable ? Hard.rateChain(game, runs, 20261023,
      { ...contextPersona, goalWeights: goals.players[episode.name].weights }, CONFIG.memory, 20) : controlChain :
      modelAvailable ? Hard.rateChain(game, runs, 20261023, contextPersona, CONFIG.memory, 20) : controlChain;
    const referenceRuns = mode === 'kind' ? 128 : 64;
    const reference = { strong: Hard.rate(game, referenceRuns, 20261019, Hard.persona('strong')).rate,
      average: Hard.rate(game, referenceRuns, 20261019, Hard.persona('average')).rate };
    results.push({ ...episode, reference, physical: features(game), controlChain, contextChain,
      ...(scan ? { inspection: scan } : {}),
      ...(clock ? { clockPlanning: clock } : {}),
      ...(match ? { matchError: match } : {}),
      modelAvailable: match ? match.probability > 0 : clock ? !!game.clock && clock.available : scan ? scan.probability > 0 : mode === 'goal' ? goalAvailable : modelAvailable });
    if (results.length % 10 === 0) parentPort.postMessage({ progress: 'Context worker ' + workerData.index + ': ' + results.length + '/' + tasks.length });
  }
  return results;
}

async function main() {
  const runs = +(process.argv[2] || 64);
  const mode = process.argv.includes('--match') ? 'match' : process.argv.includes('--clock') ? 'clock' : process.argv.includes('--inspection') ? 'inspection' : process.argv.includes('--goal') ? 'goal' : 'kind';
  const previous = JSON.parse(fs.readFileSync(path.join(archive, 'attempt-count-data.json'), 'utf8'));
  const evaluation = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/attempt-count-evaluation.json'), 'utf8'));
  const baselineFile = path.join(archive, 'kind-pre-clock-fix-data.json');
  if (mode === 'goal' && !fs.existsSync(baselineFile)) fs.copyFileSync(path.join(archive, 'kind-count-data.json'), baselineFile);
  const baselines = mode === 'goal' ? new Map(JSON.parse(fs.readFileSync(baselineFile, 'utf8')).rows.map(row =>
    [row.name + '|' + row.start + '|' + row.board, row.contextChain])) : new Map();
  const comparisonEpisodes = previous.rows.filter(row => row.firstAttempt === 1 && row.wonOn !== null && row.start >= evaluation.playerTestStartsAt[row.name])
    .map(row => row.name + '|' + row.start);
  const tasks = NAMES.flatMap(name => outcomesOf(name).map(({ events, ...episode }) => ({ ...episode,
    ...(mode === 'goal' ? { beforeFixChain: baselines.get(name + '|' + episode.start + '|' + episode.board) || null } : {}) })))
    .sort((left, right) => left.start - right.start);
  const fingerprintFiles = ['www/hard.js', 'www/layouts.js', 'tools/sim/refit/kind_count_measure.js', 'tools/sim/refit/kinds.js',
    'tools/sim/refit/boards.js', 'tools/sim/refit/mimic_games.js', 'tools/sim/refit/pdata.js',
    'tools/sim/refit/attempt_count.js', 'tools/sim/refit/attempt_count_labels.js', 'tools/sim/refit/attempt_features.js',
    'tools/sim/refit/personal_model.js', 'tools/sim/refit/personal_policy_prior.js', 'tools/sim/refit/personal_kind_fit.py',
    'analysis/personal-bots/personal-kind-policy.json', 'analysis/archive/realdata/plays.json',
    ...Object.values(require('./mimic_games.js').PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...fs.readdirSync(path.join(__dirname, 'tables')).filter(filename => /^(levels|hard|early)-/.test(filename)).sort().map(filename => 'tools/sim/refit/tables/' + filename),
    ...NAMES.map(name => 'tools/sim/refit/mimic/' + (name === 'Mrs. Doubtfire' ? 'Mrs_Doubtfire' : name) + '.json')];
  if (mode === 'goal') fingerprintFiles.push('analysis/archive/personal-bots/kind-pre-clock-fix-data.json',
    'analysis/personal-bots/personal-goal-policy.json', 'tools/sim/refit/personal_goal_fit.py');
  if (mode === 'inspection') fingerprintFiles.push('tools/sim/refit/personal_inspection.js', 'tools/sim/refit/match_notice_audit.js');
  if (mode === 'clock') fingerprintFiles.push('tools/sim/refit/personal_clock_plan.js', 'analysis/archive/personal-bots/clock-plan-data.json');
  if (mode === 'match') fingerprintFiles.push('tools/sim/refit/personal_match_error.js', 'tools/sim/refit/failure_audit.js');
  const digest = crypto.createHash('sha256');
  for (const filename of fingerprintFiles) digest.update(fs.readFileSync(path.join(root, filename)));
  const fingerprint = digest.digest('hex');
  const batches = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { kindCount: true, index, runs, mode, tasks: tasks.filter((task, position) => position % 3 === index) } });
    worker.on('message', message => message.results ? resolve(message.results) : console.log(message.progress));
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Context measurement worker failed')); });
  })));
  const rows = batches.flat().sort((left, right) => left.start - right.start);
  for (const row of rows) row.features = countFeatures(rows, row);
  fs.writeFileSync(path.join(archive, mode + '-count-data.json'), JSON.stringify({ measuredAt: new Date().toISOString(), runs, mode,
    referenceRuns: mode === 'kind' ? 128 : 64,
    fingerprint, fingerprintFiles, comparisonEpisodes, rows }));
  console.log('Saved honest control/context comparison:', rows.length, 'episodes');
}

function countFeatures(rows, row) {
  return [...NAMES.map(name => +(name === row.name)), row.lv, ...row.physical,
    ...[1, 2, 3, 4].map(attempt => conditional(row.controlChain, attempt)), ...histories(rows, row), row.reference.strong, row.reference.average,
    ...[1, 2, 3, 4].map(attempt => conditional(row.contextChain, attempt))];
}

if (!isMainThread && workerData?.kindCount) parentPort.postMessage({ results: measure(workerData.tasks, workerData.runs, workerData.mode) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { countFeatures };
