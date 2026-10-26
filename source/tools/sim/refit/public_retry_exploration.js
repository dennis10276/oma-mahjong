'use strict';
const assert = require('assert/strict');
const { advance } = require('./known_tray_plan.js');

function describeRetryPath(game, state, path) {
  let position = state, maximumTray = state.tray.length;
  for (const [offset, index] of path.entries()) {
    const moved = advance(game, position, index);
    if (moved.uncertain) return { safe: offset === path.length - 1 && position.tray.length <= 2
      && ['unseenPicture', 'unobservedObstacleRole', 'unobservedOrientation'].includes(moved.reason),
      maximumTray, finalTray: position.tray.length, frontier: index, reason: moved.reason };
    if (moved.lost) return { safe: false, maximumTray: Math.max(maximumTray, moved.state.tray.length),
      finalTray: moved.state.tray.length, frontier: null };
    position = moved.state; maximumTray = Math.max(maximumTray, position.tray.length);
  }
  return { safe: true, maximumTray, finalTray: position.tray.length, frontier: null };
}

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
    assert(Number.isInteger(primary.nodes) && primary.nodes >= 0 && primary.nodes <= options.nodes, 'The primary search exceeded its shared node budget');
    if (primary.knownWin || primary.knownDead || primary.safeClockExit || !costs.get(primary.index)) return primary;
    const alternatives = actions.filter(action => costs.get(action.index) < costs.get(primary.index));
    const remaining = options.nodes - primary.nodes;
    if (!alternatives.length || remaining <= 0 || Date.now() >= deadline) return primary;
    const candidate = runSearch(game, state, alternatives, { ...settings, nodes: remaining });
    assert(Number.isInteger(candidate.nodes) && candidate.nodes >= 0 && candidate.nodes <= remaining, 'Retry exploration exceeded the remaining node budget');
    const safety = !candidate.knownDead && (candidate.information || candidate.knownProgress > 0)
      ? describeRetryPath(game, state, candidate.path) : null;
    const adopted = candidate.knownWin || !!(safety?.safe && safety.maximumTray <= 3 && safety.finalTray <= 2);
    const selected = adopted ? candidate : primary;
    const reports = [primary, candidate].filter(report => report.continuationProof);
    return { ...selected, nodes: primary.nodes + candidate.nodes,
      ...(reports.length ? { continuationProof: Object.fromEntries(['calls', 'nodes', 'bounded', 'certified']
        .map(field => [field, reports.reduce((sum, report) => sum + report.continuationProof[field], 0)])) } : {}),
      retryExploration: { primaryIndex: primary.index, primaryPenalty: costs.get(primary.index), alternativeIndex: candidate.index,
        adopted, safety, sharedNodeLimit: options.nodes,
        note: 'A bounded alternative to a preference learned from an actual earlier lost attempt, not a proof that the original action loses. Active clocks and constructive wins remain protected; no hypothetical reveal is supplied.' } };
  };
}

module.exports = { retryExploration };
