'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');

function searchFilledPosition(game, initial, { nodeLimit = 4096, deadline, now = Date.now } = {}) {
  assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock'].includes(key)));
  assert(Number.isInteger(nodeLimit) && nodeLimit >= 1 && nodeLimit <= 32768 && Number.isFinite(deadline));
  assert.equal(typeof now, 'function');
  assert(initial.pictures.every((picture, index) => !initial.alive[index] || picture !== null));
  assert(initial.down.every((value, index) => !initial.alive[index] || value === 0 || value === 1));
  const key = state => JSON.stringify([state.alive, state.tray, state.moves, state.openPeek, !!state.relieved, state.arriving || []]);
  const startLeft = initial.alive.reduce((sum, alive) => sum + alive, 0);
  let nodes = 0, deepest = 0, unsupported = false;
  const visited = new Set(), stack = [{ state: initial, path: [], actions: null, offset: 0 }];
  const result = (status, path = []) => ({ kind: 'filledPositionSearch', status, path, nodes, deepest,
    exhaustive: status === 'lost', observedFact: false, productionVerified: false });
  const order = state => {
    const available = legal(game, state).free, free = new Set(available);
    const clockOn = game.clock && state.alive[game.clock.i], cone = new Set();
    if (clockOn) {
      const pending = [game.clock.i]; cone.add(game.clock.i);
      for (let cursor = 0; cursor < pending.length; cursor++) for (const above of game.nb.above[pending[cursor]]) {
        if (state.alive[above] && !cone.has(above)) { cone.add(above); pending.push(above); }
      }
    }
    const score = index => {
      const picture = state.pictures[index];
      const openMatch = state.openPeek >= 0 && state.openPeek !== index && free.has(state.openPeek)
        && state.pictures[state.openPeek] === picture && !state.tray.includes(picture);
      const paired = available.some(partner => partner !== index && state.pictures[partner] === picture);
      return +(state.tray.includes(picture)) * 1000 + +openMatch * 900
        + +(clockOn && index === game.clock.i) * 800 + +cone.has(index) * 300
        + +(paired && state.down[index] && state.openPeek !== index) * 200
        + +paired * 100 + +(game.rules?.keys?.includes(index)) * 10;
    };
    return available.map(index => ({ index, score: score(index) }))
      .sort((left, right) => right.score - left.score || left.index - right.index).map(row => row.index);
  };
  while (stack.length) {
    if (now() >= deadline) return result('unresolved');
    const frame = stack.at(-1);
    if (frame.actions === null) {
      if (nodes >= nodeLimit) return result('unresolved');
      nodes++; visited.add(key(frame.state));
      const left = frame.state.alive.reduce((sum, alive) => sum + alive, 0);
      deepest = Math.max(deepest, startLeft - left);
      if (!left && frame.state.tray.length === 0) return result('cleared', frame.path);
      if (frame.state.tray.length >= 4 || game.clock && frame.state.alive[game.clock.i] && frame.state.moves >= game.clock.n) {
        stack.pop(); continue;
      }
      frame.actions = order(frame.state);
    }
    if (frame.offset === frame.actions.length) { stack.pop(); continue; }
    const index = frame.actions[frame.offset++], moved = advance(game, frame.state, index);
    if (moved.uncertain) { unsupported = true; continue; }
    if (moved.lost) continue;
    if (moved.win) return result('cleared', frame.path.concat(index));
    if (!visited.has(key(moved.state))) stack.push({ state: moved.state, path: frame.path.concat(index), actions: null, offset: 0 });
  }
  return result(unsupported ? 'unresolved' : 'lost');
}

module.exports = { searchFilledPosition };
