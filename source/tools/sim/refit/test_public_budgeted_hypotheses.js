'use strict';
const assert = require('assert/strict');
const { rankHypothesisActions } = require('./public_anytime_hypotheses.js');
const { rankBudgetedHypotheses } = require('./public_budgeted_hypotheses.js');

function test() {
  const problem = { rememberedPictures: [0, 0, null, null], actions: [0, 1, 2], fallbackIndex: 0 };
  const createPhysics = () => {
    let time = 0;
    const calls = [];
    return { now: () => time, calls,
      prepare({ deadline, worldOrdinal }) { assert.equal(deadline, 40); calls.push({ kind: 'prepare', worldOrdinal }); time += 2; return true; },
      evaluate({ index, deadline, worldOrdinal, hypothesis }) {
        assert.equal(hypothesis.kind, 'pairedPictureHypothesis');
        assert.equal(hypothesis.observedFact, false);
        const available = deadline - time, needed = index === 1 ? 50 : index === 0 ? 1 : 2;
        calls.push({ kind: 'evaluate', index, available, worldOrdinal, deadline });
        time += Math.min(available, needed);
        return { kind: 'hypothesisEvaluation', status: available <= needed ? 'unresolved' : index === 2 ? 'cleared' : 'lost', nodes: 1 };
      } };
  };
  const broad = createPhysics();
  const ordinary = rankHypothesisActions(problem, { deadline: 40, now: broad.now, random: () => 0, maximumWorlds: 1,
    evaluate(request) { if (request.index === 0) broad.prepare(request); return broad.evaluate(request); } });
  assert.equal(ordinary.completeWorlds, 0); assert.equal(ordinary.incompleteWorlds, 1); assert.equal(ordinary.index, 0);
  const physics = createPhysics();
  const budgeted = rankBudgetedHypotheses(problem, { deadline: 40, now: physics.now, physics,
    random: () => 0, maximumWorlds: 1, actionMs: 10, reserveMs: 2 });
  assert.equal(budgeted.completeWorlds, 1); assert.equal(budgeted.preferredWorlds, 1); assert.equal(budgeted.incompleteWorlds, 0);
  assert.equal(budgeted.index, 2); assert.equal(budgeted.preparationCalls, 1); assert.equal(budgeted.budgetedActions, 3);
  assert.equal(budgeted.actionDeadlineStops, 1);
  assert.deepEqual(physics.calls.filter(call => call.kind === 'evaluate').map(call => call.available), [10, 10, 10],
    'Each candidate gets the same slice after shared preparation');
  assert.deepEqual(budgeted.totals, [{ index: 0, cleared: 0, lost: 1, unresolved: 0 },
    { index: 1, cleared: 0, lost: 0, unresolved: 1 }, { index: 2, cleared: 1, lost: 0, unresolved: 0 }]);
  assert.equal(budgeted.knownWin, false); assert.equal(budgeted.knownDead, false); assert.equal(budgeted.exactLossShares, false);
  const constrained = createPhysics();
  const shared = rankBudgetedHypotheses(problem, { deadline: 40, now: constrained.now, physics: constrained,
    random: () => 0, maximumWorlds: 1, actionMs: 100, reserveMs: 2 });
  assert.equal(shared.completeWorlds, 1);
  assert(constrained.calls.filter(call => call.kind === 'evaluate').every(call => call.deadline <= 38));
  const invalid = createPhysics(); invalid.prepare = () => false;
  const unresolved = rankBudgetedHypotheses(problem, { deadline: 40, now: invalid.now, physics: invalid,
    random: () => 0, maximumWorlds: 1 });
  assert.equal(unresolved.unresolvedWorlds, 1); assert.equal(unresolved.preferredWorlds, 0);
  assert.equal(unresolved.index, 0); assert.equal(unresolved.budgetedActions, 0);
  const expired = createPhysics();
  const stopped = rankBudgetedHypotheses(problem, { deadline: 0, now: expired.now, physics: expired, random: () => 0 });
  assert.equal(stopped.generatedWorlds, 0); assert.equal(expired.calls.length, 0);
  const late = createPhysics(), ordinaryEvaluation = late.evaluate;
  late.evaluate = request => ({ ...ordinaryEvaluation(request), status: 'cleared' });
  const censored = rankBudgetedHypotheses(problem, { deadline: 40, now: late.now, physics: late,
    random: () => 0, maximumWorlds: 1, actionMs: 10, reserveMs: 2 });
  assert.equal(censored.actionDeadlineStops, 1);
  assert.equal(censored.totals.find(row => row.index === 1).cleared, 0);
  assert.equal(censored.totals.find(row => row.index === 1).unresolved, 1,
    'A callback that claims a clear after its local budget cannot win the comparison');
  const repeated = createPhysics();
  const multiple = rankBudgetedHypotheses(problem, { deadline: 40, now: repeated.now, physics: repeated,
    random: () => 0, maximumWorlds: 2, actionMs: 10, reserveMs: 2 });
  assert.equal(multiple.preparationCalls, 2); assert.equal(multiple.completeWorlds, 2);
  assert.deepEqual(repeated.calls.map(call => [call.kind, call.worldOrdinal]),
    [1, 2].flatMap(ordinal => [['prepare', ordinal], ...Array(3).fill(['evaluate', ordinal])]));
  assert.throws(() => rankBudgetedHypotheses(problem, { deadline: 40, physics: createPhysics(), actionMs: 0 }));
  assert.throws(() => rankBudgetedHypotheses(problem, { deadline: 40, physics: createPhysics(), seed: 1 }));
  console.log('PASS per-candidate deadlines recover a complete balanced comparison lost to a slow earlier root, reserve shared time for all candidates after one world preparation, retain unresolved caps and never label samples as real proofs or exact probabilities');
}

if (require.main === module) test();
module.exports = test;
