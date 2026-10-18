'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { choiceFactory } = require('./personal_context_choice.js');
const { scorePrefix } = require('./personal_recall_coverage.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const read = filename => JSON.parse(fs.readFileSync(path.join(root, filename)));
  const modelFile = 'analysis/archive/personal-bots/personal-recall-models.json', bank = read(modelFile);
  const nativeFile = 'analysis/archive/personal-bots/personal-recall-native.json', native = read(nativeFile);
  assert.equal(hash(fs.readFileSync(path.join(root, modelFile))), native.modelsSha256);
  assert.equal(hash(fs.readFileSync(path.join(root, native.preparedFile))), native.preparedSha256);
  assert.equal(hash(fs.readFileSync(path.join(root, native.baseFile))), native.baseSha256);
  const prepared = read(native.preparedFile), base = read(native.baseFile);
  let futureTrainingPrefixes = 0, blockedCalibrationPrefixes = 0, probabilityDecisions = 0, maximumDifference = 0;
  for (const expected of native.references) {
    const actor = bank.models.find(actor => actor.id === expected.modelId);
    assert(actor && actor.name === expected.name && actor.retryMemoryMode === expected.mode);
    assert.equal(actor.historicalExploratoryOnly, expected.historicalExploratoryOnly);
    const alternate = prepared.alternatives[expected.mode]?.[expected.name].find(game => game.aid === expected.aid);
    const original = base.players[expected.name].find(game => game.aid === expected.aid);
    assert(original); if (alternate) assert.equal(alternate.originalVersionSha256, original.versionSha256);
    const game = alternate || original;
    const diagnostic = bank.ownBlockedCalibration[expected.name][expected.mode];
    if (expected.historicalExploratoryOnly) {
      assert.equal(actor.id, diagnostic.modelId); assert(diagnostic.heldAids.includes(expected.aid));
      assert(!actor.trainedAids.some(aid => diagnostic.excludedAids.includes(aid)));
      blockedCalibrationPrefixes++;
    } else {
      const version = actor.trainedVersions.find(version => version.aid === expected.aid);
      assert(version && version.versionSha256 === expected.versionSha256 && version.availableAt < actor.trainingCut);
      futureTrainingPrefixes++;
    }
    const selector = choiceFactory(actor, { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0);
    for (const row of expected.decisions) {
      const values = selector.probabilities(game.decisions[row.index]);
      assert.equal(values.length, row.probabilities.length);
      assert(values.every(value => Number.isFinite(value) && value >= 0));
      assert(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      for (const [index, value] of values.entries()) {
        const difference = Math.abs(value - row.probabilities[index]);
        maximumDifference = Math.max(maximumDifference, difference); assert(difference < 1e-12);
      }
      probabilityDecisions++;
    }
    const scores = scorePrefix(game, actor); assert.equal(scores.decisions, expected.scores.decisions);
    for (const field of ['jointLogLoss', 'topActionAccuracy']) {
      const difference = Math.abs(scores[field] - expected.scores[field]);
      maximumDifference = Math.max(maximumDifference, difference); assert(difference < 1e-12);
    }
  }
  assert.equal(futureTrainingPrefixes, 1335); assert.equal(blockedCalibrationPrefixes, 240);
  assert.equal(probabilityDecisions, native.probabilityDecisions);
  const sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'own-consistent-recall-static-runtime-parity-only',
    modelsSha256: native.modelsSha256, nativeSha256: hash(fs.readFileSync(path.join(root, nativeFile))), preparedSha256: native.preparedSha256,
    baseSha256: native.baseSha256, futureTrainingPrefixes, blockedCalibrationPrefixes, probabilityDecisions, maximumDifference, sourceHashes,
    note: 'All native vectors and prefix scores match within1e-12, separately retaining own future training and own blocked calibration scopes. '
      + 'No clock/tray controller is borrowed for these changed recall features. This is not autonomous count accuracy or80% prospective evidence.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/recall-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();
