'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { goalRoutes } = require('./public_goal_routes.js');

function test() {
  const tiles = [{ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 }, { x: 14, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }];
  const game = { tiles, nb: Layouts.neighbors(tiles),
    rules: { locks: new Set([1]), keys: [3, 4], ice: { 5: 1 }, iceNb: [[], [], [], [], [], [2]] } };
  for (const field of ['faces', 'down', 'seed', 'deck']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), relieved: false };
  const route = goalRoutes(game, state, 0);
  assert.deepEqual([...route.frontier].sort(), [0, 2, 5], 'An equally short side with a lock is worse than a side that also thaws the cover');
  assert.equal(route.cost, 3);
  assert(route.alternatives.some(frontier => frontier.has(1) && frontier.has(3) && frontier.has(4)));
  assert.equal(goalRoutes(game, { ...state, alive: [0, 1, 1, 1, 1, 1] }, 0).cost, 0);
  const relieved = goalRoutes(game, { ...state, relieved: true }, 0);
  assert.equal(relieved.cost, 3);
  assert(!relieved.frontier.has(3) && !relieved.frontier.has(4));
  const branching = { tiles: tiles.concat([{ x: 4, y: 1, z: 0 }]), rules: null };
  branching.nb = Layouts.neighbors(branching.tiles);
  const branchingRoute = goalRoutes(branching, { alive: branching.tiles.map(() => 1), relieved: false }, 0);
  assert(branchingRoute.alternatives.some(frontier => frontier.has(2) && frontier.has(6)), 'All overlapping blockers on a selected side must be included');
  assert.throws(() => goalRoutes(game, state, -1));
  console.log('PASS alternative public goal routes compare mechanical side costs, choose only needed observed thaw neighbors, include branching blockers and never read private pictures');
}

if (require.main === module) test();
module.exports = test;
