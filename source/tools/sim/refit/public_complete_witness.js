'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');
const { aliveSignature } = require('./public_alive_signature.js');

function completeWitness(game, initial, roots, options = {}) {
  const deadline = options.deadline ?? Date.now() + 250, nodeLimit = options.nodes ?? 2000, maxTaps = options.taps ?? 256;
  assert(Number.isFinite(deadline));
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  assert(Number.isInteger(maxTaps) && maxTaps > 0 && maxTaps <= 512);
  assert(Array.isArray(roots) && roots.every(action => Number.isInteger(action.index)));
  if (initial.alive.some((alive, index) => alive && (initial.pictures[index] === null || initial.down[index] === null))) {
    return { path: null, nodes: 0, boundary: true, reason: 'incomplete_public_memory' };
  }
  const allowedRoots = new Set(roots.map(action => action.index)), visited = new Map();
  const clockCone = new Set(game.clock ? [game.clock.i] : []);
  for (const index of clockCone) for (const above of game.nb.above[index]) clockCone.add(above);
  let nodes = 0, boundary = false, reason = 'no_complete_known_witness';
  const stopped = () => {
    if (Date.now() >= deadline) { boundary = true; reason = 'deadline'; return true; }
    if (nodes >= nodeLimit) { boundary = true; reason = 'node_limit'; return true; }
    return false;
  };
  const key = state => aliveSignature(state.alive) + '|' + JSON.stringify([state.tray, state.openPeek,
    !!state.relieved, state.arriving ?? [], game.clock && state.alive[game.clock.i] ? state.moves : 0]);
  function visit(state, path) {
    if (stopped()) return null;
    if (!state.alive.some(Boolean) && state.tray.length === 0) return path;
    if (path.length >= maxTaps) { boundary = true; reason = 'tap_limit'; return null; }
    const identity = key(state), previous = visited.get(identity);
    if (previous !== undefined && previous <= path.length) return null;
    visited.set(identity, path.length); nodes++;
    const allowed = legal(game, state), candidates = [], clockOn = !!(game.clock && state.alive[game.clock.i]);
    for (const index of allowed.free) {
      if (stopped()) break;
      if (!path.length && !allowedRoots.has(index)) continue;
      const moved = advance(game, state, index);
      if (moved.uncertain) { boundary = true; continue; }
      if (moved.lost) continue;
      candidates.push({ index, moved, rank: [+(clockOn && !moved.state.alive[game.clock.i]),
        +(clockOn && clockCone.has(index)), moved.removed, -moved.state.tray.length] });
    }
    candidates.sort((left, right) => {
      for (let index = 0; index < left.rank.length; index++) if (left.rank[index] !== right.rank[index]) return right.rank[index] - left.rank[index];
      return 0;
    });
    for (const candidate of candidates) {
      if (stopped()) break;
      const found = visit(candidate.moved.state, path.concat(candidate.index));
      if (found) return found;
    }
    return null;
  }
  const found = visit(initial, []);
  return { path: found, nodes, boundary: found ? false : boundary, reason: found ? 'complete_known_win' : reason };
}

module.exports = { completeWitness };
