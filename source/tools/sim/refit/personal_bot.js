'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { NAMES, CONFIG, boardId, conditional, cumulative, fit, predict, recentRate, loss } = require('./personal_model.js');
const OUTPUT = path.resolve(__dirname, '../../../analysis/personal-bots');
const CACHE = path.resolve(__dirname, '../../../analysis/archive/personal-bots');
const slug = name => name.replace(/[^A-Za-z]/g, '');
const bot = kinds => ({ ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp: CONFIG.care })),
  allMoves: true, flips: true, kinds, peek: 0, end: 12, plan: 10, memory: CONFIG.memory });

function episodesOf(tries) {
  const episodes = [];
  for (const attempt of tries) {
    const board = boardId(attempt.g), previous = episodes.at(-1);
    if (!previous || previous.board !== board || attempt.at <= previous.tries.at(-1).at) {
      episodes.push({ board, lv: attempt.lv, version: attempt.v, t: attempt.startedAt, g: attempt.g,
        attemptOffset: previous && previous.board !== board ? attempt.at - 1 : 0, tries: [] });
    }
    episodes.at(-1).tries.push(attempt);
  }
  return episodes;
}

function fingerprint(episodes, runs) {
  const hash = crypto.createHash('sha256').update(JSON.stringify({ CONFIG, runs,
    episodes: episodes.map(episode => ({ board: episode.board, t: episode.t, tries: episode.tries.map(({ aid, at, t, won }) => ({ aid, at, t, won })) })) }));
  for (const file of ['personal_bot.js', 'personal_model.js', 'kinds.js', 'pdata.js', 'boards.js', 'mimic_games.js', '../../../www/hard.js', '../../../www/layouts.js',
    ...NAMES.map(name => 'mimic/' + (name === 'Mrs. Doubtfire' ? 'Mrs_Doubtfire' : name) + '.json')]) {
    hash.update(fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex');
}

function measure(name, runs) {
  const { triesOf } = require('./pdata.js'), { kindsAt } = require('./kinds.js');
  const episodes = episodesOf(triesOf(name)), identity = fingerprint(episodes, runs);
  const file = path.join(CACHE, slug(name) + '.json');
  if (fs.existsSync(file)) {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cached.fingerprint === identity) return cached;
  }
  const rows = [];
  episodes.forEach((episode, index) => {
    const maxAttempt = Math.max(4, ...episode.tries.map(attempt => attempt.at - episode.attemptOffset));
    const chain = Hard.rateChain(episode.g, runs, 20261016, bot(kindsAt(name, episode.t)), CONFIG.memory, maxAttempt);
    for (const attempt of episode.tries) rows.push({ name, episode: slug(name) + '-' + index, board: episode.board,
      lv: attempt.lv, version: attempt.v, at: attempt.at, t: attempt.t, startedAt: attempt.startedAt, won: attempt.won,
      src: attempt.src, raw: conditional(chain, attempt.at - episode.attemptOffset),
      extrapolated: chain.cond[attempt.at - episode.attemptOffset - 1] === null });
    if (isMainThread) process.stderr.write('.');
    else parentPort.postMessage({ progress: name, done: index + 1, total: episodes.length });
  });
  const result = { fingerprint: identity, name, runs, episodes: episodes.length, rows };
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result));
  return result;
}

async function measureAll(runs) {
  const pending = [...NAMES], results = [];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (pending.length) {
      const name = pending.shift();
      results.push(await new Promise((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { personalBot: true, name, runs } });
        worker.on('message', message => {
          if (message.result) resolve(message.result);
          else if (message.done % 15 === 0 || message.done === message.total) console.log(`${name}: ${message.done}/${message.total} boards`);
        });
        worker.on('error', reject);
        worker.on('exit', code => { if (code !== 0) reject(new Error('Measurement worker failed: ' + code)); });
      }));
    }
  }));
  return results.flatMap(result => result.rows).sort((left, right) => left.t - right.t);
}

function metrics(rows, field) {
  if (!rows.length) return { n: 0 };
  const positive = rows.filter(row => row.won), negative = rows.filter(row => !row.won);
  let concordant = 0;
  for (const winner of positive) for (const loser of negative) concordant += winner[field] > loser[field] ? 1 : winner[field] === loser[field] ? 0.5 : 0;
  return { n: rows.length, won: positive.length, expected: rows.reduce((sum, row) => sum + row[field], 0),
    logLoss: rows.reduce((sum, row) => sum + loss(row[field], row.won), 0) / rows.length,
    brier: rows.reduce((sum, row) => sum + (row[field] - +row.won) ** 2, 0) / rows.length,
    auc: positive.length && negative.length ? concordant / positive.length / negative.length : null };
}

function evaluate(rows) {
  const episodeOrder = Object.fromEntries(NAMES.map(name => [name, [...new Set(rows.filter(row => row.name === name).map(row => row.episode))]]));
  const scored = [];
  for (const row of rows) {
    if (episodeOrder[row.name].indexOf(row.episode) < 6) continue;
    const past = rows.filter(previous => previous.t < row.startedAt);
    const model = fit(past), withoutBoards = fit(past, false);
    scored.push({ ...row, personal: predict(model, row), noBoard: predict(withoutBoards, row), baseline: recentRate(past, row),
      holdout: episodeOrder[row.name].indexOf(row.episode) >= Math.floor(episodeOrder[row.name].length * 0.75) });
  }
  const summary = subset => Object.fromEntries(['personal', 'noBoard', 'baseline'].map(field => [field, metrics(subset, field)]));
  const report = { made: new Date().toISOString(), config: CONFIG, note: 'Parameters fixed before this run; historical data already examined by earlier research is not a pristine holdout.',
    all: summary(scored), first: summary(scored.filter(row => row.at === 1)), latestQuarter: summary(scored.filter(row => row.holdout)),
    exactBoards: summary(scored.filter(row => row.src !== 'classic')),
    players: Object.fromEntries(NAMES.map(name => [name, { all: summary(scored.filter(row => row.name === name)),
      first: summary(scored.filter(row => row.name === name && row.at === 1)), latestQuarter: summary(scored.filter(row => row.name === name && row.holdout)) }])),
    calibration: [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.01]].map(([from, to]) => ({ from, to, ...metrics(scored.filter(row => row.personal >= from && row.personal < to), 'personal') })),
    extrapolatedRetries: scored.filter(row => row.extrapolated).length,
    pairedImprovement: pairedImprovement(scored), latestQuarterImprovement: pairedImprovement(scored.filter(row => row.holdout)) };
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, 'evaluation.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(CACHE, 'scored.json'), JSON.stringify(scored));
  console.log(JSON.stringify({ all: report.all, first: report.first, latestQuarter: report.latestQuarter, players: report.players }, null, 2));
  return report;
}

function pairedImprovement(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.episode)) groups.set(row.episode, []);
    groups.get(row.episode).push(loss(row.baseline, row.won) - loss(row.personal, row.won));
  }
  const episodes = [...groups.values()], samples = [], random = require('../../../www/layouts.js').rng(20261016);
  for (let repeat = 0; repeat < 1000; repeat++) {
    let sum = 0, count = 0;
    for (let index = 0; index < episodes.length; index++) {
      const group = episodes[Math.floor(random() * episodes.length)];
      sum += group.reduce((total, value) => total + value, 0);
      count += group.length;
    }
    samples.push(sum / count);
  }
  samples.sort((left, right) => left - right);
  return { baselineMinusPersonal: rows.reduce((sum, row) => sum + loss(row.baseline, row.won) - loss(row.personal, row.won), 0) / rows.length,
    episodeBootstrap95: [samples[25], samples[974]], episodes: episodes.length };
}

function currentTarget(events) {
  const relevant = Object.values(events || {}).filter(event => ['start', 'end'].includes(event.k) && event.m !== 'd' && !event.tk && event.lv)
    .sort((left, right) => left.t - right.t);
  const latest = relevant.at(-1);
  if (!latest) return null;
  return { lv: latest.k === 'end' && latest.r === 'win' ? latest.lv + 1 : latest.lv,
    at: latest.k === 'start' ? latest.at || 1 : latest.r === 'win' ? 1 : (latest.at || 1) + 1,
    version: latest.v, observedAt: latest.t, active: latest.k === 'start', assisted: !!(latest.ez || latest.h || latest.sh || latest.rb) };
}

function forecast(rows, runs, horizon) {
  const { kindsAt } = require('./kinds.js'), { board } = require('./predict_mbot.js'), { PIDS } = require('./mimic_games.js');
  const plays = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/archive/realdata/plays.json'), 'utf8'));
  const now = Date.now(), past = rows.filter(row => row.t < now), model = fit(past);
  const out = { made: new Date(now).toISOString(), version: '1.55', config: CONFIG, runs, published: false, players: {} };
  for (const name of NAMES) {
    const target = currentTarget(plays[PIDS[name]]);
    if (!target || target.version !== '1.55' || target.assisted) { out.players[name] = { target, unavailable: 'Current forecast requires an unassisted 1.55 board.' }; continue; }
    const policy = bot(kindsAt(name, now)), levels = {};
    for (let offset = 0; offset < horizon; offset++) {
      const lv = target.lv + offset, firstAttempt = offset ? 1 : target.at;
      const game = board(lv, name === 'PUK' ? 1.1 : 1.6), identity = boardId(game);
      const chain = Hard.rateChain(game, runs, 20261017, policy, CONFIG.memory, Math.max(4, firstAttempt + 3));
      const probabilities = [0, 1, 2, 3].map(index => predict(model, { name, board: identity, at: firstAttempt + index, raw: conditional(chain, firstAttempt + index) }));
      const reached = runs * (firstAttempt > 1 ? 1 - chain.within[firstAttempt - 2] : 1);
      levels[lv] = { fromAttempt: firstAttempt, next: probabilities[0], within2: cumulative(probabilities)[1], within4: cumulative(probabilities)[3],
        rawConditional: [0, 1, 2, 3].map(index => chain.cond[firstAttempt + index - 1]),
        extrapolated: chain.cond[firstAttempt - 1] === null, board: identity, source: game.src,
        simulatedPathsReachingAttempt: Math.round(reached), earlierTriesOnBoard: past.filter(row => row.board === identity).length };
      console.log(`${name} L${lv} attempt ${firstAttempt}: ${Math.round(probabilities[0] * 100)}%`);
    }
    out.players[name] = { target, habitsFrom: new Date(require('./kinds.js').lastRecording(name)).toISOString(),
      tries: past.filter(row => row.name === name).length, habits: kindsAt(name, now), levels };
  }
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, 'forecast.json'), JSON.stringify(out, null, 2));
  return out;
}

async function main() {
  const [command = 'evaluate', runsText = '128', horizonText = '3', forecastRunsText = '1024'] = process.argv.slice(2);
  const runs = Number(runsText), horizon = Number(horizonText);
  const forecastRuns = Number(forecastRunsText);
  if (!['evaluate', 'forecast'].includes(command) || !Number.isInteger(runs) || runs < 1 || !Number.isInteger(horizon) || horizon < 1 || !Number.isInteger(forecastRuns) || forecastRuns < 1) throw new Error('Usage: node personal_bot.js evaluate|forecast [training runs=128] [levels=3] [forecast runs=1024]');
  const rows = await measureAll(runs);
  if (command === 'evaluate') evaluate(rows);
  else {
    evaluate(rows);
    forecast(rows, forecastRuns, horizon);
  }
}

if (!isMainThread && workerData?.personalBot) parentPort.postMessage({ result: measure(workerData.name, workerData.runs) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { episodesOf, currentTarget, metrics };
