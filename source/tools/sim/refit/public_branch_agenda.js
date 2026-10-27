'use strict';
const assert = require('assert/strict');
const { aliveSignature } = require('./public_alive_signature.js');

function createBranchAgenda(size, options = {}) {
  const width = options.width ?? 3, maximumCheckpoints = options.maximumCheckpoints ?? 128;
  const maximumOutcomes = options.maximumOutcomes ?? 32;
  assert(Number.isInteger(size) && size > 0);
  assert(Number.isInteger(width) && width > 0 && width <= 8);
  assert(Number.isInteger(maximumCheckpoints) && maximumCheckpoints > 0);
  assert(Number.isInteger(maximumOutcomes) && maximumOutcomes > 0);
  const checkpoints = new Map(), outcomes = [];
  const counters = { updates: 0, retainedWorkingSets: 0, evictedCheckpoints: 0, observedFailedPlays: 0 };
  const signature = state => {
    assert(state.alive.length === size);
    return aliveSignature(state.alive) + '|' + JSON.stringify([state.tray, state.moves, state.openPeek,
      !!state.relieved, state.arriving ?? []]);
  };
  const indices = actions => {
    const values = actions.map(action => action.index);
    assert(new Set(values).size === values.length && values.every(index => Number.isInteger(index) && index >= 0 && index < size));
    return values;
  };
  const priorities = (state, actions, preferred = null) => {
    const available = indices(actions), key = signature(state), previous = checkpoints.get(key);
    if (preferred !== null) assert(available.includes(preferred));
    if (previous) { checkpoints.delete(key); checkpoints.set(key, previous); counters.retainedWorkingSets++; }
    return [...new Set([...(previous?.active ?? []), ...(preferred === null ? [] : [preferred]), ...available])]
      .filter(index => available.includes(index));
  };
  return {
    priorities,
    accept(state, actions, proof, preferred = null, promote = false) {
      assert.equal(typeof promote, 'boolean');
      if (!proof.completeRootCoverage || !proof.propagationComplete) return null;
      const available = indices(actions), proven = new Set(proof.discardedRoots);
      assert.deepEqual(proof.rootStatuses.map(root => root.index).slice().sort((left, right) => left - right),
        available.slice().sort((left, right) => left - right));
      assert([...proven].every(index => proof.rootStatuses.some(root => root.index === index && root.status === 'rejected')));
      const retained = priorities(state, actions, preferred).filter(index => !proven.has(index));
      const ordered = promote && preferred !== null && !proven.has(preferred)
        ? [preferred, ...retained.filter(index => index !== preferred)] : retained;
      const report = { active: ordered.slice(0, width), deferred: ordered.slice(width), rejectedNow: [...proven],
        proofScope: 'current_public_model_only' };
      const key = signature(state); checkpoints.delete(key); checkpoints.set(key, structuredClone(report)); counters.updates++;
      while (checkpoints.size > maximumCheckpoints) { checkpoints.delete(checkpoints.keys().next().value); counters.evictedCheckpoints++; }
      return report;
    },
    recordOutcome(actions, status) {
      assert(Array.isArray(actions) && actions.length <= 512
        && actions.every(index => Number.isInteger(index) && index >= 0 && index < size));
      assert(['physicalLoss', 'cleared', 'unresolvedBudget', 'unresolvedPublicFrontier', 'unresolved'].includes(status));
      outcomes.push({ actions: actions.slice(), status, kind: 'observed_play_outcome', rulesOutWholeOpening: false });
      counters.observedFailedPlays += +(status === 'physicalLoss');
      if (outcomes.length > maximumOutcomes) outcomes.shift();
    },
    outcomes() { return structuredClone(outcomes); },
    stats() { return { ...counters, checkpoints: checkpoints.size, outcomes: outcomes.length, width }; },
  };
}

module.exports = { createBranchAgenda };
