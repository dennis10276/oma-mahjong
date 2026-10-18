'use strict';
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { NAMES, CONFIG, boardId, conditional, fit, predict } = require('./personal_model.js');
const { PIDS, boardOf } = require('./mimic_games.js');
const { triesOf, classic } = require('./pdata.js');
const { designed } = require('./boards.js');
const { fixedEarlyLevel } = require('./board_versions.js');
const { kindsAt } = require('./kinds.js');
const { normalizeAttempts } = require('./attempt_count_labels.js');
const { campaignsOf } = require('./attempt_campaigns.js');
const { histories, rebuildFeatures } = require('./attempt_features.js');
const Hard = require('../../../www/hard.js');
const L = require('../../../www/layouts.js');
const archive = path.resolve(__dirname, '../../../analysis/archive');
const plays = JSON.parse(fs.readFileSync(path.join(archive, 'realdata/plays.json'), 'utf8'));

function outcomesOf(name) {
  const events = Object.values(plays[PIDS[name]] || {}).sort((left, right) => left.t - right.t);
  const groups = campaignsOf(events).filter(campaign => campaign.events.length);
  const recorded = new Map();
  const replays = JSON.parse(fs.readFileSync(path.join(archive, 'replays/' + PIDS[name] + '.json'), 'utf8'));
  for (const [aid, chunks] of Object.entries(replays)) for (const row of Object.values(chunks)) {
    if (!row?.data) continue;
    const init = JSON.parse(row.data).init;
    if (init && !init.partial && !init.track && init.state) recorded.set(aid, boardOf(init));
  }
  const rebuilt = new Map(triesOf(name).map(attempt => [attempt.t, attempt]));
  const results = [];
  for (const campaign of groups) {
    const group = campaign.events;
    const first = group[0], last = group.at(-1);
    const opening = campaign.start;
    let game = recorded.get(campaign.opening?.aid) || recorded.get(first.aid), source = game ? 'recorded' : null;
    const previous = rebuilt.get(first.t);
    if (!game && previous) { game = previous.g; source = previous.src; }
    if (!game && (first.lv >= 70 || fixedEarlyLevel(first.v, first.lv))) {
      game = designed(first.v, first.lv); source = 'table';
    }
    if (!game && first.lv < 70 && !fixedEarlyLevel(first.v, first.lv)) { game = classic(first.lv, { Dennisisdebeste: 1.5, 'Mrs. Doubtfire': 1.6, PUK: 1.1, Gerda: 1.6 }[name]); source = 'approximate'; }
    if (!game) continue;
    results.push({ name, lv: first.lv, version: first.v, start: opening, end: last.t,
      ...normalizeAttempts(campaign.firstCounter, last.r === 'win' ? last.at || 1 : null, campaign.confirmedOpening),
      observedAttempts: Math.max(...group.map(event => event.at || 1)) - campaign.firstCounter + 1,
      campaignAids: campaign.campaignAids, openingRecorded: !!campaign.opening?.aid,
      assisted: group.some(event => event.ez || event.h || event.sh || event.rb),
      source, board: boardId(game), game, events: group });
  }
  return results;
}

function features(game) {
  const alive = new Uint8Array(game.tiles.length).fill(1), free = game.tiles.map((tile, index) => index).filter(index => L.isFree(index, alive, game.nb));
  const faces = new Map();
  for (const index of free) if (!game.down[index]) faces.set(game.faces[index], (faces.get(game.faces[index]) || 0) + 1);
  return [game.tiles.length, game.down.reduce((sum, value) => sum + value, 0) / game.tiles.length,
    Math.max(...game.tiles.map(tile => tile.z)), free.length,
    [...faces.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0),
    game.clock ? game.clock.n / game.tiles.length : 0, game.clock ? 1 : 0,
    Object.keys(game.rules?.ice || {}).length, game.rules?.locks?.size || 0, game.rules?.keys?.length || 0,
    new Set(game.faces).size];
}

function measurePerson(name, runs) {
  const rows = [];
  for (const episode of outcomesOf(name)) {
    const policy = { ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp: CONFIG.care })),
      allMoves: true, flips: true, kinds: kindsAt(name, episode.start), peek: 0, end: 12, plan: 10, memory: CONFIG.memory };
    const chain = Hard.rateChain(episode.game, runs, 20261018, policy, CONFIG.memory, 20);
    const { game, events, ...summary } = episode;
    rows.push({ ...summary, physical: features(game), chain });
    if (rows.length % 15 === 0) parentPort?.postMessage({ progress: `${name}: ${rows.length} level forecasts` });
  }
  return rows;
}

async function main() {
  const runs = +(process.argv[2] || 256), pending = [...NAMES], measurements = [];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (pending.length) {
      const name = pending.shift();
      measurements.push(...await new Promise((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { attemptCount: true, name, runs } });
        worker.on('message', message => message.rows ? resolve(message.rows) : console.log(message.progress));
        worker.on('error', reject);
        worker.on('exit', code => { if (code) reject(new Error('Attempt-count worker failed')); });
      }));
    }
  }));
  measurements.sort((left, right) => left.start - right.start);
  const trialRows = NAMES.flatMap(name => JSON.parse(fs.readFileSync(path.join(archive, 'personal-bots/' + name.replace(/[^A-Za-z]/g, '') + '.json'), 'utf8')).rows);
  const results = [];
  for (const row of measurements) {
    const previous = trialRows.filter(trial => trial.t < row.start), model = fit(previous);
    let remaining = 1;
    const distribution = Array.from({ length: 20 }, (_, index) => {
      const probability = predict(model, { name: row.name, at: (row.loggedFirstAttempt || 1) + index, board: row.board, raw: conditional(row.chain, index + 1) });
      const mass = remaining * probability;
      remaining *= 1 - probability;
      return mass;
    });
    const mostLikely = distribution.indexOf(Math.max(...distribution)) + 1;
    results.push({ ...row, openingPrediction: mostLikely, distribution, beyond20: remaining });
  }
  fs.writeFileSync(path.join(archive, 'personal-bots/attempt-count-data.json'), JSON.stringify(rebuildFeatures({ made: new Date().toISOString(), runs, rows: results })));
  console.log('Saved opening-only exact-attempt dataset:', results.length, 'episodes');
}

if (!isMainThread && workerData?.attemptCount) parentPort.postMessage({ rows: measurePerson(workerData.name, workerData.runs) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { outcomesOf, histories, features };
