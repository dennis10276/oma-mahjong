'use strict';
const assert = require('assert/strict');
const { rankHypothesisActions } = require('./public_anytime_hypotheses.js');

function rankBudgetedHypotheses(problem, options) {
  assert(Object.keys(options).every(key => ['deadline', 'now', 'physics', 'actionMs', 'reserveMs',
    'random', 'maximumJokers', 'maximumWorlds', 'nodesPerAction'].includes(key)));
  const now = options.now ?? Date.now, actionMs = options.actionMs ?? 100, reserveMs = options.reserveMs ?? 8;
  assert.equal(typeof now, 'function');
  assert(Number.isFinite(actionMs) && actionMs > 0 && actionMs <= 1500);
  assert(Number.isFinite(reserveMs) && reserveMs >= 0 && reserveMs <= 100);
  assert.equal(typeof options.physics.prepare, 'function'); assert.equal(typeof options.physics.evaluate, 'function');
  let preparedOrdinal = null, ready = false, quantum = 0, preparationCalls = 0, budgetedActions = 0, actionDeadlineStops = 0;
  const ranking = rankHypothesisActions(problem, { deadline: options.deadline, now, random: options.random,
    maximumJokers: options.maximumJokers, maximumWorlds: options.maximumWorlds, nodesPerAction: options.nodesPerAction,
    evaluate(request) {
      if (request.worldOrdinal !== preparedOrdinal) {
        preparedOrdinal = request.worldOrdinal; preparationCalls++;
        ready = options.physics.prepare({ hypothesis: request.hypothesis, worldOrdinal: request.worldOrdinal,
          deadline: options.deadline });
        assert.equal(typeof ready, 'boolean');
        quantum = Math.max(0, Math.min(actionMs, (options.deadline - now() - reserveMs) / problem.actions.length));
      }
      if (!ready || quantum <= 0 || now() >= options.deadline - reserveMs) return { kind: 'hypothesisEvaluation', status: 'unresolved', nodes: 0 };
      const deadline = Math.min(options.deadline - reserveMs, now() + quantum);
      budgetedActions++;
      const result = options.physics.evaluate({ ...request, deadline });
      if (now() >= deadline) {
        actionDeadlineStops++;
        return { ...result, status: 'unresolved' };
      }
      return result;
    } });
  return { ...ranking, preparationCalls, budgetedActions, actionDeadlineStops };
}

module.exports = { rankBudgetedHypotheses };
