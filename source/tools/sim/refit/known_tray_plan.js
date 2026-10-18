'use strict';
const L = require('../../../www/layouts.js');
const FEATURES = ['knownProgress', 'knownTrayClear', 'knownTrap', 'informationReachable', 'planningBoundary'];

function validate(game, state) {
  const size = game.tiles.length;
  if (!Number.isInteger(size) || size < 1 || !game.nb || state.alive.length !== size || state.pictures.length !== size
    || state.down.length !== size || !Number.isInteger(state.moves) || state.moves < 0
    || !Number.isInteger(state.openPeek) || state.openPeek < -1 || state.openPeek >= size
    || !Array.isArray(state.tray) || state.tray.length > L.SLOTS
    || state.alive.some(value => value !== 0 && value !== 1)
    || state.down.some(value => value !== 0 && value !== 1)
    || state.pictures.some(value => value !== null && (!Number.isInteger(value) || value < 0 || value > 101))
    || state.tray.some(value => !Number.isInteger(value) || value < 0 || value > 101)
    || state.openPeek >= 0 && (!state.alive[state.openPeek] || !state.down[state.openPeek] || state.pictures[state.openPeek] === null)) {
    throw new Error('Invalid known-only planning state');
  }
}

function legal(game, state) {
  const initial = state.alive.map(() => 1), rules = state.relieved ? null : game.rules;
  let free = state.alive.flatMap((value, index) => value && (rules ? L.takeable(index, state.alive, game.nb, rules, initial)
    : L.isFree(index, state.alive, game.nb)) ? [index] : []);
  let relieved = !!state.relieved;
  if (!free.length && rules && state.tray.length < L.SLOTS) {
    free = state.alive.flatMap((value, index) => value && L.isFree(index, state.alive, game.nb) ? [index] : []);
    if (free.length) relieved = true;
  }
  return { free, relieved };
}

function advance(game, state, index) {
  const allowed = legal(game, state);
  if (!allowed.free.includes(index)) throw new Error('Known-only planner selected a blocked tile');
  const face = state.pictures[index];
  if (face === null) return { uncertain: true, reason: 'unseenPicture' };
  const next = { alive: state.alive.slice(), pictures: state.pictures, down: state.down,
    tray: state.tray.slice(), moves: state.moves, openPeek: state.openPeek, relieved: allowed.relieved, arriving: [] };
  const peek = state.openPeek, twinOpen = peek >= 0 && peek !== index && state.alive[peek]
    && allowed.free.includes(peek) && state.pictures[peek] === face && !state.tray.includes(face);
  if (state.down[index] && peek !== index && !state.tray.includes(face) && !twinOpen) {
    next.openPeek = index;
    return { state: next, removed: 0, win: false, lost: false };
  }
  const waiting = state.tray.indexOf(face), joker = state.tray.indexOf(101);
  const jokerReady = !(state.arriving || []).includes(101);
  if (face === 101 && waiting < 0 && !twinOpen && state.tray.length
    || face !== 101 && waiting < 0 && !twinOpen && joker >= 0 && jokerReady) {
    return { uncertain: true, reason: 'automaticJokerTwin' };
  }
  const finale = face === 101 && state.alive.reduce((total, value) => total + value, 0) === 1 && !state.tray.length;
  const remove = (target, countsMove = true) => {
    next.alive[target] = 0;
    next.moves += +countsMove;
    if (next.openPeek === target) next.openPeek = -1;
  };
  remove(index, !finale);
  if (waiting >= 0) next.tray.splice(waiting, 1);
  else if (twinOpen) remove(peek);
  else if (!(face === 101 && !next.alive.some(Boolean) && !state.tray.length)) next.tray.push(face);
  const lost = next.tray.length >= L.SLOTS || !!(game.clock && next.alive[game.clock.i] && next.moves >= game.clock.n);
  return { state: next, removed: state.alive.reduce((total, value, index) => total + +(value && !next.alive[index]), 0), lost,
    win: !next.alive.some(Boolean) && next.tray.length === 0 };
}

function stateKey(state, taps) {
  return state.alive.join('') + '|' + state.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + state.openPeek + '|' + state.moves + '|' + +state.relieved + '|' + taps;
}

function featuresOf(game, state, actions, options = {}) {
  validate(game, state);
  const taps = options.taps ?? 6, nodeLimit = options.nodes ?? 256, progressTarget = options.progress ?? 4;
  if (!Number.isInteger(taps) || taps < 1 || taps > 12 || !Number.isInteger(nodeLimit) || nodeLimit < 1
    || !Number.isInteger(progressTarget) || progressTarget < 1) throw new Error('Invalid known-only planning budget');
  if (!Array.isArray(actions) || actions.some(action => !Number.isInteger(action.index)
    || action.index < 0 || action.index >= state.alive.length)) throw new Error('Invalid known-only candidate actions');
  const activeClock = !!(game.clock && state.alive[game.clock.i]);
  if (activeClock) return { features: actions.map(() => FEATURES.map(() => 0)), nodes: 0, boundaries: 0, inactive: 'activeClock' };
  const available = legal(game, state);
  if (actions.some(action => !available.free.includes(action.index))) throw new Error('Planning candidate is not physically free');
  let totalNodes = 0, boundaries = 0;
  const memo = new Map(), byIndex = new Map();
  for (const rootIndex of [...new Set(actions.map(action => action.index))].sort((left, right) => left - right)) {
    let nodes = 0;
    const search = (position, remainingTaps) => {
      if (position.tray.length >= L.SLOTS) return { progress: 0, clear: false, dead: true, information: false, boundary: false };
      const allowed = legal(game, position), settled = { ...position, relieved: allowed.relieved };
      const key = stateKey(settled, remainingTaps);
      if (memo.has(key)) return memo.get(key);
      const clear = !settled.tray.length && settled.moves > state.moves;
      const terminal = !settled.alive.some(Boolean);
      if (terminal) return { progress: 0, clear, dead: !clear, information: false, boundary: false };
      const information = allowed.free.some(index => settled.pictures[index] === null);
      if (!remainingTaps || nodes >= nodeLimit) return { progress: 0, clear, dead: false, information, boundary: true };
      nodes++;
      const known = allowed.free.filter(index => settled.pictures[index] !== null);
      const priority = index => settled.tray.includes(settled.pictures[index]) ? 0
        : settled.openPeek >= 0 && index !== settled.openPeek && settled.pictures[index] === settled.pictures[settled.openPeek] ? 1
          : index === settled.openPeek ? 2 : 3;
      known.sort((left, right) => priority(left) - priority(right) || left - right);
      let best = { progress: 0, clear, dead: !information && !clear, information, boundary: false };
      for (const index of known) {
        const moved = advance(game, settled, index);
        if (moved.uncertain) { best.information = true; best.dead = false; continue; }
        if (moved.lost) continue;
        let transitions = [{ ...moved, cost: 1 }];
        if (!moved.removed) {
          if (remainingTaps < 2) { best.boundary = true; best.dead = false; continue; }
          const mates = legal(game, moved.state).free.filter(mate => mate !== index
            && moved.state.pictures[mate] === moved.state.pictures[index]);
          transitions = (mates.length ? mates : [index]).map(next => ({ ...advance(game, moved.state, next), cost: 2 }));
        }
        for (const transition of transitions) {
          if (transition.uncertain) { best.information = true; best.dead = false; continue; }
          if (transition.lost) continue;
          const child = transition.win ? { progress: 0, clear: true, dead: false, information: false, boundary: false }
            : search(transition.state, remainingTaps - transition.cost);
          best.progress = Math.max(best.progress, transition.removed + child.progress);
          best.clear ||= child.clear;
          best.information ||= child.information;
          best.boundary ||= child.boundary;
          best.dead &&= child.dead;
        }
        if (best.progress >= progressTarget) break;
      }
      if (!best.boundary) memo.set(key, best);
      return best;
    };
    const moved = advance(game, state, rootIndex);
    let value;
    if (moved.uncertain) value = { progress: 0, clear: false, dead: false, information: true, boundary: false };
    else if (moved.lost) value = { progress: 0, clear: false, dead: true, information: false, boundary: false };
    else {
      value = moved.win ? { progress: 0, clear: true, dead: false, information: false, boundary: false }
        : search(moved.state, taps - 1);
      value = { ...value, progress: value.progress + moved.removed };
    }
    totalNodes += nodes;
    boundaries += +value.boundary;
    byIndex.set(rootIndex, [Math.min(progressTarget, value.progress) / progressTarget, +value.clear, +value.dead, +value.information, +value.boundary]);
  }
  const features = actions.map(action => byIndex.get(action.index));
  return { features, nodes: totalNodes, boundaries, inactive: null };
}

module.exports = { FEATURES, legal, advance, featuresOf };
