'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { strategyFactory } = require('./personal_clock_strategy_choice.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const dataBytes = fs.readFileSync(path.join(archive, 'personal-fresh-clock-prefixes.json'));
  const modelBytes = fs.readFileSync(path.join(archive, 'personal-fresh-clock-models.json'));
  const data = JSON.parse(dataBytes), bank = JSON.parse(modelBytes);
  const nativeBytes = fs.readFileSync(path.join(archive, 'personal-fresh-clock-native.json'));
  const native = JSON.parse(nativeBytes);
  assert.equal(native.dataSha256, hash(dataBytes)); assert.equal(native.modelsSha256, hash(modelBytes));
  const fits = path.join(archive, 'experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z');
  const actors = JSON.parse(fs.readFileSync(path.join(fits, 'analysis/archive/personal-bots/personal-fresh-own-models.json'))).models;
  let decisions = 0, clockDecisions = 0, maximumDifference = 0;
  for (const reference of native.references) {
    const actor = actors.find(actor => actor.id === reference.modelId);
    const entry = bank.models.find(model => model.id === reference.modelId);
    assert(actor && !entry.historicalExploratoryOnly && actor.name === reference.name);
    const game = data.players[reference.name].find(game => game.aid === reference.aid && game.availableAt === reference.availableAt);
    const selector = strategyFactory(actor, entry.clockStrategy, !!game.initialNewLevel);
    for (const expected of reference.decisions) {
      const decision = game.decisions[expected.index], actual = selector.probabilities(decision);
      assert.equal(actual.length, expected.probabilities.length);
      assert(Math.abs(actual.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      for (const [index, probability] of actual.entries()) {
        const difference = Math.abs(probability - expected.probabilities[index]);
        maximumDifference = Math.max(maximumDifference, difference); assert(difference < 1e-12);
      }
      selector.observe(decision, decision.k);
      for (const [index, probability] of selector.posterior().entries()) {
        const difference = Math.abs(probability - expected.posteriorAfter[index]);
        maximumDifference = Math.max(maximumDifference, difference); assert(difference < 1e-12);
      }
      decisions++; clockDecisions += +decision.knownPlan.some(parts => parts.some(value => value !== 0));
    }
  }
  assert.equal(native.prefixes, 445); assert.equal(native.decisions, decisions);
  const sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'fresh-clock-native-runtime-parity-only',
    prefixes: native.prefixes, decisions, clockDecisions, maximumDifference, dataSha256: hash(dataBytes), modelsSha256: hash(modelBytes),
    nativeSha256: hash(nativeBytes), sourceHashes,
    note: 'All445 training prefixes use causal runtime updates and match native probabilities/posteriors within1e-12. '
      + 'This verifies implementation, not winning-count accuracy, availability of historical forecasts or80% success.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/fresh-clock-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();
