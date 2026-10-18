'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Hard = require('../../../www/hard.js');
const { recordings } = require('./personal_prefix_data.js');
const root = path.resolve(__dirname, '../../..');

function compareFrame(game, before, after, feature) {
  const actualTray = Math.min(3, after.tray.length);
  const scoredTray = feature.slice(0, 3).findIndex(value => value > 0) + 1;
  const actualKeys = (game.rules?.keys || []).filter(index => before.alive[index] && !after.alive[index]).length;
  const actualClock = game.clock ? +(before.alive[game.clock.i] && !after.alive[game.clock.i]) : 0;
  return { actualTray: after.tray.length, scoredTray, trayDifferent: scoredTray !== actualTray,
    actualKeys, scoredKeys: feature[Hard.POLICY_FEAT.length + Hard.GOAL_FEAT.indexOf('keyTaken')],
    actualClock, scoredClock: feature[Hard.POLICY_FEAT.length + Hard.GOAL_FEAT.indexOf('clockTaken')] };
}

function main() {
  const singleStep = process.argv[2] === 'single';
  if (process.argv[2] && !singleStep) throw new Error('Unknown scoring audit mode');
  const prefixFile = path.join(root, 'analysis/archive/personal-bots/' + (singleStep ? 'policy-single-prefix-data.json' : 'policy-prefix-data.json'));
  const raw = fs.readFileSync(prefixFile), data = JSON.parse(raw);
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of data.fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  if (fingerprintOf() !== data.fingerprint) throw new Error('Scoring audit needs current source-matched physical features');
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  const players = {};
  for (const [name, games] of Object.entries(recordings())) {
    const rows = [], skipped = [], measured = new Map(data.players[name].map(game => [game.aid, game]));
    for (const recorded of games) {
      const prefix = measured.get(recorded.aid);
      if (!prefix || prefix.physicsBoundary || prefix.decisions.length !== recorded.actions.length) {
        skipped.push({ aid: recorded.aid, reason: 'unmatched-physical-choice-sequence' });
        continue;
      }
      for (const [position, action] of recorded.actions.entries()) {
        const decision = prefix.decisions[position], selected = decision.F[decision.k];
        if (!selected || selected[19] || action.kind !== 'take') continue;
        const before = recorded.actions[position - 1] || { alive: recorded.g.faces.map(() => 1), tray: [] };
        rows.push({ lv: recorded.lv, at: recorded.at, aid: recorded.aid, choice: position, moves: action.moves,
          ...compareFrame(recorded.g, before, action, selected) });
      }
    }
    players[name] = { takes: rows.length, trayScoringDifferent: rows.filter(row => row.trayDifferent).length,
      hypotheticalClockCredit: rows.filter(row => row.scoredClock > row.actualClock).length,
      hypotheticalKeyCredit: rows.filter(row => row.scoredKeys > row.actualKeys).length,
      skipped, examples: rows.filter(row => row.trayDifferent || row.scoredClock > row.actualClock || row.scoredKeys > row.actualKeys).slice(-8) };
  }
  if (!raw.equals(fs.readFileSync(prefixFile)) || fingerprintOf() !== data.fingerprint
    || sourceHash !== crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')) throw new Error('Scoring audit inputs changed');
  const report = { made: new Date().toISOString(), evidence: 'single-tap-versus-anticipated-followup-diagnostic',
    physicalSingleStep: !!data.physicalSingleStep,
    prefixFingerprint: data.fingerprint, prefixDataSha256: crypto.createHash('sha256').update(raw).digest('hex'), sourceHash, players,
    note: 'The default score anticipates up to six known tray matches; optional single-step scoring does not. This audit compares the chosen feature state with the actual single-tap result; a difference is not automatically an illegal transition or human mistake. Mandatory physical twins are preserved. It changes no training weights, count scores or numeric forecasts.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/' + (singleStep ? 'physical-single-scoring-audit.json' : 'physical-scoring-audit.json')), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(players).map(([name, player]) => [name,
    { takes: player.takes, trayScoringDifferent: player.trayScoringDifferent, hypotheticalClockCredit: player.hypotheticalClockCredit,
      hypotheticalKeyCredit: player.hypotheticalKeyCredit, skipped: player.skipped.length }])), null, 2));
}

if (require.main === module) main();
module.exports = { compareFrame };
