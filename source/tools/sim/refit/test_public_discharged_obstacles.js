'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createObstacleFrontier } = require('./public_obstacle_frontier.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { visibleRole } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 },
    { x: 6, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 14, y: 0, z: 0 }];
  const neighbors = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles), initial = tiles.map(() => 1);
  const key = index => ({ index, observation: { roles: ['key'], knownRole: 'key' } });
  const frontier = createObstacleFrontier(tiles, { exclusiveRoles: true });
  frontier.observe({ alive: initial, physicalTaps: 0 }, [key(3), key(4)]);
  const discharged = [1, 0, 0, 0, 0, 1];
  assert(frontier.query(discharged).free.includes(0), 'All supported blockers are discharged even though the role itself was never observed');
  assert(frontier.query(discharged, false).uncertain.includes(0));
  assert(frontier.query([1, 0, 1, 0, 0, 1]).uncertain.includes(0));
  assert(frontier.query([1, 0, 0, 1, 0, 1]).uncertain.includes(0));
  const partial = createObstacleFrontier(tiles, { exclusiveRoles: true });
  partial.observe({ alive: initial, physicalTaps: 0 }, [key(3)]);
  assert(partial.query(discharged).uncertain.includes(0));
  const missingOrigin = createObstacleFrontier(tiles, { exclusiveRoles: true });
  missingOrigin.observe({ alive: initial, physicalTaps: 1 }, [key(3), key(4)]);
  assert(missingOrigin.query(discharged).uncertain.includes(0));
  const initiallyAbsent = createObstacleFrontier(tiles, { exclusiveRoles: true });
  initiallyAbsent.observe({ alive: [1, 0, 1, 1, 1, 1], physicalTaps: 0 }, [key(3), key(4)]);
  assert(initiallyAbsent.query(discharged).uncertain.includes(0));
  const factory = createSessionFactory();
  let controls = 0;
  for (const role of ['none', 'ice', 'ice2', 'lock']) {
    const rules = { iceNb, ice: role.startsWith('ice') ? { 0: role === 'ice2' ? 2 : 1 } : {},
      keys: [3, 4], locks: new Set(role === 'lock' ? [0] : []) };
    for (let mask = 0; mask < 64; mask++) {
      const alive = initial.map((present, index) => +!!(mask & (1 << index))), predicted = frontier.query(alive);
      for (const index of predicted.free) { assert(Layouts.takeable(index, alive, neighbors, rules, initial)); controls++; }
      for (const index of predicted.blocked) { assert(!Layouts.takeable(index, alive, neighbors, rules, initial)); controls++; }
    }
    const game = { tiles, nb: neighbors, faces: [7, 9, 9, 8, 8, 7], down: [1, 0, 0, 0, 0, 0], rules, clock: null };
    const session = factory(game);
    for (const index of [3, 4, 1, 2]) session.tap(index);
    const state = session.view().state;
    const observed = observeBoard(tiles, state, null,
      { picture: index => game.faces[index], role: index => visibleRole(game, state, index) });
    assert.equal(observed.pictures[0], null); assert.equal(observed.roles[0], null);
    assert(session.view().legalTiles.includes(0));
    session.tap(0); session.tap(5); assert(session.view().win);
  }
  factory.verifySource();
  console.log('PASS ' + controls + ' public-bound controls discharge every possible unseen obstacle only with both observed keys gone and two observed starting-neighbor removals; hidden pictures/roles remain unread');
}

if (require.main === module) test();
module.exports = test;
