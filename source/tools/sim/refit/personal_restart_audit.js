'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Hard = require('../../../www/hard.js');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { handoffOf, matchesState } = require('./physical_handoff_audit.js');
const { selectModels, actorOf } = require('./physical_count_data.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');
const pinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-memory-2026-10-18T00-43-24-647Z');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function summarize(rows) {
  return Object.fromEntries(Object.keys(PIDS).map(name => {
    const own = rows.filter(row => row.name === name), measured = own.filter(row => row.status === 'measured-human-state');
    return [name, { naturalRestarts: own.length, measured: measured.length,
      unsupported: own.filter(row => row.status !== 'measured-human-state').map(row => ({ aid: row.aid, reason: row.status })),
      observedMeanMoves: own.length ? own.reduce((sum, row) => sum + row.moves, 0) / own.length : null,
      profiles: Object.fromEntries(['ownAll', 'ownAllPlan8'].map(profile => {
        const samples = measured.flatMap(row => row.simulations[profile]);
        return [profile, { runs: samples.length, wins: samples.filter(sample => sample.win).length,
          clock: samples.filter(sample => sample.why === 'clock').length,
          tray: samples.filter(sample => sample.why === 'tray').length,
          successFraction: samples.length ? samples.filter(sample => sample.win).length / samples.length : null }];
      })) }];
  }));
}

function main() {
  const runs = +(process.argv[2] || 16);
  if (!Number.isInteger(runs) || runs < 2) throw new Error('At least two restart diagnostic runs required');
  const manifest = JSON.parse(fs.readFileSync(path.join(pinned, 'manifest.json')));
  const bankFile = 'analysis/archive/personal-bots/physical-memory-policy-bank.json', requestFile = 'analysis/archive/personal-bots/physical-count-requests.json';
  const bankRaw = fs.readFileSync(path.join(pinned, bankFile)), requestsRaw = fs.readFileSync(path.join(pinned, requestFile));
  if (hash(bankRaw) !== manifest.files[bankFile] || hash(requestsRaw) !== manifest.files[requestFile]) throw new Error('Pinned restart diagnostic actors changed');
  const bank = JSON.parse(bankRaw), requests = JSON.parse(requestsRaw).requests;
  const fingerprintFiles = ['www/hard.js', 'www/layouts.js',
    ...['personal_restart_audit.js', 'personal_prefix_data.js', 'physical_handoff_audit.js', 'physical_count_data.js',
      'mimic_games.js', 'personal_model.js', 'personal_retry_memory.js', 'attempt_campaigns.js'].map(file => 'tools/sim/refit/' + file),
    'analysis/archive/realdata/plays.json', ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json')];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), rows = [];
  for (const [name, games] of Object.entries(recordings())) for (const recorded of games) {
    if (recorded.stopReason !== 'end' || recorded.ending !== 'restart') continue;
    const base = { name, aid: recorded.aid, level: recorded.lv, moves: recorded.physicalRemovals,
      choices: recorded.manualChoices, initialNewLevel: recorded.initialNewLevel, availableAt: recorded.availableAt };
    if (recorded.g.faces.some(face => face >= 100)) { rows.push({ ...base, status: 'unsupported-wildcard-handoff' }); continue; }
    const request = requests.find(row => row.name === name && row.excludedAids.includes(recorded.aid));
    if (!request) { rows.push({ ...base, status: 'no-campaign-model' }); continue; }
    const rebuilt = reconstruct(recorded);
    if (!rebuilt || rebuilt.prefix.stopReason !== 'end' || rebuilt.prefix.ending !== 'restart') {
      rows.push({ ...base, status: 'unvalidated-natural-restart' }); continue;
    }
    const models = selectModels(bank, request), actor = actorOf(models.ownAll);
    const game = handoffOf(recorded, recorded.actions.length), expected = recorded.actions.at(-1);
    const validation = Hard.play({ ...game, follow: [] }, actor, 1);
    if (!matchesState(game, validation, expected)) {
      rows.push({ ...base, status: 'unsupported-physical-handoff', expectedMoves: expected?.moves || 0, actualMoves: validation.moves });
      continue;
    }
    const simulations = Object.fromEntries(Object.entries({ ownAll: actor, ownAllPlan8: { ...actor, physicalPlan: 8 } }).map(([profile, persona]) => [profile,
      Array.from({ length: runs }, (unused, sample) => {
        const result = Hard.play({ ...game, physicalLog: [] }, persona, 20261028 * 7919 + sample * 104729);
        return { win: result.win, why: result.why, moves: result.moves, left: result.left };
      })]));
    rows.push({ ...base, moves: validation.moves, status: 'measured-human-state', opening: request.start,
      observedTray: validation.tray, observedLeft: validation.left,
      actor: { id: models.ownAll.id, trainingCut: models.ownAll.trainingCut, availableThrough: models.ownAll.availableThrough }, simulations });
  }
  if (fingerprintOf() !== fingerprint) throw new Error('Restart diagnostic sources changed during measurement');
  const report = { made: new Date().toISOString(), evidence: 'human-restart-state-diagnostic-only', targetMet: false,
    runs, fingerprint, fingerprintFiles, pinnedActorBankSha256: hash(bankRaw), pinnedRequestsSha256: hash(requestsRaw),
    players: summarize(rows), rows,
    note: 'Voluntary natural restarts are observed failures, not missing data or automatic bot restarts. Human prefix states are supplied only to diagnose the missing restart behavior; this is not autonomous prediction, counterfactual human success, training data or winning-try accuracy. Older personal actors exclude the entire target campaign. Every observed restart remains in the denominator; unsupported wildcard/physical states and missing models are explicit. All original count cohorts and frozen numeric forecasts are unchanged.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-restart-state-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.players, null, 2));
}

if (require.main === module) main();
module.exports = { summarize };
