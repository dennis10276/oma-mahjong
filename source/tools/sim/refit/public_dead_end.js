'use strict';
const assert = require('assert/strict');
const physical = require('./known_tray_plan.js');

function keyOf(state) {
  return state.alive.join('') + '|' + state.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + state.openPeek + '|' + state.moves + '|' + +state.relieved + '|' + (state.arriving || []).join(',');
}

function analyze(game, state, actions, nodeLimit = 128, deadline = Infinity) {
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  physical.featuresOf(game, state, [], { taps: 1, nodes: 1, progress: 1 });
  assert(Array.isArray(actions) && actions.length > 0);
  const allowed = physical.legal(game, state).free, roots = new Set(actions.map(action => action.index));
  assert([...roots].every(index => allowed.includes(index)));
  const queue = [{ state, path: [] }], seen = new Set(allowed.every(index => roots.has(index)) ? [keyOf(state)] : []); let lossPath = null, nodes = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (nodes >= nodeLimit || Date.now() >= deadline) return { knownDead: false, reason: 'bounded', nodes, lossPath: null };
    const node = queue[cursor]; nodes++;
    for (const index of physical.legal(game, node.state).free.filter(index => node.path.length || roots.has(index))) {
      if (Date.now() >= deadline) return { knownDead: false, reason: 'bounded', nodes, lossPath: null };
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

function analyzeContinuation(game, state, actions, nodeLimit = 128, deadline = Infinity) {
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  physical.featuresOf(game, state, [], { taps: 1, nodes: 1, progress: 1 });
  const allowed = physical.legal(game, state).free, roots = new Set(actions.map(action => action.index));
  assert(actions.length && roots.size === actions.length && [...roots].every(index => allowed.includes(index)));
  const queue = [{ state, path: [] }], seen = new Set(allowed.every(index => roots.has(index)) ? [keyOf(state)] : []); let lossPath = null, transitions = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (cursor >= nodeLimit || Date.now() >= deadline) return { knownDead: false, reason: 'bounded', nodes: cursor, transitions, path: null };
    const node = queue[cursor];
    if (!node.state.alive.some(Boolean) && !node.state.tray.length) return { knownDead: false, reason: 'knownWin', nodes: cursor + 1, transitions, path: node.path };
    for (const index of physical.legal(game, node.state).free.filter(index => node.path.length || roots.has(index))) {
      if (Date.now() >= deadline) return { knownDead: false, reason: 'bounded', nodes: cursor + 1, transitions, path: null };
      const moved = physical.advance(game, node.state, index), path = node.path.concat(index); transitions++;
      if (moved.uncertain) return { knownDead: false, reason: moved.reason === 'unseenPicture' ? 'reachableInformation' : 'unsupportedTransition',
        nodes: cursor + 1, transitions, path };
      if (moved.lost) { if (!lossPath) lossPath = path; continue; }
      if (moved.win) return { knownDead: false, reason: 'knownWin', nodes: cursor + 1, transitions, path };
      const key = keyOf(moved.state);
      if (!seen.has(key)) { seen.add(key); queue.push({ state: moved.state, path }); }
    }
  }
  return { knownDead: true, reason: 'exhaustedKnownContinuationGraph', nodes: queue.length, transitions, path: lossPath,
    certificate: { reachableUnknown: false, knownWinningRoute: false, unsupportedTransition: false, budgetBoundary: false,
      includesSafeRemovalsAndInspections: true, allRequestedRoots: [...roots] },
    note: 'Every safe known continuation, including removal sequences and inspection cycles, was exhausted. '
      + 'No winning or information frontier is reachable under this public physical model. Unknowns, unsupported transitions and limits never become a death certificate.' };
}

module.exports = { keyOf, analyze, analyzeContinuation };
