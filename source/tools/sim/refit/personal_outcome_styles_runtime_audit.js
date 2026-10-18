'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { styleEvaluator, scoreStyles } = require('./personal_outcome_styles_choice.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const modelFile = 'analysis/archive/personal-bots/personal-outcome-styles-models.json';
  const reportFile = 'analysis/personal-bots/personal-outcome-styles-action-evaluation.json';
  const expected = JSON.parse(fs.readFileSync(path.join(root, reportFile)));
  const fitted = JSON.parse(fs.readFileSync(path.join(root, modelFile)));
  const dataFile = 'analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json';
  const snapshot = path.join(root, expected.reference.snapshot);
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json')));
  const data = JSON.parse(fs.readFileSync(path.join(snapshot, dataFile)));
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
  const fingerprintFiles = [...new Set([modelFile, reportFile, ...Object.keys(expected.inputHashes),
    ...Object.keys(expected.fitSourceHashes).map(name => 'tools/sim/refit/' + name),
    ...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep)).map(file => path.relative(root, file).replace(/\\/g, '/'))])].sort();
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), players = {};
  let prefixes = 0, probabilityDecisions = 0;
  for (const [name, player] of Object.entries(expected.players)) {
    const totals = { control: { decisions: 0, loss: 0, hits: 0 }, outcomeStyles: { decisions: 0, loss: 0, hits: 0 } };
    for (const row of player.rows) {
      if (!row.scores) continue;
      const actor = actors.get(row.lineage.id), fittedModel = models.get(row.lineage.id), model = fittedModel?.outcomeStyles;
      assert(actor && model && actor.name === name && fittedModel.name === name && fittedModel.scope === 'ownAll');
      assert(model.trainingCut <= row.opening && (model.availableThrough === null || model.availableThrough < row.opening));
      const request = requests.requests.find(request => request.name === name && request.start === row.opening);
      assert(request && !model.trainedAids.some(aid => request.excludedAids.includes(aid)));
      assert.deepEqual(model.trainedAids.slice().sort(), actor.trainedAids.slice().sort());
      assert(model.labelledGames.every(game => game.availableAt < model.trainingCut && model.trainedAids.includes(game.aid)));
      const game = data.players[name].find(game => game.aid === row.aid);
      assert(game);
      const evaluator = styleEvaluator(actor, model);
      for (const [method, enabled] of Object.entries({ control: false, outcomeStyles: true })) {
        const score = scoreStyles(game, evaluator, model.priors, enabled), original = row.scores[method];
        assert.equal(score.decisions, original.decisions);
        for (const field of ['jointLogLoss', 'topActionAccuracy']) assert(Math.abs(score[field] - original[field]) < 1e-12,
          name + '/' + row.aid + '/' + method + '/' + field);
        score.posterior.forEach((value, index) => assert(Math.abs(value - original.posterior[index]) < 1e-12));
        const total = totals[method];
        total.decisions += score.decisions; total.loss += score.jointLogLoss * score.decisions; total.hits += score.topActionAccuracy * score.decisions;
        probabilityDecisions += score.decisions;
      }
      prefixes++;
    }
    players[name] = Object.fromEntries(Object.entries(totals).map(([method, total]) => [method,
      { decisions: total.decisions, jointLogLoss: total.loss / total.decisions, topActionAccuracy: total.hits / total.decisions }]));
  }
  assert.equal(prefixes, 197); assert.equal(probabilityDecisions, 38028); assert.equal(fingerprintOf(), fingerprint);
  const report = { made: new Date().toISOString(), evidence: 'personal-outcome-styles-native-javascript-parity', targetMet: false,
    fingerprint, fingerprintFiles, featureFingerprint: data.fingerprint, prefixes, probabilityDecisions, models: fitted.models.length, players,
    note: 'All197 held static-policy and own-outcome-style scores/posteriors match native scoring to1e-12. '
      + 'Past own outcomes anchor training experts; target outcomes never select the current expert. '
      + 'Numerical scoring filters from already observed actions only. Autonomous play samples a correlated style per attempt. '
      + 'Style is not a guarantee of success/failure. Own memberships, availability and target exclusions remain exact. '
      + 'No winning-count improvement, prospective promotion or80% claim is established.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-outcome-styles-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ prefixes, probabilityDecisions, models: fitted.models.length, players }));
}

if (require.main === module) main();
