'use strict';
const assert = require('assert/strict');
const { rankHypothesisActions } = require('./public_anytime_hypotheses.js');

function test() {
  const problem = { rememberedPictures: [0, 0, null, null], actions: [0, 1, 2], fallbackIndex: 0 };
  let time = 0, calls = 0;
  const options = { deadline: 100, now: () => time, random: () => 0, maximumWorlds: 3, nodesPerAction: 8,
    evaluate({ hypothesis, index, deadline, nodeLimit }) {
      assert.equal(hypothesis.kind, 'pairedPictureHypothesis');
      assert.equal(hypothesis.observedFact, false); assert.equal(deadline, 100); assert.equal(nodeLimit, 8);
      calls++; time++;
      return { kind: 'hypothesisEvaluation', status: index === 2 ? 'cleared' : index === 1 ? 'unresolved' : 'lost', nodes: 3 };
    } };
  const snapshot = JSON.stringify(problem), ranked = rankHypothesisActions(problem, options);
  assert.equal(ranked.index, 2); assert.equal(ranked.preferredWorlds, 3); assert.equal(ranked.completeWorlds, 3);
  assert.equal(calls, 9); assert.equal(ranked.nodes, 27); assert.equal(ranked.stopReason, 'maximumWorlds');
  assert.equal(ranked.knownWin, false); assert.equal(ranked.knownDead, false); assert.equal(ranked.exactLossShares, false);
  assert.equal(JSON.stringify(problem), snapshot);
  assert.deepEqual(ranked.totals, [{ index: 0, cleared: 0, lost: 3, unresolved: 0 },
    { index: 1, cleared: 0, lost: 0, unresolved: 3 }, { index: 2, cleared: 3, lost: 0, unresolved: 0 }]);
  calls = 0; time = 100;
  const expired = rankHypothesisActions(problem, options);
  assert.equal(expired.index, 0); assert.equal(calls, 0); assert.equal(expired.generatedWorlds, 0);
  time = 0; calls = 0;
  const interrupted = rankHypothesisActions(problem, { ...options, deadline: 5,
    evaluate({ index }) { calls++; time++; return { kind: 'hypothesisEvaluation', status: index === 1 ? 'cleared' : 'lost', nodes: 1 }; } });
  assert.equal(interrupted.index, 1); assert.equal(interrupted.completeWorlds, 1);
  assert.equal(interrupted.incompleteWorlds, 1); assert.equal(interrupted.stopReason, 'deadline');
  assert.equal(interrupted.totals[1].cleared, 1, 'An unfinished later world cannot inflate an early action');
  time = 0;
  const allLost = rankHypothesisActions(problem, { ...options,
    evaluate() { return { kind: 'hypothesisEvaluation', status: 'lost', nodes: 1 }; } });
  assert.equal(allLost.index, problem.fallbackIndex); assert.equal(allLost.excludedByWinnabilityPreference, 3);
  assert.equal(allLost.knownDead, false, 'No sampled winning world does not prove the actual position dead');
  const bounded = rankHypothesisActions(problem, { ...options,
    evaluate() { return { kind: 'hypothesisEvaluation', status: 'unresolved', nodes: 8 }; } });
  assert.equal(bounded.index, problem.fallbackIndex); assert.equal(bounded.unresolvedWorlds, 3);
  assert.equal(bounded.excludedByWinnabilityPreference, 0, 'Censored work must not be called a losing filling');
  const tied = rankHypothesisActions({ ...problem, fallbackIndex: 2 }, { ...options,
    evaluate() { return { kind: 'hypothesisEvaluation', status: 'cleared', nodes: 1 }; } });
  assert.equal(tied.index, 2, 'Equal evidence preserves the original physical planner choice');
  assert.throws(() => rankHypothesisActions({ ...problem, faces: [0, 0, 1, 1] }, options));
  assert.throws(() => rankHypothesisActions(problem, { ...options, seed: 1 }));
  assert.throws(() => rankHypothesisActions(problem, { ...options,
    evaluate: () => ({ kind: 'hypothesisEvaluation', status: 'lost', nodes: 9 }) }));
  assert.throws(() => rankHypothesisActions(problem, { ...options,
    evaluate: () => ({ kind: 'hypothesisEvaluation', status: 'cleared', nodes: 1, knownWin: true }) }));
  console.log('PASS balanced anytime hypothesis batches stop at a shared deadline, discard unfinished worlds, preserve fallback ties and unresolved caps, condition only on hypothetical clears and never expose their scores as observed facts or exact loss fractions');
}

if (require.main === module) test();
module.exports = test;
