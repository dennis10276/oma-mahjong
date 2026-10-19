'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { jointIntentFactory } = require('./personal_joint_intents_choice.js');
const { attentionFactory, attentionState } = require('./personal_attention_choice.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(variant = 'clipped') {
  assert(['clipped', 'log'].includes(variant));
  const prefix = 'personal-attention' + (variant === 'log' ? '-log' : '');
  const outputPrefix = 'attention' + (variant === 'log' ? '-log' : '');
  const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative)));
  const modelsFile = 'analysis/archive/personal-bots/' + prefix + '-models.json', bank = read(modelsFile);
  assert.equal(bank.variant || 'clipped', variant);
  for (const [relative, expected] of Object.entries(bank.inputHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  for (const [name, expected] of Object.entries({ ...bank.sourceHashes, ...bank.runtimeSourceHashes })) assert.equal(hash(fs.readFileSync(path.join(__dirname, name))), expected);
  const nativeFile = 'analysis/archive/personal-bots/' + prefix + '-native.json', native = read(nativeFile);
  assert.equal(native.modelsSha256, hash(fs.readFileSync(path.join(root, modelsFile))));
  const data = read(bank.dataFile), actors = read(bank.actorFile).models, baseBank = read(bank.baseFile), oldNative = read(bank.baseNativeFile);
  let decisions = 0, maximumDifference = 0, opportunities = 0;
  const compare = (actual, expected) => {
    assert.equal(actual.length, expected.length);
    for (const [index, value] of actual.entries()) {
      const difference = Math.abs(value - expected[index]); maximumDifference = Math.max(maximumDifference, difference);
      assert(difference < 1e-12, 'Attention native/runtime numerical mismatch');
    }
  };
  for (const reference of native.references) {
    const actor = actors.find(value => value.id === reference.modelId && value.name === reference.name);
    const base = baseBank.models.find(value => value.id === actor.id), model = bank.models.find(value => value.id === actor.id);
    const prefix = data.players[reference.name].find(value => value.aid === reference.aid && value.availableAt === reference.availableAt);
    const control = oldNative.references.find(value => value.modelId === actor.id && value.aid === reference.aid && value.availableAt === reference.availableAt);
    const selector = attentionFactory(actor, base, model, 1, !!prefix.initialNewLevel);
    const unchanged = jointIntentFactory(actor, base.clockIntents, base.trayIntents, !!prefix.initialNewLevel);
    const state = attentionState(variant === 'log' ? null : 3);
    for (const expected of reference.decisions) {
      const original = prefix.decisions[expected.index], decision = { ...original,
        knownPlan: original.knownPlan.map((parts, index) => [...parts, ...original.trayPlan[index]]) };
      compare(state.features(decision).map(parts => parts[0]), expected.strengths);
      compare(unchanged.probabilities(decision), control.decisions[expected.index].probabilities);
      compare(selector.probabilities(decision), expected.probabilities);
      selector.observe(decision, decision.k); unchanged.observe(decision, decision.k); state.observe(decision, decision.k);
      for (const phase of ['clock', 'tray']) compare(selector.posterior()[phase], control.decisions[expected.index].posteriorAfter[phase]);
      opportunities += +expected.strengths.some(value => value > 0); decisions++;
    }
  }
  assert.equal(native.references.length, 445); assert.equal(decisions, 39268);
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'personal-attention-native-runtime-parity-only',
    variant, prefixes: 445, decisions, opportunities, maximumDifference, modelsSha256: hash(fs.readFileSync(path.join(root, modelsFile))),
    nativeSha256: hash(fs.readFileSync(path.join(root, nativeFile))), sourceHashes: Object.fromEntries(Object.keys(require.cache)
      .filter(filename => filename.startsWith(root + path.sep)).map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))])),
    note: 'All own training prefixes retain exact base offsets/posteriors and match native attention features and modified probabilities. '
      + 'Action training/numerical parity is not winning-attempt accuracy. Changed attention controllers cannot inherit old temperature count calibration.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/' + outputPrefix + '-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main(process.argv[2]);
