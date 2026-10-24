'use strict';
const assert = require('assert/strict');
const { createPairedPictureSampler } = require('./public_paired_picture_sampler.js');
const { createDiversePictureSampler } = require('./public_diverse_picture_sampler.js');

function rankSequentialInformationActions(problem, { physics, random, deadline, now = Date.now, maximumWorlds = 16, exactNodes = 4096, picturePrior = 'uniform' }) {
  assert(Object.keys(problem).every(key => ['rememberedPictures', 'actions', 'fallbackIndex', 'unseenFraction'].includes(key)));
  assert(Number.isFinite(deadline)); assert(Number.isInteger(maximumWorlds) && maximumWorlds > 0 && maximumWorlds <= 128);
  assert(Number.isInteger(exactNodes) && exactNodes >= 1000 && exactNodes <= 4096);
  assert(problem.unseenFraction >= 0 && problem.unseenFraction <= 1);
  const actions = problem.actions.slice();
  assert(actions.length > 1 && new Set(actions).size === actions.length && actions.includes(problem.fallbackIndex));
  assert(actions.every(index => Number.isInteger(index) && index >= 0 && index < problem.rememberedPictures.length));
  assert(['uniform', 'diverse'].includes(picturePrior));
  const sampler = (picturePrior === 'diverse' ? createDiversePictureSampler : createPairedPictureSampler)(problem.rememberedPictures, { random });
  const informationWeight = Math.min(1, 2 * problem.unseenFraction);
  const totals = actions.map(index => ({ index, score: 0, informationClears: 0, exactClears: 0, unresolved: 0, lost: 0, progress: 0 }));
  let generatedWorlds = 0, completeWorlds = 0, preferredWorlds = 0, unresolvedWorlds = 0, nodes = 0;
  while (generatedWorlds < maximumWorlds && now() < deadline - 8) {
    const hypothesis = sampler.sample(), batch = []; generatedWorlds++;
    const ready = physics.prepare({ hypothesis, worldOrdinal: generatedWorlds, deadline });
    for (const [offset, index] of actions.entries()) {
      if (now() >= deadline - 8) break;
      const actionDeadline = now() + Math.max(0, (deadline - now() - 8) / (actions.length - offset));
      const informationDeadline = now() + (actionDeadline - now()) * Math.max(0.35, informationWeight);
      let honest = { status: 'unresolved', progress: 0 }, exact = { status: 'unresolved', nodes: 0 };
      const request = { hypothesis: structuredClone(hypothesis), index, worldOrdinal: generatedWorlds };
      if (ready) {
        const report = physics.evaluateInformation({ ...request, deadline: informationDeadline });
        assert.equal(report.kind, 'informationEvaluation');
        assert(['cleared', 'lost', 'unresolved'].includes(report.status));
        honest = now() < informationDeadline ? report : honest;
        if (informationWeight < 1 && now() < actionDeadline) {
          const report = physics.evaluate({ ...request, deadline: actionDeadline, nodeLimit: exactNodes });
          assert.equal(report.kind, 'hypothesisEvaluation');
          assert(['cleared', 'lost', 'unresolved'].includes(report.status));
          nodes += report.nodes;
          if (now() < actionDeadline) exact = report;
        }
      }
      if (now() >= deadline) break;
      batch.push({ honest, exact });
    }
    if (batch.length !== actions.length) break;
    completeWorlds++;
    const anyClear = batch.some(row => row.honest.status === 'cleared' || row.exact.status === 'cleared');
    preferredWorlds += +anyClear; unresolvedWorlds += +!anyClear;
    batch.forEach(({ honest, exact }, offset) => {
      const total = totals[offset];
      total.informationClears += +(honest.status === 'cleared'); total.exactClears += +(exact.status === 'cleared');
      total.score += informationWeight * +(honest.status === 'cleared') + (1 - informationWeight) * +(exact.status === 'cleared');
      total.unresolved += +(honest.status === 'unresolved'); total.lost += +(honest.status === 'lost');
      if (exact.status === 'lost') total.progress += exact.progress ?? 0;
    });
  }
  let selected = totals.find(row => row.index === problem.fallbackIndex);
  for (const total of totals) if (total.score > selected.score + 1e-12
    || Math.abs(total.score - selected.score) <= 1e-12 && total.progress > selected.progress) selected = total;
  return { kind: 'informationRanking', index: selected.index, totals, nodes, generatedWorlds, completeWorlds, preferredWorlds,
    unresolvedWorlds, excludedByWinnabilityPreference: 0, incompleteWorlds: generatedWorlds - completeWorlds,
    informationWeight, knownWin: false, knownDead: false, observedFact: false, exactLossShares: false };
}

module.exports = { rankSequentialInformationActions };
