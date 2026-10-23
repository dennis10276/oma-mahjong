'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');

function keyRecoveryPath(game, state, firstIndex, tapLimit, deadline = Infinity) {
  assert(Number.isInteger(tapLimit) && tapLimit > 0 && tapLimit <= 96);
  assert(deadline === Infinity || Number.isFinite(deadline));
  const keys = game.rules?.keys;
  if (!Array.isArray(keys) || keys.length !== 2 || new Set(keys).size !== 2
    || !keys.includes(firstIndex) || !state.alive[firstIndex]) return null;
  const path = [];
  let position = state;
  const append = index => {
    if (path.length >= tapLimit || Date.now() >= deadline) return false;
    const allowed = legal(game, position);
    if (!allowed.free.includes(index) || allowed.uncertain?.includes(index)) return false;
    const moved = advance(game, position, index);
    if (moved.uncertain || moved.lost) return false;
    path.push(index); position = moved.state; return true;
  };
  if (!append(firstIndex)) return null;
  while (keys.some(index => position.alive[index])) {
    const allowed = legal(game, position);
    const candidates = keys.filter(index => position.alive[index] && allowed.free.includes(index) && !allowed.uncertain?.includes(index));
    const priority = index => position.tray.includes(position.pictures[index]) ? 0
      : position.openPeek >= 0 && position.openPeek !== index && position.pictures[position.openPeek] === position.pictures[index] ? 1
      : index === firstIndex ? 2 : 3;
    candidates.sort((left, right) => priority(left) - priority(right) || left - right);
    if (!candidates.length || !append(candidates[0])) return null;
  }
  for (;;) {
    const allowed = legal(game, position);
    const matches = allowed.free.filter(index => !allowed.uncertain?.includes(index)
      && position.pictures[index] !== null && position.tray.includes(position.pictures[index]));
    if (!matches.length) break;
    if (!append(matches[0])) return null;
  }
  if (path.length < 2 || position.tray.length > state.tray.length) return null;
  return { path, state: position, removed: state.alive.reduce((sum, alive, index) => sum + +(alive && !position.alive[index]), 0),
    knownKeysRemoved: keys.every(index => !position.alive[index]),
    note: 'One bounded known-only key/recovery candidate, not an exhaustive solver, safety claim for alternative routes or hidden-role inference.' };
}

module.exports = { keyRecoveryPath };
