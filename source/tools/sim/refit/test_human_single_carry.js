'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, visibleRole } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 2 },
    { x: 8, y: 0, z: 1 }, { x: 12, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 9, 9, 2],
    down: tiles.map(() => 0), rules: null, clock: null };
  const factory = createSessionFactory();
  const session = factory(game, { seed: 20261111, choiceLimit: 20, tapMs: 1000 });
  const controller = createHumanController(tiles, { patientSingleCarry: true, taps: 1, nodes: 1, beam: 1 });
  controller.beginAttempt();
  const observe = () => {
    const state = session.view().state;
    controller.observe(state, observeBoard(tiles, state, game.clock,
      { picture: index => game.faces[index], role: index => visibleRole(game, state, index) }));
  };
  observe();
  session.tap(4); observe();
  assert.deepEqual(controller.state().tray, [9]);
  assert.equal(controller.known().pictures[3], null, 'The buried carried mate must remain unknown');
  const choice = controller.decide();
  assert([0, 1].includes(choice.plan.index), 'One carried tile should not cause digging while a guaranteed ready pair exists');
  assert(!choice.predicted.uncertain);
  const after = session.tap(choice.plan.index);
  assert.equal(after.state.tray.length, 2);
  controller.acknowledge(choice.plan.index, true); observe();
  const partner = controller.decide();
  assert.equal(partner.plan.index, choice.plan.index === 0 ? 1 : 0);
  factory.verifySource();
  assert.throws(() => createHumanController(tiles, { patientSingleCarry: 'yes' }));
  console.log('PASS single-carry ready-pair preference uses only guaranteed observed partners and completes the physical pair');
}

if (require.main === module) test();
module.exports = test;
