'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createFactoryController, PROFILES } = require('./human_factory_controller.js');
const { observeBoard } = require('./human_board_visibility.js');

function test() {
  // Tile 0 is an ice tile needing 1 neighbor cleared.
  // Neighbor 1 is free immediately. Neighbor 2 has a high stack above it (tiles 3, 4).
  const tiles = [
    { x: 0, y: 0, z: 0 }, // 0: ice (need 1)
    { x: 2, y: 0, z: 0 }, // 1: free neighbor
    { x: 0, y: 2, z: 0 }, // 2: neighbor blocked by 3
    { x: 0, y: 2, z: 1 }, // 3: above 2
    { x: 0, y: 2, z: 2 }  // 4: above 3
  ];
  // Verify that an ice tile needing 1 melt only attracts the single cheapest neighbor (tile 1),
  // and does not over-count to pull in the heavy stack above tile 2.
  const c = createFactoryController(tiles, PROFILES.dennis, 31);
  c.beginAttempt();
  const state = {
    alive: [1, 1, 1, 1, 1], tray: [], moves: 0, physicalTaps: 0, openPeek: -1,
    arriving: [], relieved: false
  };
  const observed = {
    pictures: [null, null, null, null, null],
    roles: ['ice', 'none', 'none', 'none', 'none'],
    down: [0, 0, 0, 0, 0],
    takeable: [false, true, false, false, true],
    clock: { i: 0, n: 5, remaining: 5 }
  };
  c.observe(state, observed);
  // Tile 1 is free and melts the ice; tile 4 is the top of the unnecessary stack above tile 2.
  // With accurate ice requirement calculation, tile 1 is chosen over tile 4.
  const decision = c.decide();
  assert.equal(decision.index, 1, 'Ice blocker planning must choose the single needed neighbor, not over-count into deep stacks');
  console.log('PASS accurate ice blocker counting avoids over-attracting unnecessary neighbor stacks');
}

if (require.main === module) test();
module.exports = test;
