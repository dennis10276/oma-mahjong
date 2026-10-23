'use strict';
const assert = require('assert/strict');
const { goalRoutes } = require('./public_goal_routes.js');
const { legal } = require('./known_tray_plan.js');
const { frontierPressure } = require('./public_frontier_pressure.js');

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

function recoveryDepth(game, state, alternativeRoutes = false, assessPressure = false, routePlanner = goalRoutes) {
  assert.equal(typeof alternativeRoutes, 'boolean');
  assert.equal(typeof assessPressure, 'boolean');
  assert.equal(typeof routePlanner, 'function');
  let knownCost = 0, unknownWaiting = 0, maximumOverflow = 0;
  const allowed = assessPressure ? legal(game, state) : null;
  const targets = [];
  for (const picture of state.tray) {
    const mates = state.pictures.flatMap((candidate, index) => state.alive[index] && candidate === picture ? [index] : []);
    if (!mates.length) { unknownWaiting++; continue; }
    const ranked = mates.flatMap(index => {
      const routes = alternativeRoutes ? routePlanner(game, state, index) : null;
      const frontiers = routes ? assessPressure ? routes.alternatives : [routes.frontier] : [frontierFor(game, state, index)];
      return frontiers.map(frontier => ({ index, cost: (routes && !assessPressure ? routes.cost : frontier.size) - 1,
        ...(assessPressure ? frontierPressure(state, frontier, index, allowed) : {}) }));
    }).sort((left, right) => (left.overflow ?? 0) - (right.overflow ?? 0) || left.cost - right.cost || left.index - right.index);
    knownCost += ranked[0].cost; targets.push({ picture, ...ranked[0] });
    maximumOverflow = Math.max(maximumOverflow, ranked[0].overflow ?? 0);
  }
  return { knownCost, unknownWaiting, targets,
    ...(assessPressure ? { maximumOverflow } : {}),
    note: 'Public geometric/obstacle ordering heuristic only. Side choice and alternative thaw neighbors are approximate; cost is not a lower bound, route witness, death proof or hidden-picture inference.' };
}

function trayRecoveryBurden(depth, recovery, trayLength) {
  const carried = Math.max(0, trayLength - recovery.immediate);
  return { carried, burden: depth.knownCost + 2 * depth.unknownWaiting + 2 * Math.max(0, carried - 1) };
}

module.exports = { frontierFor, recoveryDepth, trayRecoveryBurden };
