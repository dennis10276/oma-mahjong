'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { jointIntentFactory } = require('./personal_joint_intents_choice.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const modelBytes = fs.readFileSync(path.join(archive, 'personal-tray-intents-models.json')), bank = JSON.parse(modelBytes);
  const nativeBytes = fs.readFileSync(path.join(archive, 'personal-joint-intents-native.json')), native = JSON.parse(nativeBytes);
  const dataBytes = fs.readFileSync(path.join(root, native.dataFile)), data = JSON.parse(dataBytes);
  const actorBytes = fs.readFileSync(path.join(root, native.actorFile)), actors = JSON.parse(actorBytes).models;
  assert.equal(hash(modelBytes), native.modelsSha256); assert.equal(hash(dataBytes), native.dataSha256); assert.equal(hash(actorBytes), native.actorSha256);
  let decisions = 0, clockDecisions = 0, maximumDifference = 0;
  for (const reference of native.references) {
    const actor = actors.find(actor => actor.id === reference.modelId), entry = bank.models.find(entry => entry.id === reference.modelId);
    assert(actor && !entry.historicalExploratoryOnly && actor.name === reference.name);
    const game = data.players[reference.name].find(game => game.aid === reference.aid && game.availableAt === reference.availableAt);
    const selector = jointIntentFactory(actor, entry.clockIntents, entry.trayIntents, !!game.initialNewLevel);
    for (const expected of reference.decisions) {
      const original = game.decisions[expected.index];
      const decision = { ...original, knownPlan: original.knownPlan.map((parts, index) => [...parts, ...original.trayPlan[index]]) };
      const actual = selector.probabilities(decision);
      assert.equal(actual.length, expected.probabilities.length);
      assert(Math.abs(actual.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      for (const [index, value] of actual.entries()) {
        const difference = Math.abs(value - expected.probabilities[index]);
        maximumDifference = Math.max(maximumDifference, difference); assert(difference < 1e-12);
      }
      selector.observe(decision, decision.k);
      for (const phase of ['clock', 'tray']) for (const [index, value] of selector.posterior()[phase].entries()) {
        const difference = Math.abs(value - expected.posteriorAfter[phase][index]);
        maximumDifference = Math.max(maximumDifference, difference); assert(difference < 1e-12);
      }
      decisions++; clockDecisions += +(expected.phase === 'clock');
    }
  }
  assert.equal(native.prefixes, 445); assert.equal(decisions, 39268);
  const sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'joint-intent-native-runtime-parity-only', prefixes: native.prefixes,
    decisions, clockDecisions, maximumDifference, modelsSha256: hash(modelBytes), nativeSha256: hash(nativeBytes),
    dataSha256: hash(dataBytes), actorSha256: hash(actorBytes), sourceHashes,
    note: 'All445 training prefixes, combined clock/tray probabilities and both causal posterior vectors match native within1e-12. '
      + 'This is implementation evidence, not whole winning-attempt accuracy, an actual historical forecast or80% success.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/joint-intents-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();
