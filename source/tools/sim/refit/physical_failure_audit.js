'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Hard = require('../../../www/hard.js');
const { NAMES, CONFIG } = require('./personal_model.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const { kindsAt } = require('./kinds.js');
const { PIDS } = require('./mimic_games.js');
const { auditFailure } = require('./failure_audit.js');
const { tasksOf, selectModels, actorOf } = require('./physical_count_data.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');

function summarize(results) {
  const count = results.length;
  const mean = field => count ? results.reduce((sum, result) => sum + result[field], 0) / count : null;
  return { runs: count, endings: Object.fromEntries([...new Set(results.map(result => result.why))].sort()
    .map(why => [why, results.filter(result => result.why === why).length])),
  meanMoves: mean('moves'), meanLeft: mean('left'), meanInspections: mean('inspections'), meanReopens: mean('reopens') };
}

function main() {
  const runs = +(process.argv[2] || 16);
  const experiment = process.argv[3] || 'physical';
  if (!['physical', 'clock'].includes(experiment)) throw new Error('Unknown physical failure audit');
  if (!Number.isInteger(runs) || runs < 2) throw new Error('At least two audit runs required');
  const dataFile = path.join(archive, experiment === 'clock' ? 'physical-clock-count-data.json' : 'physical-count-data.json'), dataRaw = fs.readFileSync(dataFile), data = JSON.parse(dataRaw);
  const digestOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of data.fingerprintFiles) digest.update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  if (digestOf() !== data.fingerprint) throw new Error('Physical-count measurements are stale');
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  const bank = JSON.parse(fs.readFileSync(path.join(archive, 'physical-policy-bank.json'), 'utf8'));
  const held = new Set(data.comparisonEpisodes), tasks = tasksOf().filter(row => held.has(row.name + '|' + row.start));
  const replays = Object.fromEntries(NAMES.map(name => [name, JSON.parse(fs.readFileSync(path.join(root,
    'analysis/archive/replays/' + PIDS[name] + '.json'), 'utf8'))]));
  const rows = tasks.map(row => {
    const models = selectModels(bank, row);
    const personas = { legacyBaseline: { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 12, plan: 10,
      kinds: { ...DEFAULT_KINDS, ...kindsAt(row.name, row.start) },
      w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: CONFIG.care })] },
    physicalAll: actorOf(models.all), physicalNovel: actorOf(models.novel),
    ...Object.fromEntries(Object.entries(data.profiles).filter(([, profile]) => profile.physicalPlan)
      .map(([name, { scope, ...parameters }]) => [name, { ...actorOf(models[scope]), ...parameters }])) };
    const simulations = Object.fromEntries(Object.entries(personas).map(([profile, persona]) => [profile,
      Array.from({ length: runs }, (_, index) => {
        const trace = [], result = Hard.play(row.game, persona, 20261028 * 7919 + index * 104729, trace);
        return { why: result.why, moves: result.moves, left: result.left,
          inspections: trace.filter(item => item.inspection !== undefined).length,
          reopens: trace.filter(item => item.inspection !== undefined && item.known).length };
      })]));
    const recorded = row.excludedAids.map(aid => {
      const chunks = replays[row.name][aid];
      const failure = chunks ? auditFailure(chunks) : null;
      return failure ? { aid, mechanism: failure.mechanism, afterClockCleared: failure.afterClockCleared, exitClass: failure.exitClass } : null;
    }).filter(Boolean);
    return { name: row.name, lv: row.lv, start: row.start, wonOn: row.wonOn, board: row.board,
      assisted: row.assisted, boardChangedWithinCampaign: row.boardChangedWithinCampaign, simulations, recorded };
  });
  if (digestOf() !== data.fingerprint || !dataRaw.equals(fs.readFileSync(dataFile))
    || sourceHash !== crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')) throw new Error('Audit inputs changed');
  const players = Object.fromEntries(NAMES.map(name => {
    const own = rows.filter(row => row.name === name), recorded = own.flatMap(row => row.recorded);
    return [name, { levels: own.length, profiles: Object.fromEntries(Object.keys(own[0]?.simulations || {})
      .map(profile => [profile, summarize(own.flatMap(row => row.simulations[profile]))])),
    recordedFailures: { count: recorded.length, mechanisms: Object.fromEntries(['clock', 'tray', 'unclassified']
      .map(kind => [kind, recorded.filter(row => row.mechanism === kind).length])),
    trayAfterClockCleared: recorded.filter(row => row.mechanism === 'tray' && row.afterClockCleared).length } }];
  }));
  const report = { made: new Date().toISOString(), evidence: 'mechanism-diagnostic', runs, players, rows,
    measurementFingerprint: data.fingerprint, dataSha256: crypto.createHash('sha256').update(dataRaw).digest('hex'), sourceHash,
    note: 'First attempts only; no target trajectories enter simulation policies. Same seeds as count measurement. Recorded failures are a separate incomplete sample of complete unassisted, non-Joker recordings across attempts, not a matched win-rate denominator. First-clear count accuracy and prospective ledgers are unchanged.' };
  fs.writeFileSync(path.join(root, experiment === 'clock' ? 'analysis/personal-bots/physical-clock-failure-audit.json' : 'analysis/personal-bots/physical-failure-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
}

if (require.main === module) main();
module.exports = { summarize };
