'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { knownPlanFactory } = require('./personal_known_plan_choice.js');
const { referenceData } = require('./known_plan_reference.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const dataFile = 'analysis/archive/personal-bots/policy-known-plan-prefix-data.json';
  const modelFile = 'analysis/archive/personal-bots/personal-known-plan-models.json';
  const reportFile = 'analysis/personal-bots/personal-known-plan-action-evaluation.json';
  const { data, referenceFiles, referenceFeatureFingerprint } = referenceData();
  const fitted = JSON.parse(fs.readFileSync(path.join(root, modelFile)));
  const expected = JSON.parse(fs.readFileSync(path.join(root, reportFile)));
  assert.equal(hash(fs.readFileSync(path.join(root, dataFile))), expected.dataSha256);
  assert.equal(hash(fs.readFileSync(path.join(root, modelFile))), expected.modelsSha256);
  assert.equal(fitted.models.length, 138); assert.equal(data.prefixes, 398); assert.equal(data.totals.calls, 33543);
  assert.equal(data.pilot, false); assert.equal(expected.targetMet, false);
  const bitsFile = 'analysis/personal-bots/personal-known-plan-bits-runtime-audit.json';
  const bits = JSON.parse(fs.readFileSync(path.join(root, bitsFile))), bitsHash = crypto.createHash('sha256');
  for (const filename of bits.fingerprintFiles) bitsHash.update(filename).update(fs.readFileSync(path.join(root, filename)));
  assert.equal(bitsHash.digest('hex'), bits.fingerprint);
  assert.equal(bits.prefixes, 398); assert.equal(bits.totals.calls, 33543);
  assert.equal(bits.totals.nodes, data.totals.nodes); assert.equal(bits.totals.boundaries, data.totals.boundaries);
  assert.equal(bits.dataSha256, expected.dataSha256);
  for (const [file, digest] of Object.entries(expected.inputHashes)) assert.equal(hash(fs.readFileSync(path.join(root, file))), digest);
  for (const [name, digest] of Object.entries(expected.fitSourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, 'tools/sim/refit', name))), digest);
  const bankPath = Object.keys(expected.inputHashes).find(name => name.endsWith('/physical-memory-policy-bank.json'));
  const requestPath = Object.keys(expected.inputHashes).find(name => name.endsWith('/physical-count-requests.json'));
  assert(bankPath && requestPath);
  const bank = JSON.parse(fs.readFileSync(path.join(root, bankPath))), requests = JSON.parse(fs.readFileSync(path.join(root, requestPath)));
  const actors = new Map(bank.models.map(actor => [actor.id, actor])), models = new Map(fitted.models.map(model => [model.id, model]));
  const fingerprintFiles = [...new Set([...data.fingerprintFiles, ...referenceFiles, ...bits.fingerprintFiles, bitsFile, dataFile, modelFile, reportFile,
    ...Object.keys(expected.inputHashes), ...Object.keys(expected.fitSourceHashes).map(name => 'tools/sim/refit/' + name),
    ...['personal_known_plan_runtime_audit.js', 'personal_known_plan_choice.js', 'known_tray_plan_cache.js', 'personal_context_choice.js',
      'known_plan_reference.js', 'known_tray_plan_bits.js'].map(name => 'tools/sim/refit/' + name)])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), players = {};
  let prefixes = 0, probabilityDecisions = 0;
  for (const [name, player] of Object.entries(expected.players)) {
    const totals = { control: { decisions: 0, loss: 0, hits: 0 }, knownPlan: { decisions: 0, loss: 0, hits: 0 } };
    for (const row of player.rows) {
      if (!row.scores) continue;
      const actor = actors.get(row.lineage.id), fitted = models.get(row.lineage.id), model = fitted?.knownPlan;
      assert(actor && fitted && model && actor.name === name && fitted.name === name && fitted.scope === 'ownAll');
      assert(model.trainingCut <= row.opening && (model.availableThrough === null || model.availableThrough < row.opening));
      const request = requests.requests.find(request => request.name === name && request.start === row.opening);
      assert(request && !model.trainedAids.some(aid => request.excludedAids.includes(aid)));
      assert.deepEqual(model.trainedAids.slice().sort(), actor.trainedAids.slice().sort());
      const game = data.players[name].find(game => game.aid === row.aid);
      assert(game);
      for (const [method, scale] of Object.entries({ control: 0, knownPlan: 1 })) {
        const choose = knownPlanFactory(actor, model, scale);
        let decisions = 0, loss = 0, hits = 0;
        for (const decision of game.decisions) {
          if (decision.k < 0) continue;
          const values = choose.probabilities(decision), maximum = Math.max(...values);
          const ties = values.map(value => Math.abs(value - maximum) <= 1e-12 + 1e-8 * Math.abs(maximum));
          loss -= Math.log(Math.max(1e-300, values[decision.k]));
          hits += +ties[decision.k] / ties.filter(Boolean).length;
          decisions++;
        }
        const actual = { decisions, jointLogLoss: decisions ? loss / decisions : null, topActionAccuracy: decisions ? hits / decisions : null };
        assert.equal(actual.decisions, row.scores[method].decisions);
        for (const field of ['jointLogLoss', 'topActionAccuracy']) assert(Math.abs(actual[field] - row.scores[method][field]) < 1e-12,
          name + '/' + row.aid + '/' + method + '/' + field);
        for (const [field, value] of Object.entries({ decisions, loss, hits })) totals[method][field] += value;
        probabilityDecisions += decisions;
      }
      prefixes++;
    }
    players[name] = Object.fromEntries(Object.entries(totals).map(([method, total]) => [method,
      { decisions: total.decisions, jointLogLoss: total.loss / total.decisions, topActionAccuracy: total.hits / total.decisions }]));
  }
  assert.equal(prefixes, 197); assert.equal(probabilityDecisions, 38028);
  assert.equal(fingerprintOf(), fingerprint);
  const report = { made: new Date().toISOString(), evidence: 'known-plan-native-javascript-probability-parity', targetMet: false,
    fingerprint, fingerprintFiles, referenceFeatureFingerprint, optimizedFeatureProofSha256: hash(fs.readFileSync(path.join(root, bitsFile))),
    prefixes, probabilityDecisions, models: fitted.models.length, players,
    note: 'All held initial/retry action-control and personal known-plan likelihoods match frozen Python outputs to1e-12. '
      + 'Own-person membership, pre-campaign availability and target exclusions remain exact. '
      + 'This audit supplies observed human feature sequences only for numerical parity, never autonomous winning-try prediction. '
      + 'Full generation separately preserved all398/33,543 physical/feature controls; cached inference is exact public-state memoization, not learned hidden knowledge. '
      + 'No winning-count improvement or future80% success is established.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-known-plan-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

if (require.main === module) main();
