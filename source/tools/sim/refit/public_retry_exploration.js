'use strict';
const assert = require('assert/strict');
const { describeKnownPath } = require('./public_witness_reopen_guard.js');

function retryExploration(runSearch) {
  assert.equal(typeof runSearch, 'function');
  return (game, state, actions, options = {}) => {
    if (!game.publicRetryCost || game.clock && state.alive[game.clock.i]) return runSearch(game, state, actions, options);
    assert.equal(typeof game.publicRetryCost, 'function');
    const costs = new Map(actions.map(action => [action.index, game.publicRetryCost(action.index)]));
    assert([...costs.values()].every(cost => Number.isInteger(cost) && cost >= 0 && cost <= 3));
    if (![...costs.values()].some(Boolean)) return runSearch(game, state, actions, options);
    assert(Number.isInteger(options.nodes) && options.nodes > 0);
    assert(options.decisionMs === undefined || Number.isFinite(options.decisionMs) && options.decisionMs > 0 && options.decisionMs <= 2000);
    const deadline = Math.min(options.deadline ?? Infinity, options.decisionMs === undefined ? Infinity : Date.now() + options.decisionMs);
    assert(deadline === Infinity || Number.isFinite(deadline));
    const settings = { ...options, decisionMs: undefined, deadline };
    const primary = runSearch(game, state, actions, settings);
    if (primary.knownWin || primary.knownDead || primary.safeClockExit || !costs.get(primary.index)) return primary;
    const alternatives = actions.filter(action => costs.get(action.index) < costs.get(primary.index));
    const remaining = options.nodes - primary.nodes;
    if (!alternatives.length || remaining <= 0 || Date.now() >= deadline) return primary;
    const candidate = runSearch(game, state, alternatives, { ...settings, nodes: remaining });
    const safety = !candidate.knownDead && (candidate.information || candidate.knownProgress > 0)
      ? describeKnownPath(game, state, candidate.path) : null;
    const adopted = candidate.knownWin || !!(safety?.safe && safety.maximumTray <= 3 && safety.finalTray <= 2);
    const selected = adopted ? candidate : primary;
    const reports = [primary, candidate].filter(report => report.continuationProof);
    return { ...selected, nodes: primary.nodes + candidate.nodes,
      ...(reports.length ? { continuationProof: Object.fromEntries(['calls', 'nodes', 'bounded', 'certified']
        .map(field => [field, reports.reduce((sum, report) => sum + report.continuationProof[field], 0)])) } : {}),
      retryExploration: { primaryIndex: primary.index, primaryPenalty: costs.get(primary.index), alternativeIndex: candidate.index,
        adopted, safety, sharedNodeLimit: options.nodes,
        note: 'A bounded alternative to an actual unrecovered risk from an earlier lost attempt, not a proof that the original action loses. Active clocks and constructive wins remain protected; no hypothetical reveal is supplied.' } };
  };
}

module.exports = { retryExploration };
