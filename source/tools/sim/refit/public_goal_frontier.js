'use strict';
const assert = require('assert/strict');

function frontierFor(game, state, target) {
  assert(Number.isInteger(target) && target >= 0 && target < game.tiles.length);
  const frontier = new Set(), pending = [target], size = state.alive.length;
  const side = (rows, root) => {
    const seen = new Set([root]), route = []; let current = root;
    while (route.length < size) {
      const next = rows[current].find(index => state.alive[index] && !seen.has(index));
      if (next === undefined) break;
      seen.add(next); route.push(next); current = next;
    }
    return route;
  };
  while (pending.length) {
    const current = pending.pop();
    if (!state.alive[current] || frontier.has(current)) continue;
    frontier.add(current);
    for (const above of game.nb.above[current]) if (state.alive[above]) pending.push(above);
    const left = side(game.nb.left, current), right = side(game.nb.right, current);
    for (const blocker of left.length <= right.length ? left : right) pending.push(blocker);
    if (state.relieved) continue;
    if (game.rules?.locks?.has(current)) for (const key of game.rules.keys || []) if (state.alive[key]) pending.push(key);
    const ice = game.rules?.ice?.[current] || 0, neighbors = game.rules?.iceNb?.[current] || [];
    const gone = neighbors.filter(index => !state.alive[index]).length;
    if (ice > gone) for (const neighbor of neighbors) if (state.alive[neighbor]) pending.push(neighbor);
  }
  return frontier;
}

function recoveryDepth(game, state) {
  let knownCost = 0, unknownWaiting = 0;
  const targets = [];
  for (const picture of state.tray) {
    const mates = state.pictures.flatMap((candidate, index) => state.alive[index] && candidate === picture ? [index] : []);
    if (!mates.length) { unknownWaiting++; continue; }
    const ranked = mates.map(index => ({ index, cost: frontierFor(game, state, index).size - 1 }))
      .sort((left, right) => left.cost - right.cost || left.index - right.index);
    knownCost += ranked[0].cost; targets.push({ picture, ...ranked[0] });
  }
  return { knownCost, unknownWaiting, targets,
    note: 'Public geometric/obstacle ordering heuristic only. Side choice and alternative thaw neighbors are approximate; cost is not a lower bound, route witness, death proof or hidden-picture inference.' };
}

module.exports = { frontierFor, recoveryDepth };
