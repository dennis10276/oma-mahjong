'use strict';
const assert = require('assert/strict');
const physical = require('./known_tray_plan.js');

function keyOf(state) {
  return state.alive.join('') + '|' + state.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + state.openPeek + '|' + state.moves + '|' + +state.relieved + '|' + (state.arriving || []).join(',');
}

function analyze(game, state, actions, nodeLimit = 128) {
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  physical.featuresOf(game, state, [], { taps: 1, nodes: 1, progress: 1 });
  assert(Array.isArray(actions) && actions.length > 0);
  const allowed = physical.legal(game, state).free, roots = new Set(actions.map(action => action.index));
  assert([...roots].every(index => allowed.includes(index)));
  const queue = [{ state, path: [] }], seen = new Set([keyOf(state)]); let lossPath = null, nodes = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (nodes >= nodeLimit) return { knownDead: false, reason: 'bounded', nodes, lossPath: null };
    const node = queue[cursor]; nodes++;
    for (const index of physical.legal(game, node.state).free.filter(index => node.path.length || roots.has(index))) {
      const moved = physical.advance(game, node.state, index), path = node.path.concat(index);
      if (moved.uncertain) return { knownDead: false, reason: moved.reason === 'unseenPicture' ? 'reachableInformation' : 'unsupportedTransition', nodes, lossPath: null };
      if (moved.lost) { if (!lossPath) lossPath = path; continue; }
      if (moved.removed > 0) return { knownDead: false, reason: 'safeRemoval', nodes, lossPath: null };
      const key = keyOf(moved.state);
      if (!seen.has(key)) { seen.add(key); queue.push({ state: moved.state, path }); }
    }
  }
  return { knownDead: true, reason: 'exhaustedInspectionOnlyGraph', nodes, lossPath,
    certificate: { reachableUnknown: false, safeRemoval: false, unsupportedTransition: false, budgetBoundary: false },
    note: 'Every non-losing reachable transition is a known inspection, so no unassisted route can change '
      + 'the board or acquire new information. This is a public physical dead-end proof, not an inference '
      + 'from a simulation timeout. lossPath is a real physical tap sequence, never a free reset.' };
}

module.exports = { keyOf, analyze };
