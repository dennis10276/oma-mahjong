'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, visibleRole } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');

function test() {
  const factory = createSessionFactory();
  for (const picture of [...Array(36).keys(), 101]) {
    const faces = [1, 2, 3, picture, 1, 2, 3, picture];
    const tiles = faces.map((face, index) => ({ x: index * 4, y: 0, z: 0 }));
    const game = { tiles, nb: Layouts.neighbors(tiles), faces,
      down: faces.map((face, index) => index === 3 ? 1 : 0), rules: null, clock: null };
    const session = factory(game, { seed: 20261111, choiceLimit: 20, tapMs: 1000 });
    for (const index of [0, 1, 2]) session.tap(index);
    const state = session.view().state;
    assert.deepEqual(state.tray, [1, 2, 3]);
    const controller = createHumanController(tiles, { inspectBeforeCommit: true, inspectionTrayLimit: 3 });
    controller.beginAttempt();
    controller.observe(state, observeBoard(tiles, state, null,
      { picture: index => faces[index], role: index => visibleRole(game, state, index) }));
    assert.equal(controller.known().pictures[3], null);
    const selected = controller.decide();
    assert.equal(selected.plan.index, 3);
    assert.equal(selected.plan.goal, 'closedTileDiscovery');
    const after = session.tap(3);
    assert(after.state.tray.length <= 3);
    assert.notEqual(after.why, 'tray', 'First inspection of an unknown closed tile cannot add a fourth unmatched tile');
    if ([1, 2, 3].includes(picture)) assert.equal(after.state.tray.length, 2);
    else { assert.equal(after.state.moves, state.moves); assert.equal(after.state.openPeek, 3); }
  }
  factory.verifySource();
  console.log('PASS all37 production pictures allow nonclock discovery at three carried tiles: either a real match or a zero-removal peek, never a fourth unmatched commitment');
}

if (require.main === module) test();
module.exports = test;
