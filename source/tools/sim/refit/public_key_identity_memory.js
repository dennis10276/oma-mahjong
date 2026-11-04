'use strict';
const assert = require('assert/strict');
const { goalRoutes } = require('./public_goal_routes.js');

function keyPlanningAllowed(game, state, slackAbove, crowdedAfterClock = false, beforeCrowding = false, crowdedTrayMin = 2) {
  assert.equal(typeof crowdedAfterClock, 'boolean');
  assert.equal(typeof beforeCrowding, 'boolean');
  assert(!crowdedAfterClock || !beforeCrowding, 'Evaluate proactive and crowded key planning separately');
  assert(Number.isInteger(crowdedTrayMin) && crowdedTrayMin >= 2 && crowdedTrayMin <= 3);
  assert(crowdedAfterClock || crowdedTrayMin === 2);
  if (crowdedAfterClock || beforeCrowding) assert(Array.isArray(state.tray));
  if (slackAbove === undefined) return true;
  assert(Number.isInteger(slackAbove) && slackAbove >= 0);
  const clock = game.clock;
  if (beforeCrowding && (!clock || !state.alive[clock.i]) && state.tray.length <= 1) return true;
  if (crowdedAfterClock && (!clock || !state.alive[clock.i]) && state.tray.length >= crowdedTrayMin && state.tray.length <= 3) return true;
  if (!clock || !state.alive[clock.i]) return false;
  return clock.n - state.moves - goalRoutes(game, state, clock.i).cost > slackAbove;
}

function createKeyIdentityMemory(size) {
  assert(Number.isInteger(size) && size > 0);
  const facts = new Map();
  const validateAlive = alive => assert(Array.isArray(alive) && alive.length === size && alive.every(value => value === 0 || value === 1));
  return {
    observe(state, observedRoles, attempt = 1) {
      validateAlive(state.alive);
      assert(Number.isInteger(state.physicalTaps) && state.physicalTaps >= 0);
      assert(Number.isInteger(attempt) && attempt > 0);
      assert(Array.isArray(observedRoles) && observedRoles.length === size
        && observedRoles.every(role => role === null || ['none', 'key', 'lock', 'ice', 'ice2'].includes(role)));
      let learned = 0;
      observedRoles.forEach((role, index) => {
        if (role !== 'key' || !state.alive[index] || facts.has(index)) return;
        facts.set(index, { index, attempt, physicalTaps: state.physicalTaps,
          source: 'actual observed key glyph; key identity is static within this board' });
        learned++;
      });
      return learned;
    },
    keys(alive = null) {
      if (alive !== null) validateAlive(alive);
      return [...facts.keys()].filter(index => alive === null || alive[index]).sort((left, right) => left - right);
    },
    entries() { return [...facts.values()].sort((left, right) => left.index - right.index).map(fact => ({ ...fact })); },
  };
}

module.exports = { createKeyIdentityMemory, keyPlanningAllowed };
