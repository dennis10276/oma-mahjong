'use strict';
const assert = require('assert/strict');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
    { x: 4, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
  for (const tile of tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Geometry accessed private picture'); } });
  const clock = { i: 0, n: 8 }, visible = [2, 3, 4, 5];
  let canonical = null, controls = 0;
  for (let world = 0; world < 96; world++) {
    const state = { alive: [1, 1, 1, 1, 1, 1], down: [world % 2, Math.floor(world / 2) % 2, 0, 0, 0, 0],
      moves: 0, tray: [], openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 };
    const privateFaces = [world % 36, (world * 7) % 36, 2, 2, 3, 3];
    const privateRoles = [world % 3 === 0 ? 'ice' : world % 3 === 1 ? 'lock' : 'key',
      world % 3 === 0 ? 'key' : 'none', 'none', 'none', 'none', 'none'];
    const observation = observeBoard(tiles, state, clock, {
      picture(index) { assert(visible.includes(index)); return privateFaces[index]; },
      role(index) { assert(visible.includes(index)); return privateRoles[index]; },
    });
    for (const value of Object.values(observation)) if (value && typeof value === 'object') Object.freeze(value);
    Object.freeze(observation);
    const controller = createHumanController(tiles);
    controller.beginAttempt();
    const publicState = { alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
      relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps };
    controller.observe(publicState, observation);
    const output = { observation, decision: controller.decide(), memory: controller.known() };
    if (canonical === null) canonical = output;
    else assert.deepEqual(output, canonical, 'A private-world change altered the public observation, controller or memory');
    assert.deepEqual(output.memory.pictures.slice(0, 2), [null, null]);
    assert.deepEqual(output.memory.down.slice(0, 2), [null, null]);
    assert.deepEqual(output.memory.initialRoles.slice(0, 2), [null, null]);
    controls++;
  }
  console.log('PASS ' + controls + ' concealed-picture/role/orientation worlds produce identical public observations, controller plans and retry memory while the covered clock badge stays public');
}

if (require.main === module) test();
module.exports = test;
