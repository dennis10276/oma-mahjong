'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');

function knownHypothesisPrefix(game, state, proposed, { deadline, now = Date.now }) {
  assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure'].includes(key)));
  const size = game.tiles.length;
  assert(size > 0 && ['alive', 'pictures', 'down'].every(field => Array.isArray(state[field]) && state[field].length === size));
  assert(state.alive.every(value => value === 0 || value === 1));
  assert(state.pictures.every(value => value === null || Number.isInteger(value) && value >= 0 && value <= 101));
  assert(state.down.every(value => value === null || value === 0 || value === 1));
  assert(Array.isArray(state.tray) && state.tray.length <= 4 && state.tray.every(Number.isInteger));
  assert(Number.isInteger(state.moves) && state.moves >= 0);
  assert(Number.isInteger(state.openPeek) && state.openPeek >= -1 && state.openPeek < size);
  assert(Array.isArray(proposed) && proposed.length <= 4096);
  assert(proposed.every(index => Number.isInteger(index) && index >= 0 && index < game.tiles.length));
  assert(Number.isFinite(deadline) && typeof now === 'function');
  assert(game.publicExposure === undefined || typeof game.publicExposure === 'function');
  const signature = position => JSON.stringify(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving']
    .map(field => position[field]));
  let current = state, knownProgress = 0, stopReason = 'end', boundaryIndex = null, knownWin = false;
  const path = [], seen = new Set([signature(state)]);
  const finish = () => ({ kind: 'publicKnownPrefix', path, knownProgress, knownWin, stopReason, boundaryIndex,
    observedFact: false, sampledContinuationIsKnown: false });
  for (const index of proposed) {
    boundaryIndex = index;
    if (now() >= deadline) { stopReason = 'deadline'; return finish(); }
    if (!legal(game, current).free.includes(index)) { stopReason = 'illegal'; return finish(); }
    const moved = advance(game, current, index);
    if (moved.uncertain) { stopReason = 'uncertain'; return finish(); }
    if (moved.lost) { stopReason = 'lost'; return finish(); }
    const identity = signature(moved.state);
    if (seen.has(identity)) { stopReason = 'cycle'; return finish(); }
    if (now() >= deadline) { stopReason = 'deadline'; return finish(); }
    path.push(index); knownProgress += moved.removed; current = moved.state; seen.add(identity);
    if (moved.win) { knownWin = true; stopReason = 'win'; boundaryIndex = null; return finish(); }
    if (game.publicExposure?.(current).length) { stopReason = 'information'; boundaryIndex = null; return finish(); }
  }
  boundaryIndex = null;
  return finish();
}

module.exports = { knownHypothesisPrefix };
