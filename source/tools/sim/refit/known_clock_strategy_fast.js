'use strict';
const L = require('../../../www/layouts.js');
const reference = require('./known_tray_plan.js');
const original = require('./known_clock_strategy.js');
const { frontierOf } = require('./known_clock_dig.js');
const { FEATURES, PARAMETERS } = original;

function featuresOf(game, state, actions, options = PARAMETERS) {
  const taps = options.taps ?? PARAMETERS.taps, nodeLimit = options.nodes ?? PARAMETERS.nodes;
  reference.featuresOf(game, state, [], { taps, nodes: nodeLimit, progress: 4 });
  if (!Array.isArray(actions) || actions.some(action => !Number.isInteger(action.index)
    || action.index < 0 || action.index >= state.alive.length)) throw new Error('Invalid clock-strategy actions');
  if (!game.clock || !state.alive[game.clock.i]) return {
    features: actions.map(() => FEATURES.map(() => 0)), nodes: 0, boundaries: 0, inactive: 'noActiveClock' };
  const initial = { ...state, left: state.alive.reduce((total, value) => total + value, 0), aliveKey: state.alive.join('') };
  const legalCache = new Map();
  const legalAt = position => {
    const key = position.aliveKey + '|' + +position.relieved + '|' + +(position.tray.length < L.SLOTS);
    if (!legalCache.has(key)) legalCache.set(key, reference.legal(game, position));
    return legalCache.get(key);
  };
  const advance = (position, index, allowed = legalAt(position)) => {
    if (!allowed.free.includes(index)) throw new Error('Known-only planner selected a blocked tile');
    const face = position.pictures[index];
    if (face === null) return { uncertain: true, reason: 'unseenPicture' };
    const next = { alive: position.alive.slice(), pictures: position.pictures, down: position.down, tray: position.tray.slice(),
      moves: position.moves, openPeek: position.openPeek, relieved: allowed.relieved, arriving: [], left: position.left, aliveKey: position.aliveKey };
    const peek = position.openPeek, twinOpen = peek >= 0 && peek !== index && position.alive[peek]
      && allowed.free.includes(peek) && position.pictures[peek] === face && !position.tray.includes(face);
    if (position.down[index] && peek !== index && !position.tray.includes(face) && !twinOpen) {
      next.openPeek = index;
      return { state: next, removed: 0, win: false, lost: false };
    }
    const waiting = position.tray.indexOf(face), joker = position.tray.indexOf(101);
    const jokerReady = !(position.arriving || []).includes(101);
    if (face === 101 && waiting < 0 && !twinOpen && position.tray.length
      || face !== 101 && waiting < 0 && !twinOpen && joker >= 0 && jokerReady) return { uncertain: true, reason: 'automaticJokerTwin' };
    const finale = face === 101 && position.left === 1 && !position.tray.length;
    let removed = 0;
    const remove = (target, countsMove = true) => {
      next.alive[target] = 0; next.left--; removed++;
      next.moves += +countsMove;
      if (next.openPeek === target) next.openPeek = -1;
    };
    remove(index, !finale);
    if (waiting >= 0) next.tray.splice(waiting, 1);
    else if (twinOpen) remove(peek);
    else if (!(face === 101 && !next.left && !position.tray.length)) next.tray.push(face);
    next.aliveKey = next.alive.join('');
    const lost = next.tray.length >= L.SLOTS || !!(game.clock && next.alive[game.clock.i] && next.moves >= game.clock.n);
    return { state: next, removed, lost, win: !next.left && next.tray.length === 0 };
  };
  const exitOf = position => ({ found: true, two: position.tray.length <= 2,
    threeMatch: position.tray.length === 3 && legalAt(position).free.some(index =>
      position.pictures[index] !== null && position.tray.includes(position.pictures[index])),
    room: (4 - position.tray.length) / 4, pair: false, trap: false, information: false, boundary: false });
  const available = legalAt(initial);
  if (actions.some(action => !available.free.includes(action.index))) throw new Error('Clock-strategy action is blocked');
  const frontier = frontierOf(game, state), byIndex = new Map();
  const keyOf = position => position.aliveKey + '|' + position.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + position.openPeek + '|' + position.moves + '|' + +position.relieved;
  const paired = (before, moved) => moved.removed > 1 || moved.state.tray.length < before.tray.length;
  const empty = () => ({ found: false, two: false, threeMatch: false, room: 0, pair: false, trap: true, information: false, boundary: false });
  let totalNodes = 0, boundaries = 0;
  for (const rootIndex of [...new Set(actions.map(action => action.index))].sort((left, right) => left - right)) {
    let nodes = 0;
    const visiting = new Set();
    const search = (position, remainingTaps) => {
      if (!position.alive[game.clock.i]) return exitOf(position);
      const allowed = legalAt(position), settled = { ...position, relieved: allowed.relieved };
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
        const moved = advance(settled, index, allowed);
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
    const moved = advance(initial, rootIndex, available);
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

module.exports = { FEATURES, PARAMETERS, featuresOf };
