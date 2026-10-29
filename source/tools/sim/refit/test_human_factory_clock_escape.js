'use strict';
const assert = require('assert/strict');
const { createFactoryController, PROFILES } = require('./human_factory_controller.js');

function test() {
  // Tile 0 is the clock tile (face 12).
  // Tiles 1, 2 are already in the tray (tray: [25, 18]).
  // Tile 3 is an unrelated tile (face 99).
  const tiles = [
    { x: 0, y: 0, z: 0 }, // 0: clock tile
    { x: 2, y: 0, z: 0 }, // 1
    { x: 4, y: 0, z: 0 }, // 2
    { x: 6, y: 0, z: 0 }  // 3: unrelated tile
  ];
  const c = createFactoryController(tiles, PROFILES.dennis, 31);
  c.beginAttempt();
  const state = {
    alive: [1, 0, 0, 1], tray: [25, 18], moves: 4, physicalTaps: 4, openPeek: -1,
    arriving: [], relieved: false
  };
  const observed = {
    pictures: [12, null, null, 99],
    roles: ['none', 'none', 'none', 'none'],
    down: [0, 0, 0, 0],
    takeable: [true, false, false, true],
    clock: { i: 0, n: 6, remaining: 2 }
  };
  c.observe(state, observed);
  // Tile 0 is the clock tile. Even though taking it makes tray.length === 3 with no open matches,
  // the bot must take the clock tile to save the clock, rather than balking with a -1200 penalty.
  const decision = c.decide();
  assert.equal(decision.index, 0, 'Controller must prioritize taking the clock tile over balking at a 3-tile tray');
  assert(decision.score > 0, 'Clock tile score must remain positive rather than penalized with -1200');
  console.log('PASS clock tile is exempt from tray escape penalty and chosen over balking');
}

if (require.main === module) test();
module.exports = test;
