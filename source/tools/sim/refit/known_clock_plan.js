'use strict';
const reference = require('./known_tray_plan.js');
const FEATURES = ['knownClockRoute', 'foundExitRoom', 'knownClockTrap', 'clockInformation', 'clockBoundary'];
const PARAMETERS = Object.freeze({ taps: 12, nodes: 256 });

function featuresOf(game, state, actions, options = PARAMETERS) {
  const taps = options.taps ?? PARAMETERS.taps, nodeLimit = options.nodes ?? PARAMETERS.nodes;
  reference.featuresOf(game, state, [], { taps, nodes: nodeLimit, progress: 4 });
  if (!Array.isArray(actions) || actions.some(action => !Number.isInteger(action.index)
    || action.index < 0 || action.index >= state.alive.length)) throw new Error('Invalid public clock actions');
  if (!game.clock || !state.alive[game.clock.i]) return {
    features: actions.map(() => FEATURES.map(() => 0)), nodes: 0, boundaries: 0, inactive: 'noActiveClock' };
  const available = reference.legal(game, state);
  if (actions.some(action => !available.free.includes(action.index))) throw new Error('Clock action is not physically free');
  const frontier = new Set([game.clock.i]), pending = [game.clock.i];
  while (pending.length) for (const above of game.nb.above[pending.pop()]) if (state.alive[above] && !frontier.has(above)) {
    frontier.add(above); pending.push(above);
  }
  const keyOf = position => position.alive.join('') + '|' + position.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + position.openPeek + '|' + position.moves + '|' + +position.relieved;
  let totalNodes = 0, boundaries = 0;
  const byIndex = new Map();
  for (const rootIndex of [...new Set(actions.map(action => action.index))].sort((left, right) => left - right)) {
    let nodes = 0;
    const visiting = new Set(), memo = new Map();
    const search = (position, remainingTaps) => {
      if (!position.alive[game.clock.i]) return { found: true, room: (4 - position.tray.length) / 4,
        trap: false, information: false, boundary: false };
      const allowed = reference.legal(game, position), settled = { ...position, relieved: allowed.relieved };
      const identity = keyOf(settled), key = identity + '|' + remainingTaps;
      if (memo.has(key)) return memo.get(key);
      if (visiting.has(identity)) return { found: false, room: 0, trap: true, information: false, boundary: false };
      const information = allowed.free.some(index => settled.pictures[index] === null);
      if (!remainingTaps || nodes >= nodeLimit) return { found: false, room: 0, trap: false, information, boundary: true };
      nodes++; visiting.add(identity);
      const known = allowed.free.filter(index => settled.pictures[index] !== null);
      const priority = index => index === game.clock.i ? 0 : settled.tray.includes(settled.pictures[index]) ? 1
        : frontier.has(index) ? 2 : settled.openPeek >= 0 && settled.pictures[index] === settled.pictures[settled.openPeek] ? 3 : 4;
      known.sort((left, right) => priority(left) - priority(right) || left - right);
      const best = { found: false, room: 0, trap: !information, information, boundary: false };
      for (const index of known) {
        const moved = reference.advance(game, settled, index);
        if (moved.uncertain) { best.information = true; best.trap = false; continue; }
        if (moved.lost) continue;
        const child = search(moved.state, remainingTaps - 1);
        best.found ||= child.found;
        best.room = Math.max(best.room, child.room);
        best.trap &&= child.trap;
        best.information ||= child.information;
        best.boundary ||= child.boundary;
        if (best.found) break;
      }
      visiting.delete(identity);
      if (!best.boundary && !best.trap) memo.set(key, best);
      return best;
    };
    const moved = reference.advance(game, state, rootIndex);
    const value = moved.uncertain ? { found: false, room: 0, trap: false, information: true, boundary: false }
      : moved.lost ? { found: false, room: 0, trap: true, information: false, boundary: false }
        : search(moved.state, taps - 1);
    totalNodes += nodes;
    boundaries += +value.boundary;
    byIndex.set(rootIndex, [+value.found, value.room, +value.trap, +value.information, +value.boundary]);
  }
  return { features: actions.map(action => byIndex.get(action.index)), nodes: totalNodes, boundaries, inactive: null };
}

module.exports = { FEATURES, PARAMETERS, featuresOf };
