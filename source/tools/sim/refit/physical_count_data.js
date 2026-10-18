'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { NAMES, CONFIG, boardId } = require('./personal_model.js');
const { outcomesOf, features } = require('./attempt_count.js');
const { PIDS, boardOf } = require('./mimic_games.js');
const { designed } = require('./boards.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const PROFILES = {
  baseline: { scope: 'legacy', memory: CONFIG.memory },
  physicalAll: { scope: 'all', memory: CONFIG.memory },
  physicalNovel: { scope: 'novel', memory: CONFIG.memory },
  physicalNovelLearning: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true },
  physicalPhasedLearning: { scope: 'novel', retryScope: 'all', memory: 1, learnFromLoss: true },
};
const CLOCK_PROFILES = { ...PROFILES,
  physicalNovelPlan8: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8 },
  physicalNovelPlan14: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14 },
  physicalNovelPlan24: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 24 },
  physicalRetryPlan14: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true, retryPolicy: { physicalPlan: 14 } },
};
const FINISH_PROFILES = { ...CLOCK_PROFILES,
  physicalFinish80: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14, physicalSafety: 0.8 },
  physicalFinish95: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14, physicalSafety: 0.95 },
  physicalFinish100: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14, physicalSafety: 1 },
  physicalFinishSafeExit: { scope: 'novel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14, physicalSafety: 1, physicalClockSafeExit: true },
};
const PERSONAL_PROFILES = {
  baseline: PROFILES.baseline,
  ownAll: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true },
  ownNovel: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true },
  ownPhased: { scope: 'ownNovel', retryScope: 'ownAll', memory: 1, learnFromLoss: true },
  ownPlan8: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8 },
  ownPlan14: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14 },
  ownFinish80: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14, physicalSafety: 0.8 },
  ownFinish100: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14, physicalSafety: 1 },
};
const JOINT_PROFILES = {
  baseline: PROFILES.baseline,
  ownAll: PERSONAL_PROFILES.ownAll,
  ownNovelPlan8: PERSONAL_PROFILES.ownPlan8,
  ownJointAll: { scope: 'ownJointAll', memory: CONFIG.memory, learnFromLoss: true },
  ownJointNovel: { scope: 'ownJointNovel', memory: CONFIG.memory, learnFromLoss: true },
  ownJointAllPlan8: { scope: 'ownJointAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8 },
  ownJointNovelPlan8: { scope: 'ownJointNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8 },
  ownJointAllPlan14: { scope: 'ownJointAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 14 },
  ownJointRecallPlan8: { scope: 'ownJointAll', memory: 1, learnFromLoss: true, physicalPlan: 8 },
};
const KEY_PROFILES = {
  baseline: PROFILES.baseline,
  ownAll: PERSONAL_PROFILES.ownAll,
  ownAllPlan8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8 },
  ownNovelPlan8: PERSONAL_PROFILES.ownPlan8,
  ownAllKey8: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalKeyPlan: 8 },
  ownAllKey14: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalKeyPlan: 14 },
  ownNovelKey8: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalKeyPlan: 8 },
  ownNovelKey14: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalKeyPlan: 14 },
  ownNovelKey14SafeExit: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalKeyPlan: 14, physicalKeySafeExit: true },
  ownAllRecallKey14: { scope: 'ownAll', memory: 1, learnFromLoss: true, physicalPlan: 8, physicalKeyPlan: 14 },
};
const SINGLE_PROFILES = {
  baseline: PROFILES.baseline,
  ownAll: PERSONAL_PROFILES.ownAll,
  ownAllPlan8: KEY_PROFILES.ownAllPlan8,
  ownNovelPlan8: KEY_PROFILES.ownNovelPlan8,
  ownAllKey14: KEY_PROFILES.ownAllKey14,
  ownNovelKey14SafeExit: KEY_PROFILES.ownNovelKey14SafeExit,
  ownAllRecallKey14: KEY_PROFILES.ownAllRecallKey14,
  ownAllFinish95: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalSafety: 0.95 },
  ownNovelFinish95: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalSafety: 0.95 },
};
const INTENT_PROFILES = {
  baseline: PROFILES.baseline,
  ownAll: PERSONAL_PROFILES.ownAll,
  ownAllPlan8: KEY_PROFILES.ownAllPlan8,
  ownNovelPlan8: KEY_PROFILES.ownNovelPlan8,
  ownAllIntent: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalFollowThrough: 'fitted' },
  ownNovelIntent: { scope: 'ownNovel', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalFollowThrough: 'fitted' },
  ownAllIntentKey14: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalKeyPlan: 14, physicalFollowThrough: 'fitted' },
  ownAllIntentHalf: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalFollowThrough: 0.5 },
  ownAllIntentFull: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8, physicalFollowThrough: 1 },
  ownAllIntentRecall: { scope: 'ownAll', memory: 1, learnFromLoss: true, physicalPlan: 8, physicalFollowThrough: 'fitted' },
};
const RELATION_PROFILES = {
  baseline: PROFILES.baseline,
  ownAll: PERSONAL_PROFILES.ownAll,
  ownAllPlan8: KEY_PROFILES.ownAllPlan8,
  ownNovelPlan8: KEY_PROFILES.ownNovelPlan8,
  ownAllKey14: KEY_PROFILES.ownAllKey14,
  ownNovelKey14SafeExit: KEY_PROFILES.ownNovelKey14SafeExit,
};
const SEQUENCE_PROFILES = {
  baseline: PROFILES.baseline,
  ownAll: PERSONAL_PROFILES.ownAll,
  ownAllPlan8: KEY_PROFILES.ownAllPlan8,
  ownNovelPlan8: KEY_PROFILES.ownNovelPlan8,
  ownAllPairPlan8: { ...KEY_PROFILES.ownAllPlan8, physicalPairFollowThrough: 'fitted' },
  ownNovelPairPlan8: { ...KEY_PROFILES.ownNovelPlan8, physicalPairFollowThrough: 'fitted' },
  ownAllBothPlan8: { ...KEY_PROFILES.ownAllPlan8, physicalFollowThrough: 'fitted', physicalPairFollowThrough: 'fitted' },
};
const MEMORY_PROFILES = {
  baseline: PROFILES.baseline,
  ownAll: PERSONAL_PROFILES.ownAll,
  ownAllPlan8: KEY_PROFILES.ownAllPlan8,
  ownNovelPlan8: KEY_PROFILES.ownNovelPlan8,
  ownCarryPlan8: { scope: 'ownCarryAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8 },
  ownRecallPlan8: { scope: 'ownRecallAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 8 },
  ownRecallFullPlan8: { scope: 'ownRecallAll', memory: 1, learnFromLoss: true, physicalPlan: 8 },
};

function tasksOf() {
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'), 'utf8'));
  return NAMES.flatMap(name => {
    const events = Object.values(plays[PIDS[name]] || {}).filter(event => event.m !== 'd' && !event.tk);
    const recorded = new Map(), replays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/replays/' + PIDS[name] + '.json'), 'utf8'));
    for (const [aid, chunks] of Object.entries(replays)) for (const row of Object.values(chunks)) if (row?.data) {
      const init = JSON.parse(row.data).init;
      if (init && !init.partial && !init.track && init.state) recorded.set(aid, boardId(boardOf(init)));
    }
    return outcomesOf(name).map(({ events: ends, ...row }) => {
      const aids = [...new Set([...(row.campaignAids || []), ...ends.map(event => event.aid), ...events.filter(event => event.k === 'start'
        && event.lv === row.lv && event.t >= row.start && event.t <= row.end).map(event => event.aid)].filter(Boolean))];
      const boards = ends.map(event => recorded.get(event.aid) || (() => { const game = designed(event.v, event.lv); return game ? boardId(game) : null; })()).filter(Boolean);
      const highestEarlierClear = Math.max(0, ...events.filter(event => event.k === 'end' && event.r === 'win' && event.t < row.start).map(event => event.lv));
      return { ...row, excludedAids: aids, firstClear: row.lv > highestEarlierClear,
        boardChangedWithinCampaign: new Set(boards).size > 1,
        openingRecorded: row.openingRecorded };
    });
  }).sort((left, right) => left.start - right.start);
}

function prepare() {
  const rows = tasksOf(), now = Date.now();
  const requests = rows.map(({ name, start, excludedAids }) => ({ name, start, excludedAids }));
  requests.push(...NAMES.map(name => ({ name, start: now, excludedAids: [] })));
  fs.writeFileSync(path.join(archive, 'physical-count-requests.json'), JSON.stringify({ made: new Date().toISOString(), requests,
    note: 'Availability schedule only: no target outcomes or board pictures. Target aids are excluded even when historical opening time is inferred.' }));
  console.log('Prepared', requests.length, 'model-availability requests');
}

function selectModels(bank, row) {
  const selected = bank.selections.find(item => item.name === row.name && item.start === row.start);
  if (!selected) throw new Error('No pre-opening physical model for ' + row.name + '/' + row.start);
  const models = {};
  for (const [scope, identity] of Object.entries(selected.models)) {
    const model = bank.models.find(item => item.id === identity);
    if (!model || model.trainingCut > row.start || (model.availableThrough !== null && model.availableThrough >= row.start)
      || model.trainedAids.some(aid => row.excludedAids.includes(aid))) throw new Error('Target trajectory or future prefix entered the physical policy');
    models[scope] = model;
  }
  return models;
}

function actorOf(model) {
  if (model.withinWeights.length !== Hard.POLICY_FEAT.length + Hard.GOAL_FEAT.length) throw new Error('Physical actor feature mismatch');
  return { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, forceMatches: false, peek: 0, end: 0, plan: 0,
    physicalSingleStep: !!model.physicalSingleStep,
    ...(model.jointChoice ? { jointKindModel: model.kindModel } : { kindModel: model.kindModel }), w: model.withinWeights.slice(0, Hard.FEAT.length),
    spatial: model.withinWeights.slice(Hard.FEAT.length, Hard.POLICY_FEAT.length), goalWeights: model.withinWeights.slice(Hard.POLICY_FEAT.length) };
}

function measure(tasks, runs, profiles = PROFILES, bankFile = 'physical-policy-bank.json') {
  const bank = JSON.parse(fs.readFileSync(path.join(archive, bankFile), 'utf8'));
  return tasks.map(({ game, ...row }, position) => {
    const models = selectModels(bank, row), chains = {};
    for (const [name, { scope, retryScope, ...parameters }] of Object.entries(profiles)) {
      const base = scope === 'legacy' ? { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 12, plan: 10,
        kinds: { ...DEFAULT_KINDS, ...kindsAt(row.name, row.start) },
        w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: CONFIG.care })] } : actorOf(models[scope]);
      const followThrough = parameters.physicalFollowThrough === 'fitted' ? models[scope]?.followThrough?.probabilities : parameters.physicalFollowThrough;
      if (parameters.physicalFollowThrough === 'fitted' && !followThrough) throw new Error('No earlier fitted personal follow-through model');
      const pairFollowThrough = parameters.physicalPairFollowThrough === 'fitted' ? models[scope]?.pairFollowThrough?.probabilities : parameters.physicalPairFollowThrough;
      if (parameters.physicalPairFollowThrough === 'fitted' && !pairFollowThrough) throw new Error('No earlier fitted personal pair follow-through model');
      const persona = { ...base, ...parameters, ...(followThrough !== undefined ? { physicalFollowThrough: followThrough } : {}),
        ...(pairFollowThrough !== undefined ? { physicalPairFollowThrough: pairFollowThrough } : {}),
        ...(retryScope ? { retryPolicy: actorOf(models[retryScope]) } : {}) };
      chains[name] = Hard.rateChain(game, runs, 20261028, persona, parameters.memory, 32);
    }
    const reference = { strong: Hard.rate(game, 32, 20261019, Hard.persona('strong')).rate,
      average: Hard.rate(game, 32, 20261019, Hard.persona('average')).rate };
    if ((position + 1) % 5 === 0) parentPort.postMessage({ progress: 'Physical-count worker ' + workerData.index + ': ' + (position + 1) + '/' + tasks.length });
    return { ...row, chains, physical: features(game), reference,
      policyAvailability: Object.fromEntries(Object.entries(models).map(([scope, model]) => [scope,
        { id: model.id, trainingCut: model.trainingCut, availableThrough: model.availableThrough, trainingGames: model.trainingGames }])) };
  });
}

async function main() {
  const runs = +(process.argv[2] || 32);
  const experiment = process.argv[3] || 'physical';
  if (!['physical', 'clock', 'finish', 'personal', 'joint', 'keys', 'single', 'intent', 'relation', 'sequence', 'memory'].includes(experiment)) throw new Error('Unknown physical-count experiment');
  const profiles = experiment === 'memory' ? MEMORY_PROFILES : experiment === 'sequence' ? SEQUENCE_PROFILES : experiment === 'relation' ? RELATION_PROFILES : experiment === 'intent' ? INTENT_PROFILES : experiment === 'single' ? SINGLE_PROFILES : experiment === 'keys' ? KEY_PROFILES : experiment === 'joint' ? JOINT_PROFILES : experiment === 'personal' ? PERSONAL_PROFILES : experiment === 'finish' ? FINISH_PROFILES : experiment === 'clock' ? CLOCK_PROFILES : PROFILES;
  if (!Number.isInteger(runs) || runs < 2) throw new Error('At least two simulation runs required');
  const bankFile = experiment === 'memory' ? 'physical-memory-policy-bank.json' : experiment === 'sequence' ? 'physical-sequence-policy-bank.json' : experiment === 'relation' ? 'physical-relation-policy-bank.json' : experiment === 'intent' ? 'physical-intent-policy-bank.json' : experiment === 'single' ? 'physical-single-policy-bank.json' : experiment === 'keys' ? 'physical-key-policy-bank.json' : experiment === 'joint' ? 'physical-joint-policy-bank.json' : 'physical-policy-bank.json';
  const bank = JSON.parse(fs.readFileSync(path.join(archive, bankFile), 'utf8'));
  if (experiment === 'single' && bank.models.some(model => !model.physicalSingleStep)) throw new Error('Single-step count measurement needs matching fitted single-step actors');
  for (const [file, expected] of Object.entries(bank.fitSources)) if (crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex') !== expected) throw new Error('Physical bank fit source changed: ' + file);
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(archive, 'physical-count-requests.json'))).digest('hex') !== bank.requestsSha256) throw new Error('Physical model-availability requests changed');
  const prefixFile = 'analysis/archive/personal-bots/' + (['memory', 'sequence', 'relation', 'intent', 'single'].includes(experiment) ? 'policy-' + experiment + '-prefix-data.json' : 'policy-prefix-data.json'), prefixRaw = fs.readFileSync(path.join(root, prefixFile));
  if (crypto.createHash('sha256').update(prefixRaw).digest('hex') !== bank.prefixDataSha256) throw new Error('Physical bank prefix data changed');
  const prefix = JSON.parse(prefixRaw);
  const digest = crypto.createHash('sha256');
  for (const file of prefix.fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
  if (digest.digest('hex') !== bank.prefixFingerprint) throw new Error('Physical prefix sources are stale');
  const tasks = tasksOf(), comparisonEpisodes = NAMES.flatMap(name => tasks.filter(row => row.name === name && row.firstClear
    && row.firstAttempt === 1 && row.wonOn !== null).sort((left, right) => left.end - right.end).slice(-20).map(row => row.name + '|' + row.start));
  const fingerprintFiles = [...new Set([...prefix.fingerprintFiles, prefixFile, 'analysis/archive/personal-bots/' + bankFile,
    'analysis/archive/personal-bots/physical-count-requests.json', ...['physical_count_data.js', 'physical_policy_bank.py', 'personal_full_choice_fit.py',
      'personal_count_fit.py', 'kinds.js', 'personal_model.js', 'personal_policy_prior.js', 'attempt_count.js', 'attempt_count_labels.js', 'attempt_campaigns.js',
      'attempt_features.js', 'pdata.js', 'boards.js', 'board_versions.js', 'attempts.json'].map(file => 'tools/sim/refit/' + file),
    ...fs.readdirSync(path.join(__dirname, 'tables')).filter(file => /^(levels|hard|early)-/.test(file)).sort().map(file => 'tools/sim/refit/tables/' + file),
    ...NAMES.map(name => 'tools/sim/refit/mimic/' + (name === 'Mrs. Doubtfire' ? 'Mrs_Doubtfire' : name) + '.json')])];
  const fingerprintOf = () => { const hash = crypto.createHash('sha256'); for (const file of fingerprintFiles) hash.update(fs.readFileSync(path.join(root, file))); return hash.digest('hex'); };
  const fingerprint = fingerprintOf();
  const batches = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { physicalCounts: true, index, runs, profiles, bankFile, tasks: tasks.filter((task, position) => position % 3 === index) } });
    worker.on('message', message => message.rows ? resolve(message.rows) : console.log(message.progress));
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Physical-count worker failed')); });
  })));
  if (fingerprintOf() !== fingerprint) throw new Error('Physical-count inputs changed during measurement');
  const data = { measuredAt: new Date().toISOString(), scope: experiment === 'memory' ? 'recent-first-clear-own-memory-consistent-training-development-v1'
    : experiment === 'sequence' ? 'recent-first-clear-own-pair-follow-through-development-v1'
    : experiment === 'relation' ? 'recent-first-clear-own-pair-preparation-development-v1'
    : experiment === 'intent' ? 'recent-first-clear-own-follow-through-development-v1'
    : experiment === 'single' ? 'recent-first-clear-own-single-step-development-v1'
    : experiment === 'keys' ? 'recent-first-clear-own-key-planning-development-v1'
    : experiment === 'joint' ? 'recent-first-clear-own-joint-choice-development-v1'
    : experiment === 'personal' ? 'recent-first-clear-own-person-development-v1'
    : experiment === 'finish' ? 'recent-first-clear-physical-finish-development-v1'
    : experiment === 'clock' ? 'recent-first-clear-physical-clock-development-v1' : 'recent-first-clear-development-v1', runs, attempts: 32, referenceRuns: 32,
    profiles, comparisonEpisodes, fingerprint, fingerprintFiles, rows: batches.flat().sort((left, right) => left.start - right.start),
    note: 'Latest twenty confirmed first-clear wins per person, selected before this experiment, never replay scores. Historical exploratory evidence only; future numeric ledgers are unchanged.' };
  fs.writeFileSync(path.join(archive, experiment === 'memory' ? 'physical-memory-count-data.json' : experiment === 'sequence' ? 'physical-sequence-count-data.json' : experiment === 'relation' ? 'physical-relation-count-data.json' : experiment === 'intent' ? 'physical-intent-count-data.json' : experiment === 'single' ? 'physical-single-count-data.json' : experiment === 'keys' ? 'physical-key-count-data.json' : experiment === 'joint' ? 'physical-joint-count-data.json' : experiment === 'personal' ? 'physical-personal-count-data.json' : experiment === 'finish' ? 'physical-finish-count-data.json'
    : experiment === 'clock' ? 'physical-clock-count-data.json' : 'physical-count-data.json'), JSON.stringify(data));
  console.log('Saved', data.rows.length, 'physical-count episodes and', comparisonEpisodes.length, 'new-level comparison episodes');
}

if (!isMainThread && workerData?.physicalCounts) parentPort.postMessage({ rows: measure(workerData.tasks, workerData.runs, workerData.profiles, workerData.bankFile) });
else if (require.main === module) {
  if (process.argv[2] === 'targets') prepare();
  else main().catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { tasksOf, selectModels, actorOf, PROFILES, CLOCK_PROFILES, FINISH_PROFILES, PERSONAL_PROFILES, JOINT_PROFILES, KEY_PROFILES, SINGLE_PROFILES, INTENT_PROFILES, RELATION_PROFILES, SEQUENCE_PROFILES, MEMORY_PROFILES };
