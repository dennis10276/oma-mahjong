'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { handoffFactory } = require('./personal_handoff_choice.js');
const { cueOf } = require('./personal_handoff_cues.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const modelBytes = fs.readFileSync(path.join(archive, 'personal-handoff-models.json')), bank = JSON.parse(modelBytes);
  for (const [name, expected] of Object.entries(bank.runtimeSourceHashes)) assert.equal(hash(fs.readFileSync(path.join(__dirname, name))), expected);
  const nativeBytes = fs.readFileSync(path.join(archive, 'personal-handoff-native.json')), native = JSON.parse(nativeBytes);
  const dataBytes = fs.readFileSync(path.join(root, native.dataFile)), data = JSON.parse(dataBytes);
  const baseBytes = fs.readFileSync(path.join(root, native.baseFile)), baseBank = JSON.parse(baseBytes);
  const actorBytes = fs.readFileSync(path.join(root, native.actorFile)), actors = JSON.parse(actorBytes).models;
  assert.equal(hash(modelBytes), native.modelsSha256); assert.equal(hash(dataBytes), native.dataSha256);
  assert.equal(hash(baseBytes), native.baseSha256); assert.equal(hash(actorBytes), native.actorSha256);
  let decisions = 0, cues = 0, maximumDifference = 0;
  for (const reference of native.references) {
    const actor = actors.find(actor => actor.id === reference.modelId), entry = bank.models.find(entry => entry.id === reference.modelId);
    const base = baseBank.models.find(entry => entry.id === reference.modelId);
    assert(actor && !entry.historicalExploratoryOnly && actor.name === reference.name);
    const game = data.players[reference.name].find(game => game.aid === reference.aid && game.availableAt === reference.availableAt);
    const selector = handoffFactory(actor, base, entry.handoff, !!game.initialNewLevel);
    for (const expected of reference.decisions) {
      const original = game.decisions[expected.index];
      const decision = { ...original, knownPlan: original.knownPlan.map((parts, index) => [...parts, ...original.trayPlan[index]]) };
      const cue = cueOf(decision, selector.previous()), actual = selector.probabilities(decision);
      assert.equal(cue?.type || null, expected.cueType); assert.equal(actual.length, expected.probabilities.length);
      assert(actual.every(value => Number.isFinite(value) && value >= 0));
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
      assert.deepEqual(selector.previous(), expected.previousAfter);
      decisions++; cues += +!!cue;
    }
  }
  assert.equal(native.prefixes, 445); assert.equal(decisions, 39268); assert.equal(cues, native.cueOpportunities);
  const sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'personal-handoff-native-runtime-parity-only',
    prefixes: native.prefixes, decisions, cueOpportunities: cues, maximumDifference,
    modelsSha256: hash(modelBytes), nativeSha256: hash(nativeBytes), dataSha256: hash(dataBytes), baseSha256: hash(baseBytes),
    actorSha256: hash(actorBytes), sourceHashes,
    note: 'All445 training prefixes match native probabilities, causal base posteriors and previous-action descriptors within1e-12. '
      + 'This is numerical implementation evidence, not actual pre-opening winning-try accuracy or80% success.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/handoff-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();
