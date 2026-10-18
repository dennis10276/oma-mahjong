'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { intentFactory } = require('./personal_clock_intents_choice.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const modelBytes = fs.readFileSync(path.join(archive, 'personal-clock-intents-models.json')), bank = JSON.parse(modelBytes);
  const nativeBytes = fs.readFileSync(path.join(archive, 'personal-clock-intents-native.json')), native = JSON.parse(nativeBytes);
  const dataBytes = fs.readFileSync(path.join(root, native.dataFile)), data = JSON.parse(dataBytes);
  const actorBytes = fs.readFileSync(path.join(root, native.actorFile)), actors = JSON.parse(actorBytes).models;
  assert.equal(hash(modelBytes), native.modelsSha256); assert.equal(hash(dataBytes), native.dataSha256);
  assert.equal(hash(actorBytes), native.actorSha256);
  let decisions = 0, clockDecisions = 0, maximumDifference = 0;
  for (const reference of native.references) {
    const actor = actors.find(actor => actor.id === reference.modelId), entry = bank.models.find(entry => entry.id === reference.modelId);
    assert(actor && !entry.historicalExploratoryOnly && actor.name === reference.name);
    const game = data.players[reference.name].find(game => game.aid === reference.aid && game.availableAt === reference.availableAt);
    const selector = intentFactory(actor, entry.clockIntents, !!game.initialNewLevel);
    for (const expected of reference.decisions) {
      const decision = game.decisions[expected.index], actual = selector.probabilities(decision);
      assert.equal(actual.length, expected.probabilities.length);
      assert(Math.abs(actual.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      for (const [index, value] of actual.entries()) {
        const difference = Math.abs(value - expected.probabilities[index]);
        maximumDifference = Math.max(maximumDifference, difference); assert(difference < 1e-12);
      }
      selector.observe(decision, decision.k);
      for (const [index, value] of selector.posterior().entries()) {
        const difference = Math.abs(value - expected.posteriorAfter[index]);
        maximumDifference = Math.max(maximumDifference, difference); assert(difference < 1e-12);
      }
      decisions++; clockDecisions += +decision.knownPlan.some(parts => parts.some(value => value !== 0));
    }
  }
  assert.equal(native.prefixes, 445); assert.equal(decisions, 39268);
  const sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'persistent-clock-intent-native-runtime-parity-only',
    prefixes: native.prefixes, decisions, clockDecisions, maximumDifference, modelsSha256: hash(modelBytes), nativeSha256: hash(nativeBytes),
    dataSha256: hash(dataBytes), actorSha256: hash(actorBytes), sourceHashes,
    note: 'Causal probability/posterior parity on all training prefixes. No future target actions enter autonomous intent state. '
      + 'This is not held winning-attempt accuracy and does not establish80% success.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/clock-intents-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();
