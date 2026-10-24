'use strict';
const assert = require('assert/strict');
const { createPairedPictureSampler } = require('./public_paired_picture_sampler.js');
const { createDiversePictureSampler } = require('./public_diverse_picture_sampler.js');
const { candidatePaths } = require('./public_information_actions.js');
const { createInformationComparison } = require('./public_information_comparison.js');

function rankSequentialInformationActions(problem, { physics, random, deadline, now = Date.now, maximumWorlds = 16, exactNodes = 4096, picturePrior = 'uniform', exactUnknownLimit = 8, scoreMode = 'clear', confidenceSE = 0 }) {
  const paths = candidatePaths(problem);
  assert(Number.isFinite(deadline)); assert(Number.isInteger(maximumWorlds) && maximumWorlds > 0 && maximumWorlds <= 128);
  assert(Number.isInteger(exactNodes) && exactNodes >= 1000 && exactNodes <= 4096);
  assert(problem.unseenFraction >= 0 && problem.unseenFraction <= 1);
  const actions = problem.actions.slice();
  assert(actions.length > 1 && new Set(actions).size === actions.length && actions.includes(problem.fallbackIndex));
  assert(['uniform', 'diverse'].includes(picturePrior));
  const sampler = (picturePrior === 'diverse' ? createDiversePictureSampler : createPairedPictureSampler)(problem.rememberedPictures, { random });
  assert(Number.isInteger(exactUnknownLimit) && exactUnknownLimit >= 0 && exactUnknownLimit <= 512);
  const unseenCount = problem.unseenCount ?? problem.rememberedPictures.filter(picture => picture === null).length;
  const informationWeight = unseenCount > exactUnknownLimit ? 1 : Math.min(1, 2 * problem.unseenFraction);
  const comparison = createInformationComparison(actions, problem.fallbackIndex, { scoreMode, confidenceSE });
  let generatedWorlds = 0, completeWorlds = 0, preferredWorlds = 0, unresolvedWorlds = 0, nodes = 0;
  while (generatedWorlds < maximumWorlds && now() < deadline - 8) {
    const hypothesis = sampler.sample(), batch = []; generatedWorlds++;
    const ready = physics.prepare({ hypothesis, worldOrdinal: generatedWorlds, deadline });
    for (const [offset, index] of actions.entries()) {
      if (now() >= deadline - 8) break;
      const actionDeadline = now() + Math.max(0, (deadline - now() - 8) / (actions.length - offset));
      const informationDeadline = now() + (actionDeadline - now()) * Math.max(0.35, informationWeight);
      let honest = { status: 'unresolved', progress: 0 }, exact = { status: 'unresolved', nodes: 0 };
      const path = paths.get(index);
      const request = { hypothesis: structuredClone(hypothesis), index: path[0], candidatePath: path, worldOrdinal: generatedWorlds };
      if (ready) {
        const report = physics.evaluateInformation({ ...request, deadline: informationDeadline });
        assert.equal(report.kind, 'informationEvaluation');
        assert(['cleared', 'lost', 'unresolved'].includes(report.status));
        honest = now() < informationDeadline ? report : scoreMode === 'progress' ? { ...report, status: 'unresolved' } : honest;
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
    comparison.add(batch, informationWeight);
  }
  return { kind: 'informationRanking', ...comparison.finish(), nodes, generatedWorlds, completeWorlds, preferredWorlds,
    unresolvedWorlds, excludedByWinnabilityPreference: 0, incompleteWorlds: generatedWorlds - completeWorlds,
    informationWeight, unseenCount, exactUnknownLimit, knownWin: false, knownDead: false, observedFact: false, exactLossShares: false };
}

module.exports = { rankSequentialInformationActions };
