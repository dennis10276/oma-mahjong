'use strict';
const reference = require('./known_tray_plan.js');
const { frontierOf } = require('./known_clock_dig.js');
const FEATURES = ['clockRoute', 'clockExitTwo', 'clockExitThreeMatch', 'foundExitRoom', 'knownClockTrap',
  'clockInformation', 'pairBeforeClock', 'clockDigRemoval', 'clockDigInspection', 'urgentClockDig', 'pressuredClockDig', 'clockBoundary'];
const PARAMETERS = Object.freeze({ taps: 12, nodes: 256 });

function exitOf(game, state) {
  const ready = state.tray.length === 3 && reference.legal(game, state).free.some(index =>
    state.pictures[index] !== null && state.tray.includes(state.pictures[index]));
  return { found: true, two: state.tray.length <= 2, threeMatch: ready, room: (4 - state.tray.length) / 4,
    pair: false, trap: false, information: false, boundary: false };
}

function featuresOf(game, state, actions, options = PARAMETERS) {
  const taps = options.taps ?? PARAMETERS.taps, nodeLimit = options.nodes ?? PARAMETERS.nodes;
  reference.featuresOf(game, state, [], { taps, nodes: nodeLimit, progress: 4 });
  if (!Array.isArray(actions) || actions.some(action => !Number.isInteger(action.index)
    || action.index < 0 || action.index >= state.alive.length)) throw new Error('Invalid clock-strategy actions');
  if (!game.clock || !state.alive[game.clock.i]) return {
    features: actions.map(() => FEATURES.map(() => 0)), nodes: 0, boundaries: 0, inactive: 'noActiveClock' };
  const available = reference.legal(game, state);
  if (actions.some(action => !available.free.includes(action.index))) throw new Error('Clock-strategy action is blocked');
  const frontier = frontierOf(game, state), byIndex = new Map();
  const keyOf = position => position.alive.join('') + '|' + position.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + position.openPeek + '|' + position.moves + '|' + +position.relieved;
  const paired = (before, moved) => moved.removed > 1 || moved.state.tray.length < before.tray.length;
  const empty = () => ({ found: false, two: false, threeMatch: false, room: 0, pair: false,
    trap: true, information: false, boundary: false });
  let totalNodes = 0, boundaries = 0;
  for (const rootIndex of [...new Set(actions.map(action => action.index))].sort((left, right) => left - right)) {
    let nodes = 0;
    const visiting = new Set();
    const search = (position, remainingTaps) => {
      if (!position.alive[game.clock.i]) return exitOf(game, position);
      const allowed = reference.legal(game, position), settled = { ...position, relieved: allowed.relieved };
      const identity = keyOf(settled), best = empty();
      if (visiting.has(identity)) return best;
      best.information = allowed.free.some(index => settled.pictures[index] === null);
      best.trap = !best.information;
      if (!remainingTaps || nodes >= nodeLimit) return { ...best, trap: false, boundary: true };
      nodes++; visiting.add(identity);
      const known = allowed.free.filter(index => settled.pictures[index] !== null);
      const priority = index => settled.tray.includes(settled.pictures[index]) ? 0 : index === game.clock.i ? 1
        : frontier.has(index) ? 2 : settled.openPeek >= 0 && settled.pictures[index] === settled.pictures[settled.openPeek] ? 3 : 4;
      known.sort((left, right) => priority(left) - priority(right) || left - right);
      for (const index of known) {
        const moved = reference.advance(game, settled, index);
        if (moved.uncertain) { best.information = true; best.trap = false; continue; }
        if (moved.lost) continue;
        const child = search(moved.state, remainingTaps - 1);
        best.found ||= child.found; best.two ||= child.two; best.threeMatch ||= child.threeMatch;
        best.room = Math.max(best.room, child.room);
        best.pair ||= child.pair || !!(moved.state.alive[game.clock.i] && paired(settled, moved) && (child.two || child.threeMatch));
        best.trap &&= child.trap; best.information ||= child.information; best.boundary ||= child.boundary;
        if (best.two) break;
      }
      visiting.delete(identity);
      return best;
    };
    const moved = reference.advance(game, state, rootIndex);
    let value;
    if (moved.uncertain) value = { ...empty(), trap: false, information: true };
    else if (moved.lost) value = empty();
    else {
      value = search(moved.state, taps - 1);
      value = { ...value, pair: value.pair || !!(moved.state.alive[game.clock.i] && paired(state, moved) && (value.two || value.threeMatch)) };
    }
    const onFrontier = frontier.has(rootIndex), inspection = +(onFrontier && (moved.uncertain || !moved.removed));
    const removed = moved.uncertain ? 0 : [...frontier].reduce((total, index) => total + +(state.alive[index] && !moved.state.alive[index]), 0);
    const digging = +(inspection > 0 || removed > 0);
    byIndex.set(rootIndex, [+value.found, +value.two, +value.threeMatch, value.room, +value.trap,
      +value.information, +value.pair, Math.min(1, removed / 4), inspection,
      digging * Math.max(0, Math.min(1, state.moves / Math.max(1, game.clock.n))),
      digging * Math.min(1, state.tray.length / 3), +value.boundary]);
    totalNodes += nodes; boundaries += +value.boundary;
  }
  return { features: actions.map(action => byIndex.get(action.index)), nodes: totalNodes, boundaries, inactive: null };
}

module.exports = { FEATURES, PARAMETERS, exitOf, featuresOf };
