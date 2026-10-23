'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { goalRoutes, createGoalRouteCache } = require('./public_goal_routes.js');

function test() {
  const tiles = [{ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 }, { x: 14, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }];
  const game = { tiles, nb: Layouts.neighbors(tiles),
    rules: { locks: new Set([1]), keys: [3, 4], ice: { 5: 1 }, iceNb: [[], [], [], [], [], [2]] } };
  for (const field of ['faces', 'down', 'seed', 'deck']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), relieved: false };
  const cached = createGoalRouteCache(game);
  let controls = 0;
  for (let mask = 0; mask < 64; mask++) for (const relieved of [false, true]) for (let target = 0; target < tiles.length; target++) {
    const position = { alive: tiles.map((tile, index) => +(!!(mask & 2 ** index))), relieved };
    const result = cached(game, position, target);
    assert.deepEqual(result, goalRoutes(game, position, target));
    const irrelevant = { alive: position.alive.slice(), relieved };
    for (const field of ['pictures', 'down', 'tray', 'moves', 'openPeek', 'arriving', 'seed']) {
      Object.defineProperty(irrelevant, field, { get() { throw Error('Dependency cache read irrelevant/private ' + field); } });
    }
    assert.equal(cached(game, irrelevant, target), result);
    position.alive[0] = 1 - position.alive[0];
    assert.deepEqual(cached(game, position, target), goalRoutes(game, position, target));
    controls++;
  }
  assert(cached.stats().routeHits >= controls);
  assert.throws(() => cached(game, state, '0'));
  assert.throws(() => cached({ ...game }, state, 0));
  const route = goalRoutes(game, state, 0);
  assert.deepEqual([...route.frontier].sort(), [0, 2, 5], 'An equally short side with a lock is worse than a side that also thaws the cover');
  assert.equal(route.cost, 3);
  const { recoveryDepth } = require('./public_goal_frontier.js');
  const carried = { ...state, tray: [7], pictures: [7, null, null, null, null, null] };
  assert.equal(recoveryDepth(game, carried).knownCost, 5);
  assert.equal(recoveryDepth(game, carried, true).knownCost, 2, 'Tray recovery should also compare the cheaper unlocked side and reuse a necessary thaw removal');
  assert.throws(() => recoveryDepth(game, carried, 'yes'));
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
  const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
  const position = { ...state, pictures: [11, 7, 7, 10, 10, 11], down: tiles.map(() => 0),
    tray: [], moves: 0, openPeek: -1, arriving: [] };
  const clocked = { tiles, nb: game.nb, rules: game.rules, clock: { i: 0, n: 4 } };
  const planned = search(clocked, position, [2, 3, 4].map(index => ({ index })),
    { ...REFERENCE_PARAMETERS, alternativeGoalRoutes: true, nodes: 128, taps: 6 });
  assert.equal(planned.index, 2);
  assert(planned.safeClockExit, 'The chosen cheap side must still have a constructive physical clock-exit witness');
  assert.throws(() => search(clocked, position, [{ index: 2 }], { alternativeGoalRoutes: 'yes' }));
  assert.throws(() => search(clocked, position, [{ index: 2 }], { alternativeRecoveryRoutes: 'yes' }));
  console.log('PASS alternative public goal routes compare mechanical side costs and thaw dependencies; ' + controls + ' scoped cache controls match raw results, distinguish alive/relief/targets and ignore pictures, trays and peeks without stale mutable signatures');
}

if (require.main === module) test();
module.exports = test;
