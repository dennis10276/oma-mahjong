'use strict';
const assert = require('assert/strict');
const { aliveSignature } = require('./public_alive_signature.js');

function goalRoutes(game, state, target) {
  assert(Number.isInteger(target) && target >= 0 && target < state.alive.length);
  const sideChain = (root, rows) => {
    const found = new Set(), pending = [root];
    while (pending.length) for (const neighbor of rows[pending.pop()]) {
      if (state.alive[neighbor] && !found.has(neighbor)) { found.add(neighbor); pending.push(neighbor); }
    }
    return found;
  };
  const dependencyCost = initial => {
    const found = new Set(initial), pending = [...found];
    while (pending.length) {
      const current = pending.pop();
      const dependencies = [...game.nb.above[current], ...(!state.relieved && game.rules?.locks?.has(current) ? game.rules.keys || [] : [])];
      for (const dependency of dependencies) if (state.alive[dependency] && !found.has(dependency)) {
        found.add(dependency); pending.push(dependency);
      }
    }
    let iceCost = 0;
    if (!state.relieved) for (const index of found) {
      const neighbors = game.rules?.iceNb?.[index] || [];
      iceCost += Math.max(0, (game.rules?.ice?.[index] || 0)
        - neighbors.filter(neighbor => !state.alive[neighbor] || found.has(neighbor)).length);
    }
    return found.size + iceCost;
  };
  const alternatives = ['cost', 'left', 'right'].map(strategy => {
    const frontier = new Set(), pending = [];
    const add = index => {
      if (state.alive[index] && !frontier.has(index)) { frontier.add(index); pending.push(index); }
    };
    add(target);
    while (pending.length) {
      const current = pending.pop();
      game.nb.above[current].forEach(add);
      if (!state.relieved && game.rules?.locks?.has(current)) (game.rules.keys || []).forEach(add);
      const left = sideChain(current, game.nb.left), right = sideChain(current, game.nb.right);
      const chosen = !left.size ? left : !right.size ? right : strategy === 'left' ? left : strategy === 'right' ? right
        : dependencyCost(left) <= dependencyCost(right) ? left : right;
      chosen.forEach(add);
      if (state.relieved) continue;
      const neighbors = game.rules?.iceNb?.[current] || [];
      const needed = Math.max(0, (game.rules?.ice?.[current] || 0)
        - neighbors.filter(neighbor => !state.alive[neighbor] || frontier.has(neighbor)).length);
      neighbors.filter(neighbor => state.alive[neighbor] && !frontier.has(neighbor) && neighbor !== current)
        .sort((left, right) => dependencyCost([left]) - dependencyCost([right]) || left - right)
        .slice(0, needed).forEach(add);
    }
    return frontier;
  });
  const cost = Math.min(...alternatives.map(frontier => frontier.size));
  return { cost, frontier: new Set(alternatives.filter(frontier => frontier.size === cost).flatMap(frontier => [...frontier])),
    alternatives,
    note: 'Bounded public dependency ordering over alternative sides and observed mechanics, not a removal witness, lower bound, safety certificate or hidden-role inference.' };
}

function createGoalRouteCache(game) {
  const cache = new Map();
  let hits = 0;
  const planner = (snapshot, state, target) => {
    assert.equal(snapshot, game);
    assert(Number.isInteger(target) && target >= 0 && target < state.alive.length);
    const identity = aliveSignature(state.alive) + '|' + +!!state.relieved + '|' + target;
    if (cache.has(identity)) { hits++; return cache.get(identity); }
    const route = goalRoutes(game, state, target);
    cache.set(identity, route); return route;
  };
  planner.stats = () => ({ routeHits: hits, routeEntries: cache.size });
  return planner;
}

module.exports = { goalRoutes, createGoalRouteCache };
