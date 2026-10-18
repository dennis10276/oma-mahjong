'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { reconsiderFactory } = require('./personal_clock_reconsider_choice.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const dataFile = 'analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json';
  const modelFile = 'analysis/archive/personal-bots/personal-clock-reconsider-models.json';
  const reportFile = 'analysis/personal-bots/personal-clock-reconsider-action-evaluation.json';
  const fitted = JSON.parse(fs.readFileSync(path.join(root, modelFile)));
  const expected = JSON.parse(fs.readFileSync(path.join(root, reportFile)));
  const snapshot = path.join(root, expected.reference.snapshot);
  const data = JSON.parse(fs.readFileSync(path.join(snapshot, dataFile)));
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json')));
  assert.equal(hash(fs.readFileSync(path.join(snapshot, 'manifest.json'))), expected.reference.manifestSha256);
  assert.equal(hash(fs.readFileSync(path.join(snapshot, dataFile))), expected.reference.dataSha256);
  assert.equal(manifest.files[dataFile], expected.reference.dataSha256);
  const featureHash = crypto.createHash('sha256');
  for (const file of data.fingerprintFiles) {
    assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
    const local = Object.hasOwn(manifest.files, file);
    const digest = local ? manifest.files[file] : manifest.externalPinnedDependencies?.[file];
    assert(digest && (local || file.includes('/experiments/') || file.includes('/runs/')));
    const bytes = fs.readFileSync(path.join(local ? snapshot : root, file));
    assert.equal(hash(bytes), digest);
    featureHash.update(file).update(bytes);
  }
  assert.equal(featureHash.digest('hex'), data.fingerprint);
  assert.equal(data.fingerprint, expected.reference.featureFingerprint);
  assert.equal(hash(fs.readFileSync(path.join(root, modelFile))), expected.modelsSha256);
  assert.equal(fitted.models.length, 138); assert.equal(expected.actionControlsMatched, 197); assert.equal(expected.targetMet, false);
  for (const [file, digest] of Object.entries(expected.inputHashes)) assert.equal(hash(fs.readFileSync(path.join(root, file))), digest);
  for (const [name, digest] of Object.entries(expected.fitSourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, 'tools/sim/refit', name))), digest);
  const bankPath = Object.keys(expected.inputHashes).find(name => name.endsWith('/physical-memory-policy-bank.json'));
  const requestPath = Object.keys(expected.inputHashes).find(name => name.endsWith('/physical-count-requests.json'));
  assert(bankPath && requestPath);
  const bank = JSON.parse(fs.readFileSync(path.join(root, bankPath))), requests = JSON.parse(fs.readFileSync(path.join(root, requestPath)));
  const actors = new Map(bank.models.map(actor => [actor.id, actor])), models = new Map(fitted.models.map(model => [model.id, model]));
  const fingerprintFiles = [...new Set([modelFile, reportFile,
    ...Object.keys(expected.inputHashes), ...Object.keys(expected.fitSourceHashes).map(name => 'tools/sim/refit/' + name),
    ...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep)).map(file => path.relative(root, file).replace(/\\/g, '/')).sort()])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), players = {};
  let prefixes = 0, probabilityDecisions = 0;
  for (const [name, player] of Object.entries(expected.players)) {
    const totals = { control: { decisions: 0, loss: 0, hits: 0 }, reconsider: { decisions: 0, loss: 0, hits: 0 } };
    for (const row of player.rows) {
      if (!row.scores) continue;
      const actor = actors.get(row.lineage.id), fittedModel = models.get(row.lineage.id), model = fittedModel?.reconsider;
      assert(actor && model && actor.name === name && fittedModel.name === name && fittedModel.scope === 'ownAll');
      assert(model.trainingCut <= row.opening && (model.availableThrough === null || model.availableThrough < row.opening));
      const request = requests.requests.find(request => request.name === name && request.start === row.opening);
      assert(request && !model.trainedAids.some(aid => request.excludedAids.includes(aid)));
      assert.deepEqual(model.trainedAids.slice().sort(), actor.trainedAids.slice().sort());
      assert.deepEqual(model.baseStrategy.trainedAids.slice().sort(), actor.trainedAids.slice().sort());
      const game = data.players[name].find(game => game.aid === row.aid);
      assert(game);
      for (const [method, enabled] of Object.entries({ control: false, reconsider: true })) {
        const choose = reconsiderFactory(actor, model, !!game.initialNewLevel, enabled);
        let decisions = 0, loss = 0, hits = 0;
        for (const decision of game.decisions) {
          if (decision.k < 0) continue;
          const values = choose.probabilities(decision), maximum = Math.max(...values);
          const ties = values.map(value => Math.abs(value - maximum) <= 1e-12 + 1e-8 * Math.abs(maximum));
          loss -= Math.log(Math.max(1e-300, values[decision.k])); hits += +ties[decision.k] / ties.filter(Boolean).length;
          choose.observe(decision, decision.k); decisions++;
        }
        assert.equal(decisions, row.scores[method].decisions);
        for (const [field, value] of Object.entries({ jointLogLoss: loss / decisions, topActionAccuracy: hits / decisions })) {
          assert(Math.abs(value - row.scores[method][field]) < 1e-12, name + '/' + row.aid + '/' + method + '/' + field);
        }
        for (const [field, value] of Object.entries({ decisions, loss, hits })) totals[method][field] += value;
        probabilityDecisions += decisions;
      }
      prefixes++;
    }
    players[name] = Object.fromEntries(Object.entries(totals).map(([method, total]) => [method,
      { decisions: total.decisions, jointLogLoss: total.loss / total.decisions, topActionAccuracy: total.hits / total.decisions }]));
  }
  assert.equal(prefixes, 197); assert.equal(probabilityDecisions, 38028); assert.equal(fingerprintOf(), fingerprint);
  const report = { made: new Date().toISOString(), evidence: 'personal-clock-reconsider-native-javascript-parity', targetMet: false,
    fingerprint, fingerprintFiles, featureFingerprint: data.fingerprint, prefixes, probabilityDecisions, models: fitted.models.length, players,
    note: 'All197 held auxiliary-policy and own-person reconsideration scores match native scoring to1e-12. '
      + 'Selective transfer uses public bad clock proposals and known acceptable immediate pairs; unrelated safe choices remain unchanged. '
      + 'The auxiliary strategy filter uses past choices only; no newly identified latent generative strategy is claimed. '
      + 'Own memberships, pre-campaign availability and target exclusions remain exact. '
      + 'Human action sequences appear only in numerical next-action evaluation, not autonomous prediction. '
      + 'No winning-count improvement, prospective promotion or80% claim is established.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-clock-reconsider-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ prefixes, probabilityDecisions, models: fitted.models.length, players }));
}

if (require.main === module) main();
