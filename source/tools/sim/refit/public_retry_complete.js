'use strict';
const assert = require('assert/strict');
const { completeWitness } = require('./public_complete_witness.js');

function retryCompleteSearch(primarySearch, currentAttempt, options = {}) {
  assert.equal(typeof primarySearch, 'function');
  assert.equal(typeof currentAttempt, 'function');
  const milliseconds = options.milliseconds ?? 250, nodes = options.nodes ?? 2000, choices = options.choices ?? 512;
  assert(Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 500);
  assert(Number.isInteger(nodes) && nodes > 0);
  assert(Number.isInteger(choices) && choices > 0);
  const counters = { considered: 0, searched: 0, wins: 0, incomplete: 0, deadlineStops: 0, nodeStops: 0,
    choiceBudgetStops: 0, nodes: 0, maximumExtraMs: 0, overruledDeadCertificates: 0, solvedAttempts: [] };
  const search = (game, state, actions, settings = {}) => {
    const attempt = currentAttempt();
    assert(Number.isInteger(attempt) && attempt > 0);
    if (attempt < 2) return primarySearch(game, state, actions, settings);
    const began = Date.now(), primary = primarySearch(game, state, actions, settings);
    if (primary.knownWin) return primary;
    counters.considered++;
    const remaining = choices - (state.physicalTaps ?? 0);
    if (remaining <= 0) { counters.choiceBudgetStops++; return primary; }
    const extraBegan = Date.now();
    const result = completeWitness(game, state, actions, { nodes, taps: Math.min(256, remaining),
      deadline: Math.min(settings.deadline ?? Infinity, began + 1800, extraBegan + milliseconds) });
    counters.maximumExtraMs = Math.max(counters.maximumExtraMs, Date.now() - extraBegan);
    counters.nodes += result.nodes;
    counters.searched += +(result.nodes > 0);
    counters.incomplete += +(result.reason === 'incomplete_public_memory');
    counters.deadlineStops += +(result.reason === 'deadline');
    counters.nodeStops += +(result.reason === 'node_limit');
    if (!result.path?.length) return primary;
    counters.wins++; counters.solvedAttempts.push(attempt);
    counters.overruledDeadCertificates += +!!primary.knownDead;
    const report = { ...primary };
    delete report.deadCertificate; delete report.provedDeadRoots;
    return { ...report, index: result.path[0], path: result.path, goal: 'win', knownWin: true,
      knownDead: false, knownProgress: state.alive.reduce((sum, alive) => sum + alive, 0),
      safeClockExit: false, clockRoom: 0, information: false, boundary: false,
      nodes: (primary.nodes ?? 0) + result.nodes,
      retryCompleteWitness: { attempt, nodes: result.nodes, taps: result.path.length,
        source: 'complete winning route through actually remembered pictures and publicly proved mechanics' } };
  };
  search.stats = () => structuredClone(counters);
  return search;
}

module.exports = { retryCompleteSearch };
