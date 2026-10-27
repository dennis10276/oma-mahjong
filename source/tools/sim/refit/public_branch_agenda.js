'use strict';
const assert = require('assert/strict');
const { aliveSignature } = require('./public_alive_signature.js');

function createBranchAgenda(size, options = {}) {
  const width = options.width ?? 3, maximumCheckpoints = options.maximumCheckpoints ?? 128;
  const maximumOutcomes = options.maximumOutcomes ?? 32;
  const backtracking = options.backtracking ?? false;
  assert.equal(typeof backtracking, 'boolean');
  assert(Number.isInteger(size) && size > 0);
  assert(Number.isInteger(width) && width > 0 && width <= 8);
  assert(Number.isInteger(maximumCheckpoints) && maximumCheckpoints > 0);
  assert(Number.isInteger(maximumOutcomes) && maximumOutcomes > 0);
  const checkpoints = new Map(), outcomes = [];
  const failedChildren = new Map();
  let forks = [], pendingFork = null, request = null, consumed = false;
  const counters = { updates: 0, retainedWorkingSets: 0, evictedCheckpoints: 0, observedFailedPlays: 0 };
  if (backtracking) Object.assign(counters, { forksRecorded: 0, requestsScheduled: 0, requestsTaken: 0, requestsInvalidated: 0 });
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
    beginAttempt() { forks = []; pendingFork = null; consumed = false; },
    noteFork(state, choices, eligibleChosen, prefixLength) {
      if (!backtracking) return;
      assert(choices.length >= 2 && new Set(choices).size === choices.length);
      assert(choices.every(index => Number.isInteger(index) && index >= 0 && index < size));
      assert(eligibleChosen.every(index => choices.includes(index)));
      assert(Number.isInteger(prefixLength) && prefixLength >= 0);
      pendingFork = { key: signature(state), choices: choices.slice(), eligibleChosen: eligibleChosen.slice(), prefixLength };
    },
    acknowledge(index, accepted) {
      if (backtracking && accepted && pendingFork) {
        if (pendingFork.eligibleChosen.includes(index)) { forks.push({ ...pendingFork, selected: index }); counters.forksRecorded++; }
        if (request?.key === pendingFork.key && request.index === index) {
          request = null; consumed = true; counters.requestsTaken++;
        }
      }
      pendingFork = null;
    },
    backtrackChoice(state, choices) {
      if (!backtracking || consumed || !request || request.key !== signature(state)) return null;
      if (choices.includes(request.index)) return request.index;
      request = null; counters.requestsInvalidated++; return null;
    },
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
      while (checkpoints.size > maximumCheckpoints) {
        const oldest = checkpoints.keys().next().value; checkpoints.delete(oldest); failedChildren.delete(oldest);
        if (request?.key === oldest) request = null;
        counters.evictedCheckpoints++;
      }
      return report;
    },
    recordOutcome(actions, status) {
      assert(Array.isArray(actions) && actions.length <= 512
        && actions.every(index => Number.isInteger(index) && index >= 0 && index < size));
      assert(['physicalLoss', 'cleared', 'unresolvedBudget', 'unresolvedPublicFrontier', 'unresolved'].includes(status));
      outcomes.push({ actions: actions.slice(), status, kind: 'observed_play_outcome', rulesOutWholeOpening: false });
      counters.observedFailedPlays += +(status === 'physicalLoss');
      if (outcomes.length > maximumOutcomes) outcomes.shift();
      if (backtracking && status === 'physicalLoss') {
        request = null;
        for (let offset = forks.length - 1; offset >= 0; offset--) {
          const fork = forks[offset];
          if (!checkpoints.has(fork.key)) continue;
          const alternatives = fork.choices.filter(index => index !== fork.selected);
          if (!alternatives.length) continue;
          const counts = failedChildren.get(fork.key) ?? new Map();
          counts.set(fork.selected, (counts.get(fork.selected) ?? 0) + 1); failedChildren.set(fork.key, counts);
          alternatives.sort((left, right) => (counts.get(left) ?? 0) - (counts.get(right) ?? 0));
          request = { key: fork.key, index: alternatives[0], failedChoice: fork.selected,
            prefixLength: fork.prefixLength, kind: 'explore_another_continuation', rejectsWholeBranch: false };
          counters.requestsScheduled++; break;
        }
      } else if (backtracking && status === 'cleared') request = null;
      forks = []; pendingFork = null;
    },
    outcomes() { return structuredClone(outcomes); },
    stats() { return { ...counters, checkpoints: checkpoints.size, outcomes: outcomes.length, width,
      ...(backtracking ? { pendingRequest: request ? { index: request.index, failedChoice: request.failedChoice,
        prefixLength: request.prefixLength, kind: request.kind, rejectsWholeBranch: false } : null } : {}) }; },
  };
}

module.exports = { createBranchAgenda };
