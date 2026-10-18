'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { planEvaluator, scoreSequence } = require('./personal_plan_choice.js');
const { pinnedRead, actionPinned, memoryPinned } = require('./personal_context_runtime_audit.js');
const root = path.resolve(__dirname, '../../..');
const episodePinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-episode-actions-2026-10-18T05-33-43-593Z');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const compact = (value, step = false) => ({ decisions: value.decisions, jointLogLoss: step ? value.stepLogLoss : value.jointLogLoss,
  topActionAccuracy: step ? value.stepTopActionAccuracy : value.topActionAccuracy });
const failureReason = game => !game.complete || game.stopReason !== 'end' ? null : game.ending === 'restart' ? 'restart'
  : game.ending === 'stuck' ? ['clock', 'tray'].includes(game.reconstructed.why) ? game.reconstructed.why : 'other' : null;

function main() {
  const data = pinnedRead(actionPinned, 'analysis/archive/personal-bots/policy-value-prefix-data.json');
  const fitted = pinnedRead(episodePinned, 'analysis/archive/personal-bots/personal-plan-models.json');
  const expected = pinnedRead(episodePinned, 'analysis/personal-bots/personal-plan-action-evaluation.json');
  const bank = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const counts = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-count-data.json');
  const requests = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-count-requests.json');
  const featureFile = 'analysis/personal-bots/personal-context-runtime-audit.json', featureRaw = fs.readFileSync(path.join(root, featureFile)), feature = JSON.parse(featureRaw);
  const featureDigest = crypto.createHash('sha256');
  for (const file of feature.fingerprintFiles) featureDigest.update(file).update(fs.readFileSync(path.join(root, file)));
  assert.equal(featureDigest.digest('hex'), feature.fingerprint);
  assert.equal(feature.runtimePrefixes, 398); assert.equal(feature.runtimeDecisions, 33543); assert.equal(feature.unsupported.length, 0);
  const relative = folder => path.relative(root, folder).replace(/\\/g, '/');
  const dependencies = [
    ...['manifest.json', 'analysis/archive/personal-bots/personal-plan-models.json', 'analysis/personal-bots/personal-plan-action-evaluation.json'].map(file => relative(episodePinned) + '/' + file),
    ...['manifest.json', 'analysis/archive/personal-bots/policy-value-prefix-data.json'].map(file => relative(actionPinned) + '/' + file),
    ...['manifest.json', 'analysis/archive/personal-bots/physical-memory-policy-bank.json', 'analysis/archive/personal-bots/physical-memory-count-data.json',
      'analysis/archive/personal-bots/physical-count-requests.json'].map(file => relative(memoryPinned) + '/' + file)];
  const fingerprintFiles = [...new Set([...feature.fingerprintFiles, featureFile, ...dependencies,
    ...['personal_plan_runtime_audit.js', 'personal_plan_choice.js', 'personal_plan.py'].map(file => 'tools/sim/refit/' + file)])];
  const fingerprintOf = () => { const digest = crypto.createHash('sha256'); for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file))); return digest.digest('hex'); };
  const fingerprint = fingerprintOf();
  const models = new Map(fitted.models.map(model => [model.id, model.episodePlan]));
  const actors = new Map(bank.models.map(actor => [actor.id, actor]));
  let prefixes = 0, decisions = 0, transitions = 0, comparisons = 0;
  const measured = {};
  for (const [name, player] of Object.entries(expected.players)) {
    const state = new Map(), rows = [];
    for (const row of player.rows) {
      if (!row.scores) { rows.push({ aid: row.aid, status: row.status }); continue; }
      const scores = {};
      for (const scope of ['ownAll', 'ownCarryAll']) {
        const lineage = row.lineage[scope], model = models.get(lineage.id), actor = actors.get(lineage.id);
        assert(model && actor);
        assert(model.trainingCut <= row.opening && (model.availableThrough === null || model.availableThrough < row.opening));
        const request = requests.requests.find(item => item.name === name && item.start === row.opening);
        assert(request && !model.trainedAids.some(aid => request.excludedAids.includes(aid)));
        const games = scope === 'ownAll' ? data.players[name] : data.memoryPlayers.configured[name];
        const game = games.find(item => item.aid === row.aid);
        assert(game);
        const evaluator = planEvaluator(actor, model), prior = game.initialNewLevel ? model.initialPrior : model.prior;
        const fixed = scoreSequence(game, evaluator, prior);
        const key = scope + '|' + row.opening, previous = state.get(key);
        let adaptivePrior = prior;
        if (lineage.previousObservedRetry) {
          assert(previous && previous.game.aid === lineage.previousObservedRetry);
          assert(previous.game.availableAt < game.t && game.at === previous.game.at + 1);
          assert.equal(failureReason(previous.game), lineage.transitionReason);
          const campaign = counts.rows.find(item => item.name === name && item.start === row.opening);
          assert(campaign && !campaign.boardChangedWithinCampaign);
          const matrix = model.transitions[lineage.transitionReason];
          adaptivePrior = [0, 1].map(component => previous.posterior[0] * matrix[0][component] + previous.posterior[1] * matrix[1][component]);
          transitions++;
        }
        const adaptive = scoreSequence(game, evaluator, adaptivePrior);
        let controlLoss = 0, controlHits = 0, controlDecisions = 0;
        for (const decision of game.decisions) {
          if (decision.k < 0) continue;
          const probabilities = evaluator.base.probabilities(decision), maximum = Math.max(...probabilities);
          const ties = probabilities.map(value => Math.abs(value - maximum) <= 1e-12 + 1e-8 * Math.abs(maximum));
          controlLoss -= Math.log(Math.max(1e-300, probabilities[decision.k]));
          controlHits += +ties[decision.k] / ties.filter(Boolean).length;
          controlDecisions++;
        }
        scores[scope] = { control: { decisions: controlDecisions, jointLogLoss: controlDecisions ? controlLoss / controlDecisions : null,
          topActionAccuracy: controlDecisions ? controlHits / controlDecisions : null }, independentStep: compact(fixed, true),
          fixedEpisode: compact(fixed), adaptiveEpisode: compact(adaptive) };
        for (const [method, result] of Object.entries(scores[scope])) {
          const original = row.scores[scope][method];
          assert.equal(result.decisions, original.decisions);
          for (const field of ['jointLogLoss', 'topActionAccuracy']) {
            if (original[field] === null) assert.equal(result[field], null);
            else assert(Math.abs(result[field] - original[field]) < 1e-12, name + '/' + game.aid + '/' + scope + '/' + method + '/' + field);
          }
          comparisons++;
          decisions += result.decisions;
        }
        state.set(key, { game, posterior: adaptive.posterior });
      }
      rows.push({ aid: row.aid, initial: row.initial, scores });
      prefixes++;
    }
    measured[name] = { initialCandidates: player.initialCandidates, campaignCandidates: player.campaignCandidates, rows };
  }
  assert.equal(fingerprintOf(), fingerprint);
  const report = { made: new Date().toISOString(), evidence: 'episode-runtime-probability-parity-diagnostic', targetMet: false,
    fingerprint, fingerprintFiles, prefixes, probabilityDecisions: decisions, methodComparisons: comparisons, transitionApplications: transitions,
    featureAuditSha256: hash(featureRaw), planModelsSha256: hash(fs.readFileSync(path.join(episodePinned, 'analysis/archive/personal-bots/personal-plan-models.json'))),
    planModelExperiment: relative(episodePinned), measured,
    note: 'Every held initial/retry prefix and declared method/scope matches frozen Python per-prefix likelihood and top-action metrics to1e-12. Source availability, target exclusions and observed retry causality remain checked. Feature/physics parity covers all398 original prefixes/33,543 choices. Human action filtering is diagnostic only, not an autonomous forecast or winning-count accuracy. Runtime factories sample once per attempt on independent seed streams and use only their own simulated failures. Original numeric ledgers are unchanged.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-plan-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log('Verified', prefixes, 'held prefixes,', decisions, 'probability decisions,', comparisons, 'method/scope comparisons and', transitions, 'causal retry applications');
}

if (require.main === module) main();
module.exports = { episodePinned };
