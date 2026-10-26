'use strict';
const assert = require('assert/strict');
const { aliveSignature } = require('./public_alive_signature.js');

function createRetryRiskMemory(clock = null) {
  assert(clock === null || Number.isInteger(clock.i) && clock.i >= 0 && Number.isInteger(clock.n) && clock.n > 0);
  const clockIndex = clock?.i ?? -1, risks = new Map();
  let transitions = [];
  const identity = state => aliveSignature(state.alive) + '|' + state.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + state.openPeek + '|' + +!!state.relieved + '|' + (clockIndex >= 0 && state.alive[clockIndex] ? state.moves : '-')
    + '|' + (state.arriving || []).slice().sort((left, right) => left - right).join(',');
  return {
    beginAttempt() { transitions = []; },
    observeTransition(before, index, after) {
      assert(Number.isInteger(index) && before.alive[index] === 1);
      assert.equal(after.physicalTaps, before.physicalTaps + 1, 'Learn only an actual accepted physical tap');
      assert.equal(before.alive.length, after.alive.length);
      assert(after.alive.every((alive, target) => alive === 0 || alive === 1 && before.alive[target] === 1));
      transitions.push({ identity: identity(before), index, beforeTray: before.tray.length, afterTray: after.tray.length });
    },
    finish(status) {
      assert(['physicalLoss', 'cleared', 'unresolvedBudget', 'unresolvedPublicFrontier', 'unresolved'].includes(status));
      let risk = null;
      if (status === 'physicalLoss') for (const transition of transitions) {
        if (transition.afterTray < 3) risk = null;
        else if (transition.beforeTray < 3 && transition.afterTray === 3) risk = transition;
      }
      transitions = [];
      if (!risk) return null;
      const signature = risk.identity + '|root:' + risk.index;
      const penalty = Math.min(3, (risks.get(signature)?.penalty ?? 0) + 1);
      risks.set(signature, { identity: risk.identity, index: risk.index, penalty });
      return { index: risk.index, penalty };
    },
    cost(state, index) { return risks.get(identity(state) + '|root:' + index)?.penalty ?? 0; },
    entries() { return [...risks.values()].map(entry => ({ ...entry })); },
  };
}

function createFailedRouteMemory(clock = null) {
  assert(clock === null || Number.isInteger(clock.i) && clock.i >= 0 && Number.isInteger(clock.n) && clock.n > 0);
  const contexts = new Map();
  let transitions = [], startingKnowledge = null, active = false;
  const validateKnowledge = knowledge => assert(typeof knowledge === 'string' && knowledge.length > 0);
  const identity = state => aliveSignature(state.alive) + '|' + JSON.stringify([
    state.tray.slice().sort((left, right) => left - right), state.openPeek, !!state.relieved,
    clock && state.alive[clock.i] ? state.moves : null, state.arriving ?? []]);
  return {
    beginAttempt(knowledge) {
      assert(!active); validateKnowledge(knowledge);
      transitions = []; startingKnowledge = knowledge; active = true;
    },
    observeTransition(before, index, after) {
      assert(active && Number.isInteger(index) && before.alive[index] === 1);
      assert.equal(after.physicalTaps, before.physicalTaps + 1);
      assert.equal(before.alive.length, after.alive.length);
      assert(after.alive.every((alive, target) => alive === 0 || alive === 1 && before.alive[target] === 1));
      transitions.push({ identity: identity(before), index });
    },
    finish(status, knowledge) {
      assert(['physicalLoss', 'cleared', 'unresolvedBudget', 'unresolvedPublicFrontier', 'unresolved'].includes(status));
      validateKnowledge(knowledge);
      if (!active) return 0;
      active = false;
      let learned = 0;
      if (status === 'physicalLoss' && knowledge === startingKnowledge) {
        if (!contexts.has(knowledge)) contexts.set(knowledge, new Map());
        const preferences = contexts.get(knowledge), seen = new Set();
        for (const transition of transitions) {
          const signature = transition.identity + '|root:' + transition.index;
          if (seen.has(signature)) continue;
          seen.add(signature);
          const penalty = Math.min(3, (preferences.get(signature)?.penalty ?? 0) + 1);
          preferences.set(signature, { ...transition, penalty }); learned++;
        }
      }
      transitions = [];
      return learned;
    },
    cost(state, index, knowledge) {
      validateKnowledge(knowledge);
      return contexts.get(knowledge)?.get(identity(state) + '|root:' + index)?.penalty ?? 0;
    },
    entries() {
      return [...contexts].flatMap(([knowledge, preferences]) => [...preferences.values()].map(entry => ({
        ...entry, knowledge, kind: 'failedRoutePreference', provedLoss: false })));
    },
  };
}

module.exports = { createRetryRiskMemory, createFailedRouteMemory };
