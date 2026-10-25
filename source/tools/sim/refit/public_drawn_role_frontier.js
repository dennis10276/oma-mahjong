'use strict';
const assert = require('assert/strict');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { goalRoutes } = require('./public_goal_routes.js');

function createDrawnRoleFrontier(tiles, initial, mode = 'all') {
  assert(initial.roles === undefined || Array.isArray(initial.roles) && initial.roles.length === tiles.length);
  return createExposureFrontier(tiles, initial, mode, true);
}

function drawnRolePlanningAllowed(game, state, slackRange, rememberedKeys = []) {
  if (slackRange === undefined) return true;
  assert(Array.isArray(slackRange) && slackRange.length === 2
    && slackRange.every(value => Number.isInteger(value) && value >= 0) && slackRange[0] <= slackRange[1]);
  assert(Array.isArray(rememberedKeys) && rememberedKeys.every(index => Number.isInteger(index)
    && index >= 0 && index < state.alive.length));
  const clock = game.clock;
  if (!clock || !state.alive[clock.i]) return false;
  const rules = game.rules ? { ...game.rules,
    keys: [...new Set([...(game.rules.keys ?? []), ...rememberedKeys])].sort((left, right) => left - right) } : null;
  const publicGame = { tiles: game.tiles, nb: game.nb, rules, clock };
  const slack = clock.n - state.moves - goalRoutes(publicGame, state, clock.i).cost;
  return slack >= slackRange[0] && slack <= slackRange[1];
}

module.exports = { createDrawnRoleFrontier, drawnRolePlanningAllowed };
