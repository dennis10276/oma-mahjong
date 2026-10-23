'use strict';
const assert = require('assert/strict');
const { featuresOf, legal, advance } = require('./known_tray_plan.js');

function knownRecovery(game, state, tapLimit = 2, deadline = Infinity) {
  assert(Number.isInteger(tapLimit) && tapLimit >= 1 && tapLimit <= 2);
  assert(deadline === Infinity || Number.isFinite(deadline));
  featuresOf(game, state, [], { taps: 1, nodes: 1, progress: 1 });
  if (Date.now() >= deadline) return null;
  const allowed = legal(game, state), firstMoves = [];
  for (const index of allowed.free) {
    if (Date.now() >= deadline) return null;
    const picture = state.pictures[index];
    if (picture === null || picture === 101 || allowed.uncertain?.includes(index)) continue;
    const moved = advance(game, state, index);
    if (moved.uncertain || moved.lost) continue;
    if (moved.removed > 0 && moved.state.tray.length < state.tray.length
      || moved.removed === 2 && moved.state.tray.length <= state.tray.length) {
      return { path: [index], state: moved.state, removed: moved.removed,
        kind: moved.removed === 2 ? 'openTwin' : 'trayMatch' };
    }
    firstMoves.push({ index, moved, picture });
  }
  if (tapLimit === 1) return null;
  for (const first of firstMoves) {
    if (Date.now() >= deadline) return null;
    const next = legal(game, first.moved.state);
    for (const mate of next.free) {
      if (Date.now() >= deadline) return null;
      if (mate === first.index || next.uncertain?.includes(mate) || state.pictures[mate] !== first.picture) continue;
      const paired = advance(game, first.moved.state, mate);
      if (paired.uncertain || paired.lost || first.moved.removed + paired.removed !== 2
        || paired.state.tray.length > state.tray.length) continue;
      return { path: [first.index, mate], state: paired.state, removed: 2, kind: 'knownPair' };
    }
  }
  return null;
}

module.exports = { knownRecovery };
