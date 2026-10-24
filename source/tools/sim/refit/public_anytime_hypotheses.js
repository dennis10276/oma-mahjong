'use strict';
const assert = require('assert/strict');
const { createPairedPictureSampler } = require('./public_paired_picture_sampler.js');

function rankHypothesisActions(problem, options) {
  assert(Object.keys(problem).every(key => ['rememberedPictures', 'actions', 'fallbackIndex'].includes(key)));
  assert(Object.keys(options).every(key => ['deadline', 'now', 'evaluate', 'random', 'maximumJokers', 'maximumWorlds', 'nodesPerAction'].includes(key)));
  const now = options.now ?? Date.now, evaluate = options.evaluate;
  const maximumWorlds = options.maximumWorlds ?? 32, nodesPerAction = options.nodesPerAction ?? 256;
  assert.equal(typeof now, 'function'); assert.equal(typeof evaluate, 'function');
  assert(Number.isFinite(options.deadline));
  assert(Number.isInteger(maximumWorlds) && maximumWorlds > 0 && maximumWorlds <= 128);
  assert(Number.isInteger(nodesPerAction) && nodesPerAction > 0 && nodesPerAction <= 4096);
  const actions = problem.actions.slice();
  assert(actions.length && new Set(actions).size === actions.length);
  assert(actions.every(index => Number.isInteger(index) && index >= 0 && index < problem.rememberedPictures.length));
  assert(actions.includes(problem.fallbackIndex));
  const sampler = createPairedPictureSampler(problem.rememberedPictures,
    { random: options.random, maximumJokers: options.maximumJokers });
  const totals = actions.map(index => ({ index, cleared: 0, lost: 0, unresolved: 0 }));
  let generatedWorlds = 0, completeWorlds = 0, preferredWorlds = 0, unresolvedWorlds = 0;
  let excludedByWinnabilityPreference = 0, nodes = 0, stopReason = 'maximumWorlds';
  while (generatedWorlds < maximumWorlds) {
    if (now() >= options.deadline) { stopReason = 'deadline'; break; }
    const hypothesis = sampler.sample(), batch = [];
    generatedWorlds++;
    for (const index of actions) {
      if (now() >= options.deadline) { stopReason = 'deadline'; break; }
      const report = evaluate({ hypothesis: structuredClone(hypothesis), index,
        deadline: options.deadline, nodeLimit: nodesPerAction, worldOrdinal: generatedWorlds });
      assert(report && Object.keys(report).every(key => ['kind', 'status', 'nodes'].includes(key)));
      assert.equal(report.kind, 'hypothesisEvaluation');
      assert(['cleared', 'lost', 'unresolved'].includes(report.status));
      assert(Number.isInteger(report.nodes) && report.nodes >= 0 && report.nodes <= nodesPerAction);
      nodes += report.nodes;
      if (now() >= options.deadline) { stopReason = 'deadline'; break; }
      batch.push(report.status);
    }
    if (batch.length !== actions.length) break;
    completeWorlds++;
    if (!batch.includes('cleared')) {
      if (batch.includes('unresolved')) unresolvedWorlds++;
      else excludedByWinnabilityPreference++;
      continue;
    }
    preferredWorlds++;
    batch.forEach((status, offset) => { totals[offset][status]++; });
  }
  let selected = totals.find(row => row.index === problem.fallbackIndex);
  for (const row of totals) if (row.cleared > selected.cleared || row.cleared === selected.cleared && row.lost < selected.lost) selected = row;
  return { kind: 'hypothesisRanking', index: selected.index, knownWin: false, knownDead: false,
    generatedWorlds, completeWorlds, preferredWorlds, unresolvedWorlds, excludedByWinnabilityPreference,
    incompleteWorlds: generatedWorlds - completeWorlds, nodes, stopReason, totals,
    exactLossShares: false, observedFact: false,
    note: 'Single-thread anytime ranking from complete balanced action batches on public-memory picture hypotheses. Prefer fillings with a constructed hypothetical clear; bounded evaluations stay unresolved. An unfinished batch changes no action totals. Counterfactual outcomes and the biased winnability preference are not observed knowledge, actual winning/dead-end proofs, exact filling fractions or a calibrated human forecast.' };
}

module.exports = { rankHypothesisActions };
