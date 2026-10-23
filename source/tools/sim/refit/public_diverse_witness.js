'use strict';
const assert = require('assert/strict');

function diverseWitnessSearch(search) {
  return (game, state, actions, settings = {}) => {
    const enabled = settings.diverseWitness ?? false;
    assert.equal(typeof enabled, 'boolean');
    assert(!enabled || !settings.diverseBeam, 'A witness portfolio must retain the original primary beam');
    const primary = search(game, state, actions, settings);
    const limit = settings.nodes ?? 1024, remaining = limit - primary.nodes;
    if (!enabled || primary.knownWin || primary.safeClockExit || primary.knownDead || remaining <= 0
      || Date.now() >= (settings.deadline ?? Infinity)) return primary;
    const alternative = search(game, state, actions, { ...settings, diverseWitness: false, diverseBeam: true, nodes: remaining });
    assert(alternative.nodes <= remaining);
    const selected = alternative.knownWin || alternative.safeClockExit ? alternative : primary;
    const proofs = [primary.continuationProof, alternative.continuationProof].filter(Boolean);
    return { ...selected, nodes: primary.nodes + alternative.nodes,
      prunedDeadSuccessors: (primary.prunedDeadSuccessors || 0) + (alternative.prunedDeadSuccessors || 0),
      ...(proofs.length ? { continuationProof: Object.fromEntries(['calls', 'nodes', 'bounded', 'certified']
        .map(key => [key, proofs.reduce((sum, proof) => sum + proof[key], 0)])) } : {}),
      diverseWitnessAudit: { selected: selected === alternative, primaryIndex: primary.index,
        primaryNodes: primary.nodes, alternativeNodes: alternative.nodes, sharedNodeLimit: limit,
        alternativeKnownWin: alternative.knownWin, alternativeSafeClockExit: alternative.safeClockExit } };
  };
}

module.exports = { diverseWitnessSearch };
