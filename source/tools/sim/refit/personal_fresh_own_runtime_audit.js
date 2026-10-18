'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { styleEvaluator, scoreStyles, styleAttemptFactory } = require('./personal_outcome_styles_choice.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const expectedFile = 'analysis/personal-bots/personal-fresh-own-native-bridge.json';
  const expected = JSON.parse(fs.readFileSync(path.join(root, expectedFile)));
  assert.equal(expected.targetMet, false);
  for (const [name, digest] of Object.entries(expected.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(__dirname, name))), digest);
  for (const [name, digest] of Object.entries(expected.inputHashes)) assert.equal(hash(fs.readFileSync(path.join(root, name))), digest);
  const fitted = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/personal-bots/personal-fresh-own-models.json')));
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/personal-bots/personal-prefix-versions.json')));
  const actors = new Map(fitted.models.map(actor => [actor.name, actor]));
  const fingerprintFiles = [...new Set([expectedFile, ...Object.keys(expected.inputHashes),
    ...Object.keys(expected.sourceHashes).map(name => 'tools/sim/refit/' + name),
    ...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep)).map(file => path.relative(root, file).replace(/\\/g, '/'))])].sort();
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const name of fingerprintFiles) digest.update(name).update(fs.readFileSync(path.join(root, name)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf();
  let prefixes = 0, probabilityDecisions = 0;
  for (const [name, player] of Object.entries(expected.players)) {
    const actor = actors.get(name); assert(actor && actor.id === player.id);
    const evaluator = styleEvaluator(actor, actor.outcomeStyles), factory = styleAttemptFactory(actor, actor.outcomeStyles);
    assert.notEqual(factory({ run: 0, attempt: 1, seed: 123 }), factory({ run: 0, attempt: 1, seed: 123 }));
    for (const row of player.rows) {
      const game = bank.players[name].find(game => game.aid === row.aid && game.versionSha256 === row.versionSha256);
      assert(game && game.availableAt < fitted.requestTime && game.observedAt < fitted.requestTime);
      for (const [method, enabled] of Object.entries({ control: false, outcomeStyles: true })) {
        const score = scoreStyles(game, evaluator, actor.outcomeStyles.priors, enabled), original = row.scores[method];
        assert.equal(score.decisions, original.decisions);
        for (const field of ['jointLogLoss', 'topActionAccuracy']) assert(Math.abs(score[field] - original[field]) < 1e-12,
          name + '/' + row.aid + '/' + method + '/' + field);
        score.posterior.forEach((value, index) => assert(Math.abs(value - original.posterior[index]) < 1e-12));
        probabilityDecisions += score.decisions;
      }
      prefixes++;
    }
  }
  assert.equal(prefixes, expected.prefixes); assert.equal(probabilityDecisions, expected.probabilityDecisions);
  assert.equal(actors.size, 4); assert.equal(fingerprintOf(), fingerprint);
  const report = { made: new Date().toISOString(), evidence: 'fresh-personal-native-javascript-parity-only', targetMet: false,
    fingerprint, fingerprintFiles, prefixes, probabilityDecisions, models: 4,
    note: 'All current own-person fitting-prefix numerical scores and forward posteriors match native scoring to1e-12. '
      + 'Each attempt gets a fresh seed-stable style selector. Saved source observation and prefix-version membership are checked. '
      + 'This is runtime parity on training data, not held action accuracy, an autonomous count score or prospective80% success.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-fresh-own-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ prefixes, probabilityDecisions, models: 4 }));
}

if (require.main === module) main();
