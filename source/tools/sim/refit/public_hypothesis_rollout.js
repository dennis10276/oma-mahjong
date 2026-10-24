'use strict';
const assert = require('assert/strict');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function searchHypothesisContinuation(game, state, actions, { nodeLimit, deadline }) {
  assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock'].includes(key)), 'Pass projected hypothesis geometry, never a private game');
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0 && nodeLimit <= 4096);
  assert(Number.isFinite(deadline));
  assert(state.pictures.every((picture, index) => !state.alive[index] || picture !== null));
  assert(state.down.every((value, index) => !state.alive[index] || value === 0 || value === 1));
  let nodes = 0;
  const stages = [];
  for (const beam of [1, 4]) {
    if (nodes >= nodeLimit || Date.now() >= deadline) break;
    const remaining = nodeLimit - nodes;
    const budget = beam === 1 ? Math.min(remaining, Math.max(1, Math.ceil(nodeLimit / 2))) : remaining;
    const planned = search(game, state, actions, { ...REFERENCE_PARAMETERS, nodes: budget, beam,
      knownPairMacros: true, progressiveReopens: true, cachePublicAnalysis: true,
      proofNodes: Math.min(32, budget), deadline, decisionMs: undefined });
    assert(Number.isInteger(planned.nodes) && planned.nodes >= 0 && planned.nodes <= budget);
    nodes += planned.nodes;
    stages.push({ beam, nodes: planned.nodes, constructedClear: planned.knownWin, certifiedLoss: planned.knownDead });
    if (planned.knownWin || planned.knownDead) return { kind: 'hypothesisContinuation',
      status: planned.knownWin ? 'cleared' : 'lost', path: planned.knownWin ? planned.path : [], nodes, stages,
      observedFact: false, productionVerified: false };
  }
  return { kind: 'hypothesisContinuation', status: 'unresolved', path: [], nodes, stages,
    observedFact: false, productionVerified: false };
}

module.exports = { searchHypothesisContinuation };
