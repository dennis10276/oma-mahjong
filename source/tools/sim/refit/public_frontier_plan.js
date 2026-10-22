'use strict';
const assert = require('assert/strict');
const { advanceObserved } = require('./known_tray_plan.js');

function planObservedPrefix(game, state, frontier, options = {}) {
  assert(Object.keys(options).every(key => ['taps', 'nodes', 'beam'].includes(key)));
  const settings = { taps: 20, nodes: 4096, beam: 32, ...options };
  for (const field of ['taps', 'nodes', 'beam']) assert(Number.isInteger(settings[field]) && settings[field] > 0);
  assert(settings.taps <= 96 && settings.nodes <= 1000000 && settings.beam <= 4096);
  const initialLeft = state.alive.reduce((sum, value) => sum + value, 0);
  const clockActive = !!(game.clock && state.alive[game.clock.i]);
  const compare = (left, right) => {
    for (let offset = 0; offset < left.length; offset++) if (left[offset] !== right[offset]) return left[offset] - right[offset];
    return 0;
  };
  const keyOf = current => current.alive.join('') + '|' + current.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + current.openPeek + '|' + (clockActive && current.alive[game.clock.i] ? current.moves : '-')
    + '|' + (current.arriving || []).join(',');
  const score = (current, path, information = false) => {
    const left = current.alive.reduce((sum, value) => sum + value, 0);
    const won = left === 0 && current.tray.length === 0, exit = clockActive && !current.alive[game.clock.i];
    const progress = initialLeft - left, paired = initialLeft + state.tray.length - left - current.tray.length;
    return [+won, +exit, +(current.tray.length < 3), paired, progress, -current.tray.length, +information, -path.length];
  };
  let beam = [{ state, path: [] }], best = null, nodes = 0, bounded = false, nodeCapped = false, pictureBoundaries = 0, obstacleBoundaries = 0, unsupported = 0;
  const visited = new Set([keyOf(state)]), initial = frontier.query(state.alive);
  const consider = entry => {
    if (!best || compare(entry.rank, best.rank) > 0 || compare(entry.rank, best.rank) === 0 && entry.boundary && !best.boundary
      && JSON.stringify(entry.path) === JSON.stringify(best.path)) best = entry;
  };
  for (let depth = 0; depth < settings.taps && beam.length; depth++) {
    const children = [];
    for (const parent of beam) {
      const allowed = frontier.query(parent.state.alive);
      if (allowed.uncertain.length) {
        obstacleBoundaries++;
        if (parent.path.length) consider({ ...parent, rank: score(parent.state, parent.path), boundary: 'obstacleObservationRequired' });
      }
      for (const index of allowed.free) {
        if (nodes >= settings.nodes) { bounded = true; nodeCapped = true; break; }
        nodes++;
        const path = [...parent.path, index], transition = advanceObserved(game, parent.state, index, frontier);
        if (transition.uncertain) {
          const information = transition.reason === 'unseenPicture' || transition.reason === 'unobservedOrientation';
          if (information) pictureBoundaries++; else unsupported++;
          if (information) consider({ state: parent.state, path, rank: score(parent.state, path, true), boundary: transition.reason });
          continue;
        }
        if (transition.lost) continue;
        const child = { state: transition.state, path, rank: score(transition.state, path), boundary: null };
        consider(child);
        if (transition.win) continue;
        const key = keyOf(transition.state);
        if (visited.has(key)) continue;
        visited.add(key); children.push(child);
      }
      if (nodeCapped) break;
    }
    if (best?.rank[0] || nodeCapped) break;
    children.sort((left, right) => compare(right.rank, left.rank));
    if (children.length > settings.beam) bounded = true;
    beam = children.slice(0, settings.beam);
    if (depth === settings.taps - 1 && beam.length) bounded = true;
  }
  return { type: 'public-observed-prefix-plan-v1', index: best?.path[0] ?? null, path: best?.path ?? [],
    expected: best?.state ?? null, witnessedWin: !!best?.rank[0], witnessedClockExit: !!best?.rank[1],
    boundary: best ? best.boundary : !initial.free.length ? 'obstacleObservationRequired' : 'noVerifiedContinuation',
    nodes, bounded, pictureBoundaries, obstacleBoundaries, unsupported, settings,
    note: 'Bounded search of guaranteed-public legal prefixes only. Pictures/orientations and newly thawed obstacle roles stop prediction until observed. No actual hidden rules or future pictures are consulted. Missing routes, pruning and budgets do not prove death or impossibility. Not yet promoted over the selected symbolic reference campaign.' };
}

module.exports = { planObservedPrefix };
