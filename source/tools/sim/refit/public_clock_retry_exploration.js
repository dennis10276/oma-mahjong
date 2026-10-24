'use strict';
const assert = require('assert/strict');
const { advance } = require('./known_tray_plan.js');
const { roomOf } = require('./public_witness_search.js');
const { retryExploration } = require('./public_retry_exploration.js');

function clockExitPrefix(game, state, path, deadline = Infinity) {
  assert(game.clock && state.alive[game.clock.i], 'A clock-exit proof starts with an active public clock');
  let position = state;
  const prefix = [];
  for (const index of path) {
    if (Date.now() >= deadline) return null;
    const moved = advance(game, position, index);
    if (moved.uncertain || moved.lost) return null;
    position = moved.state; prefix.push(index);
    if (!position.alive[game.clock.i] && roomOf(game, position).safe) {
      return { path: prefix, finalTray: position.tray.length, clockRemoved: true };
    }
  }
  return null;
}

function clockRetryExploration(runSearch) {
  assert.equal(typeof runSearch, 'function');
  const ordinary = retryExploration(runSearch);
  return (game, state, actions, options = {}) => {
    if (!(game.clock && state.alive[game.clock.i])) return ordinary(game, state, actions, options);
    if (!game.publicRetryCost) return runSearch(game, state, actions, options);
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
    assert(Number.isInteger(primary.nodes) && primary.nodes >= 0 && primary.nodes <= options.nodes, 'The primary clock search exceeded the shared node budget');
    if (primary.knownWin || primary.knownDead || primary.safeClockExit || !costs.get(primary.index)) return primary;
    const alternatives = actions.filter(action => costs.get(action.index) < costs.get(primary.index));
    const remaining = options.nodes - primary.nodes;
    if (!alternatives.length || remaining <= 0 || Date.now() >= deadline) return primary;
    const candidate = runSearch(game, state, alternatives, { ...settings, nodes: remaining });
    assert(Number.isInteger(candidate.nodes) && candidate.nodes >= 0 && candidate.nodes <= remaining, 'Clock retry exploration exceeded the remaining node budget');
    const proof = (candidate.knownWin || candidate.safeClockExit) && !candidate.knownDead
      ? clockExitPrefix(game, state, candidate.path, deadline) : null;
    const adopted = !!proof, selected = adopted ? candidate : primary;
    const reports = [primary, candidate].filter(report => report.continuationProof);
    return { ...selected, nodes: primary.nodes + candidate.nodes,
      ...(reports.length ? { continuationProof: Object.fromEntries(['calls', 'nodes', 'bounded', 'certified']
        .map(field => [field, reports.reduce((sum, report) => sum + report.continuationProof[field], 0)])) } : {}),
      clockRetryExploration: { primaryIndex: primary.index, primaryPenalty: costs.get(primary.index),
        alternativeIndex: candidate.index, adopted, proof, sharedNodeLimit: options.nodes,
        note: 'A real earlier risk may select a lower-penalty root only with a known physical safe clock-exit prefix. Unknowns, physical clock loss and limits cannot become a witness or a free restart.' } };
  };
}

module.exports = { clockRetryExploration, clockExitPrefix };
