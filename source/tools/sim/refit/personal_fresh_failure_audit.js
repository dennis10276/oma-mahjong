'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { styleAttemptFactory } = require('./personal_outcome_styles_choice.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(argument) {
  assert(argument, 'Supply the completed independent fresh count run');
  const run = path.resolve(argument);
  const manifest = JSON.parse(fs.readFileSync(path.join(run, 'run-manifest.json')));
  const sourceHashes = {};
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    const name = path.relative(root, filename).replace(/\\/g, '/'), actual = hash(fs.readFileSync(filename));
    if (name !== path.relative(root, __filename).replace(/\\/g, '/')) assert.equal(actual, manifest.sourceInputs[name]);
    sourceHashes[name] = actual;
  }
  const input = JSON.parse(fs.readFileSync(path.join(run, 'analysis/archive/personal-bots/personal-fresh-count-input.json')));
  const counts = JSON.parse(fs.readFileSync(path.join(run, 'analysis/archive/personal-bots/physical-fresh-count-data.json')));
  const bank = JSON.parse(fs.readFileSync(path.join(run, input.modelSnapshot, 'analysis/archive/personal-bots/personal-fresh-recent-models.json')));
  const rows = [];
  for (const entry of input.recent.filter(row => row.name === 'Dennisisdebeste')) {
    const actor = bank.models.find(model => model.id === entry.modelId), game = decodeGame(entry.game);
    const measured = counts.rows.find(row => row.name === entry.name && row.start === entry.start);
    for (const [profile, enabled] of Object.entries({ ownOutcomeBase0: false, ownOutcomeStyles0: true })) {
      const factory = styleAttemptFactory(actor, actor.outcomeStyles, true, enabled), outcomes = [];
      for (let index = 0; index < 32; index++) {
        const seed = 20261028 * 7919 + index * 104729;
        const physicalChoice = factory(Object.freeze({ run: index, attempt: 1, seed, previousFailure: null }));
        const result = Hard.play({ ...game, memory: null, avoidMoves: new Map() },
          { ...physicalActor(actor), physicalPlan: 0, physicalChoice }, seed, []);
        outcomes.push({ win: result.win, why: result.why, left: result.left, moves: result.moves, tray: result.tray.length });
      }
      assert.equal(outcomes.filter(result => result.win).length / 32, measured.chains[profile].first);
      rows.push({ name: entry.name, lv: entry.lv, start: entry.start, profile, actualWonOn: entry.wonOn, outcomes });
    }
  }
  const profiles = Object.fromEntries(['ownOutcomeBase0', 'ownOutcomeStyles0'].map(profile => {
    const results = rows.filter(row => row.profile === profile).flatMap(row => row.outcomes);
    const failures = results.filter(result => !result.win);
    return [profile, { runs: results.length, wins: results.length - failures.length,
      failureReasons: Object.fromEntries([...new Set(failures.map(result => result.why))].map(reason => [reason, failures.filter(result => result.why === reason).length])),
      averageRemainingAtFailure: failures.reduce((sum, result) => sum + result.left, 0) / failures.length,
      lossesWithSixOrFewerRemaining: failures.filter(result => result.left <= 6).length }];
  }));
  const report = { made: new Date().toISOString(), evidence: 'historical-exploratory-first-attempt-failure-diagnosis', targetMet: false,
    sourceHashes, countDataSha256: hash(fs.readFileSync(path.join(run, 'analysis/archive/personal-bots/physical-fresh-count-data.json'))),
    reproducedFirstAttemptRates: rows.length, profiles, rows,
    note: 'Reproduces the exact first32 initial seeds of each recent Dennis profile, not a new selected accuracy test. '
      + 'Failure causes diagnose deficient whole trajectories despite improved local action likelihood. '
      + 'No hidden-board solver, forced greedy matching, count-head retuning or relabelling of human wins is introduced.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/fresh-first-attempt-failure-audit.json'), JSON.stringify(report));
  console.log(JSON.stringify({ reproducedFirstAttemptRates: rows.length, profiles }, null, 2));
}

if (require.main === module) main(process.argv[2]);
