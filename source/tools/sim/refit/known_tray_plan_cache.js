'use strict';
const { featuresOf } = require('./known_tray_plan_bits.js');

function planningCache(parameters, capacity = 4096, planner = featuresOf) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Invalid public planning cache capacity');
  if (typeof planner !== 'function') throw new Error('Invalid public planning function');
  const cache = new Map();
  let hits = 0, misses = 0;
  const plan = (game, state, actions) => {
    const board = JSON.stringify([game.tiles.map(tile => [tile.x, tile.y, tile.z]), game.nb.above, game.nb.left, game.nb.right,
      game.rules ? [game.rules.ice, game.rules.iceNb, Array.from(game.rules.locks || []).sort((left, right) => left - right), game.rules.keys] : null,
      game.clock ? [game.clock.i, game.clock.n] : null]);
    const key = board + '|' + JSON.stringify([state.alive, state.pictures, state.down, state.tray, state.moves,
      state.openPeek, !!state.relieved, state.arriving || [], actions.map(action => [action.index, !!action.inspect])]);
    const found = cache.get(key);
    if (found) {
      hits++;
      cache.delete(key); cache.set(key, found);
      return { ...found, features: found.features.map(row => row.slice()), nodes: 0, cacheHit: true };
    }
    misses++;
    const result = planner(game, state, actions, parameters);
    cache.set(key, { ...result, features: result.features.map(row => row.slice()) });
    if (cache.size > capacity) cache.delete(cache.keys().next().value);
    return result;
  };
  plan.stats = () => ({ hits, misses, size: cache.size });
  return plan;
}

module.exports = { planningCache };
