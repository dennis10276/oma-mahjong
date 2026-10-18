'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { gamesOf, PIDS } = require('./mimic_games.js');
const { NAMES, CONFIG } = require('./personal_model.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const Hard = require('../../../www/hard.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const HORIZONS = [0, 4, 8, 10, 14];

function clockPlanAt(rows, name, cutoff) {
  const names = [...new Set([...NAMES, ...rows.map(row => row.name)])];
  const totals = Object.fromEntries(names.map(person => {
    const before = rows.filter(row => row.name === person && row.availableAt < cutoff).sort((left, right) => left.availableAt - right.availableAt);
    const losses = HORIZONS.map(() => 0);
    let count = 0;
    for (const [age, row] of before.slice().reverse().entries()) {
      const weight = 0.5 ** (age / 20);
      count += weight;
      row.probabilities.forEach((probability, index) => {
        const clipped = Math.max(1e-6, Math.min(1 - 1e-6, probability));
        losses[index] -= weight * Math.log(row.clockFailed ? clipped : 1 - clipped);
      });
    }
    return [person, { games: before.length, count, losses, availableThrough: before.at(-1)?.availableAt ?? null }];
  }));
  const own = totals[name];
  if (!own) throw new Error('Unknown clock persona: ' + name);
  const family = Object.entries(totals).filter(([person, value]) => person !== name && value.count > 0);
  const loss = HORIZONS.map((horizon, index) => own.losses[index] + (family.length ? 2 * family.reduce((sum, [, value]) => sum + value.losses[index] / value.count, 0) / family.length : 0));
  let selected = HORIZONS.indexOf(10);
  for (let index = 0; index < HORIZONS.length; index++) if (loss[index] < loss[selected] - 1e-12) selected = index;
  return { horizon: HORIZONS[selected], ownGames: own.games, ownAvailableThrough: own.availableThrough,
    familyAvailableThrough: Math.max(0, ...family.map(([, value]) => value.availableThrough || 0)), cutoff,
    scores: Object.fromEntries(HORIZONS.map((horizon, index) => [horizon, loss[index]])),
    available: own.games > 0 || family.length > 0 };
}

function measure(tasks, runs) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/personal-kind-policy.json'), 'utf8'));
  return tasks.map(({ game, ...row }, position) => {
    const fitted = policy.players[row.name];
    const persona = { ...Hard.P, w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 })], allMoves: true,
      flips: true, kinds: { ...DEFAULT_KINDS, ...kindsAt(row.name, row.t) }, peek: 0, end: 12, memory: CONFIG.memory,
      ...(fitted.trainingCut <= row.t ? { kindModel: fitted.model } : {}) };
    const probabilities = HORIZONS.map(plan => {
      let clocks = 0;
      for (let sample = 0; sample < runs; sample++) if (Hard.play(game, { ...persona, plan }, 20261024 * 7919 + sample * 104729).why === 'clock') clocks++;
      return (clocks + 0.5) / (runs + 1);
    });
    if ((position + 1) % 5 === 0) parentPort.postMessage({ progress: 'Clock worker ' + workerData.index + ': ' + (position + 1) + '/' + tasks.length });
    return { ...row, probabilities };
  });
}

function diagnostic(data) {
  const players = {};
  for (const name of NAMES) {
    const own = data.rows.filter(row => row.name === name).sort((left, right) => left.t - right.t);
    if (!own.length) { players[name] = { recordedClockGames: 0 }; continue; }
    const cutoff = own[Math.floor(own.length * 0.75)].t, fitted = clockPlanAt(data.rows, name, cutoff);
    const testing = own.filter(row => row.t >= cutoff);
    const score = horizon => {
      let loss = 0;
      for (const row of testing) {
        const probability = row.probabilities[HORIZONS.indexOf(horizon)];
        loss -= Math.log(row.clockFailed ? probability : 1 - probability);
      }
      return { games: testing.length, clockFailures: testing.filter(row => row.clockFailed).length, binaryLogLoss: testing.length ? loss / testing.length : null };
    };
    players[name] = { recordedClockGames: own.length, fitted, baseline: score(10), personal: score(fitted.horizon) };
  }
  return { made: new Date().toISOString(), measurementFingerprint: data.fingerprint, runs: data.runs, horizons: HORIZONS, players,
    note: 'Historical clock-cause diagnostic, not winning-attempt accuracy. Planning onset is fitted from strictly earlier available complete unassisted regular recordings, with twenty-game decay and a two-observation equal-person family prior. The default ten-move planner wins ties. Simulations start without prior-retry picture memory; this is a mechanism diagnostic, not a complete retry fit.' };
}

async function main() {
  const runs = +(process.argv[2] || 64), plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'), 'utf8'));
  const tasks = NAMES.flatMap(name => {
    const ends = new Map(Object.values(plays[PIDS[name]] || {}).filter(event => event.k === 'end' && event.m !== 'd' && !event.tk).map(event => [event.aid, event]));
    return gamesOf(name).filter(game => game.g.clock && game.g.faces.every(face => face < 100) && ends.has(game.aid))
      .map(game => ({ name, aid: game.aid, lv: game.lv, t: game.t, availableAt: game.availableAt, clockFailed: !!ends.get(game.aid).ck, game: game.g }));
  });
  const fingerprintFiles = ['www/hard.js', 'www/layouts.js', 'tools/sim/refit/personal_clock_plan.js', 'tools/sim/refit/mimic_games.js',
    'tools/sim/refit/kinds.js', 'tools/sim/refit/personal_model.js', 'tools/sim/refit/personal_policy_prior.js',
    'analysis/personal-bots/personal-kind-policy.json', 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...NAMES.map(name => 'tools/sim/refit/mimic/' + (name === 'Mrs. Doubtfire' ? 'Mrs_Doubtfire' : name) + '.json')];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const filename of fingerprintFiles) digest.update(fs.readFileSync(path.join(root, filename)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf();
  const batches = await Promise.all(Array.from({ length: 3 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { clockPlan: true, index, runs, tasks: tasks.filter((task, position) => position % 3 === index) } });
    worker.on('message', message => message.rows ? resolve(message.rows) : console.log(message.progress));
    worker.on('error', reject);
    worker.on('exit', code => { if (code) reject(new Error('Clock worker failed')); });
  })));
  if (fingerprintOf() !== fingerprint) throw new Error('Clock-measurement inputs changed while workers ran');
  const data = { measuredAt: new Date().toISOString(), runs, fingerprintFiles, fingerprint, horizons: HORIZONS,
    rows: batches.flat().sort((left, right) => left.t - right.t) };
  fs.writeFileSync(path.join(archive, 'clock-plan-data.json'), JSON.stringify(data));
  const report = diagnostic(data);
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-clock-plan.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (!isMainThread && workerData?.clockPlan) parentPort.postMessage({ rows: measure(workerData.tasks, workerData.runs) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { HORIZONS, clockPlanAt, diagnostic };
