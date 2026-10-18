'use strict';
const L = require('../../../www/layouts.js');
const reference = require('./known_tray_plan.js');
const { FEATURES } = reference;

function featuresOf(game, state, actions, options = {}) {
  const checked = reference.featuresOf(game, state, [], options);
  if (!Array.isArray(actions) || actions.some(action => !Number.isInteger(action.index)
    || action.index < 0 || action.index >= state.alive.length)) throw new Error('Invalid known-only candidate actions');
  if (checked.inactive) return { features: actions.map(() => FEATURES.map(() => 0)), nodes: 0, boundaries: 0, inactive: checked.inactive };
  const taps = options.taps ?? 6, nodeLimit = options.nodes ?? 256, progressTarget = options.progress ?? 4;
  const initial = { ...state, left: state.alive.reduce((total, value) => total + value, 0), aliveKey: state.alive.join('') };
  const legalCache = new Map();
  const legalAt = position => {
    const key = position.aliveKey + '|' + +position.relieved + '|' + +(position.tray.length < L.SLOTS);
    if (!legalCache.has(key)) legalCache.set(key, reference.legal(game, position));
    return legalCache.get(key);
  };
  const move = (position, index, allowed = legalAt(position)) => {
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
      next.alive[target] = 0;
      next.left--; removed++;
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
  const keyOf = (position, remaining) => position.aliveKey + '|' + position.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + position.openPeek + '|' + position.moves + '|' + +position.relieved + '|' + remaining;
  const available = legalAt(initial);
  if (actions.some(action => !available.free.includes(action.index))) throw new Error('Planning candidate is not physically free');
  let totalNodes = 0, boundaries = 0;
  const memo = new Map(), byIndex = new Map();
  for (const rootIndex of [...new Set(actions.map(action => action.index))].sort((left, right) => left - right)) {
    let nodes = 0;
    const search = (position, remainingTaps) => {
      if (position.tray.length >= L.SLOTS) return { progress: 0, clear: false, dead: true, information: false, boundary: false };
      const allowed = legalAt(position), settled = { ...position, relieved: allowed.relieved };
      const key = keyOf(settled, remainingTaps);
      if (memo.has(key)) return memo.get(key);
      const clear = !settled.tray.length && settled.moves > state.moves;
      if (!settled.left) return { progress: 0, clear, dead: !clear, information: false, boundary: false };
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
        const moved = move(settled, index, allowed);
        if (moved.uncertain) { best.information = true; best.dead = false; continue; }
        if (moved.lost) continue;
        let transitions = [{ ...moved, cost: 1 }];
        if (!moved.removed) {
          if (remainingTaps < 2) { best.boundary = true; best.dead = false; continue; }
          const mates = allowed.free.filter(mate => mate !== index && moved.state.pictures[mate] === moved.state.pictures[index]);
          transitions = (mates.length ? mates : [index]).map(next => ({ ...move(moved.state, next, allowed), cost: 2 }));
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
    const moved = move(initial, rootIndex, available);
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
  return { features: actions.map(action => byIndex.get(action.index)), nodes: totalNodes, boundaries, inactive: null };
}

module.exports = { FEATURES, featuresOf };
