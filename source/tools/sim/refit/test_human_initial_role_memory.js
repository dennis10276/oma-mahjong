'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, visibleRole, startingIceHits } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');

function test() {
  for (let removed = 0; removed <= 3; removed++) assert.equal(startingIceHits('ice2', 'ice2', removed), 2,
    'A remembered original ice budget must not grow while the covered tile stays unobserved');
  assert.equal(startingIceHits('ice', 'ice2', 1), 2);
  assert.equal(startingIceHits('ice', null, 1), 2);
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0.28, y: 0.28 / 1.24, z: 1 },
    { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
  const iceNb = Layouts.iceNeighbors(tiles);
  const factory = createSessionFactory();
  for (const role of ['ice2', 'thawedIce', 'key', 'lock', 'none']) {
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [7, 7, 9, 9], down: [0, 0, 0, 0], clock: null,
      rules: { iceNb, ice: role === 'ice2' ? { 0: 2 } : role === 'thawedIce' ? { 0: 1 } : {},
        keys: role === 'key' ? [0, 2] : role === 'lock' ? [2, 3] : [], locks: new Set(role === 'lock' ? [0] : []) } };
    for (const exclusiveRoles of [false, true]) {
      const controller = createHumanController(tiles, { exclusiveRoles });
      const session = factory(game);
      const observe = () => {
        const state = session.view().state;
        const publicBoard = observeBoard(tiles, state, null,
          { picture: index => game.faces[index], role: index => visibleRole(game, state, index) });
        controller.observe(state, publicBoard); return publicBoard;
      };
      controller.beginAttempt();
      assert.equal(observe().roles[0], null);
      session.tap(1);
      assert.equal(observe().roles[0], role === 'ice2' ? 'ice' : role === 'thawedIce' ? 'none' : role);
      const remembered = controller.known().initialRoles[0];
      assert.equal(remembered, exclusiveRoles && ['ice2', 'key', 'lock'].includes(role) ? role : null,
        'Later observed immutable roles and remaining ice plus observed neighbor removals should reconstruct initial roles only under the declared contract');
      controller.beginAttempt();
      const restarted = factory(game).view().state;
      const hidden = observeBoard(tiles, restarted, null,
        { picture: index => game.faces[index], role: index => visibleRole(game, restarted, index) });
      assert.equal(hidden.roles[0], null);
      controller.observe(restarted, hidden);
      assert.equal(controller.known().initialRoles[0], remembered);
    }
  }
  factory.verifySource();
  console.log('PASS retry memory reconstructs initial keys, locks and two-hit ice from actually seen roles and public removals, while late none and undeclared role overlap remain unknown');
}

if (require.main === module) test();
module.exports = test;
