'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { goalRoutes } = require('./public_goal_routes.js');

function observedSafetyPlanningAllowed(game, state, clockOnly = false, maximumSlack, rememberedKeys = []) {
  assert.equal(typeof clockOnly, 'boolean');
  assert(maximumSlack === undefined || clockOnly && Number.isInteger(maximumSlack) && maximumSlack >= 0);
  if (!clockOnly) return true;
  const clock = game.clock;
  if (!clock || !state.alive[clock.i]) return false;
  if (maximumSlack === undefined) return true;
  assert(Array.isArray(rememberedKeys) && Array.from(rememberedKeys).every(index => Number.isInteger(index)
    && index >= 0 && index < state.alive.length));
  const rules = game.rules ? { ...game.rules,
    keys: [...new Set([...(game.rules.keys ?? []), ...rememberedKeys])].sort((left, right) => left - right) } : null;
  const publicGame = { tiles: game.tiles, nb: game.nb, rules, clock };
  return clock.n - state.moves - goalRoutes(publicGame, state, clock.i).cost <= maximumSlack;
}

function createObservedSafetyTransfer(tiles, options = {}) {
  assert(Object.keys(options).every(key => key === 'initialAlive'));
  const geometry = tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z }));
  const neighbors = Layouts.neighbors(geometry), iceNeighbors = Layouts.iceNeighbors(geometry);
  const validate = alive => assert(Array.isArray(alive) && alive.length === tiles.length
    && Array.from(alive).every(value => value === 0 || value === 1));
  const starting = (options.initialAlive ?? tiles.map(() => 1)).slice();
  validate(starting);
  return (index, witness, candidate, observedKeys) => {
    validate(witness); validate(candidate);
    assert(Number.isInteger(index) && index >= 0 && index < tiles.length && witness[index]);
    assert(witness.every((alive, target) => !alive || starting[target])
      && candidate.every((alive, target) => !alive || starting[target]));
    assert(Array.isArray(observedKeys) && new Set(observedKeys).size === observedKeys.length
      && Array.from(observedKeys).every(key => Number.isInteger(key) && key >= 0 && key < tiles.length));
    if (!candidate[index] || !Layouts.isFree(index, candidate, neighbors)) return null;
    const activeKey = observedKeys.find(key => witness[key]);
    if (activeKey === undefined) return null;
    const requiredNeighborRemovals = iceNeighbors[index].filter(neighbor => starting[neighbor] && !witness[neighbor]).length;
    const removedNow = iceNeighbors[index].filter(neighbor => starting[neighbor] && !candidate[neighbor]).length;
    if (removedNow < requiredNeighborRemovals) return null;
    return { kind: 'observedActiveKeyAndThawCount', observedKey: activeKey, requiredNeighborRemovals,
      source: 'Earlier original-rule safety with an actually known key alive excludes a lock; an equal or greater neighbor-removal count discharges any ice sufficient at that witness.' };
  };
}

module.exports = { createObservedSafetyTransfer, observedSafetyPlanningAllowed };
