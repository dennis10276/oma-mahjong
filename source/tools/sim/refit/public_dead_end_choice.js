'use strict';
const assert = require('assert/strict');
const { analyze } = require('./public_dead_end.js');

function gate(base, planning, options = {}) {
  const enabled = options.enabled ?? true, nodes = options.nodes ?? 128;
  assert(typeof enabled === 'boolean' && typeof planning === 'function');
  assert(typeof base === 'function' && typeof base.probabilities === 'function' && typeof base.observe === 'function');
  const stats = { proofs: 0, proofNodes: 0, knownDead: 0, overrides: 0, bounded: 0, unresolvedLossPath: 0 };
  if (!enabled) return { selector: base, planning, stats: () => ({ ...stats }) };
  let current = null;
  const plan = (game, state, actions) => {
    const result = planning(game, state, actions), proof = analyze(game, state, actions, nodes);
    const forced = proof.knownDead && proof.lossPath?.length ? actions.findIndex(action => action.index === proof.lossPath[0]) : -1;
    current = { proof, forced, alternatives: actions.length };
    stats.proofs++; stats.proofNodes += proof.nodes; stats.knownDead += +proof.knownDead;
    stats.bounded += +(proof.reason === 'bounded'); stats.unresolvedLossPath += +(proof.knownDead && forced < 0);
    return result;
  };
  const check = decision => {
    assert.equal(decision.observationVersion, 1, 'Dead-end acknowledgement requires the public observer');
    assert(current && current.alternatives === decision.F.length);
  };
  const choose = (decision, draw) => {
    check(decision);
    if (current.forced < 0) return base(decision, draw);
    base.observe(decision, current.forced); stats.overrides++; return current.forced;
  };
  choose.probabilities = decision => {
    check(decision);
    return current.forced < 0 ? base.probabilities(decision) : decision.F.map((feature, index) => +(index === current.forced));
  };
  choose.observe = (decision, selected) => { check(decision); base.observe(decision, selected); };
  choose.posterior = base.posterior; choose.physicalTrayPlanning = plan;
  return { selector: choose, planning: plan, stats: () => ({ ...stats }) };
}

function factory(makeBase, planning, options = {}) {
  let active = null; const completed = [];
  const create = context => {
    if (active) completed.push(active.stats());
    active = gate(makeBase(context), planning, options); return active.selector;
  };
  create.physicalTrayPlanning = (...args) => { assert(active); return active.planning(...args); };
  create.stats = () => completed.concat(active ? [active.stats()] : []);
  return create;
}

module.exports = { gate, factory };
