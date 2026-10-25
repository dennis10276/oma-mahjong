'use strict';
const assert = require('assert/strict');
const { withholdClosedRoles } = require('./fixtures/withheld_roles.js');
const Layouts = require('../../../www/layouts.js');
const witness = require('./public_witness_search.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const originalSearch = witness.search;
  let searches = 0;
  witness.search = (...args) => { searches++; return originalSearch(...args); };
  try {
    const tiles = [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 },
      ...Array.from({ length: 8 }, (_, index) => ({ x: 8 + index * 4, y: 0, z: 0 }))];
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 3, 4, 5, 2, 3, 4, 5],
      down: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], rules: null, clock: null };
    const settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, factory = createSessionFactory();
    for (const deviate of [false, true]) {
      const controller = createHumanController(tiles, { rememberAcceptedTaps: true, usePlacementContract: true,
        progressiveReopens: true }, { boardMode: 'standard' });
      const observe = session => {
        const state = session.view().state;
        const shown = observeBoard(tiles, state, null,
          { picture: index => actual.faces[index], role: withholdClosedRoles(state, index => visibleRole(actual, state, index)) });
        controller.observe(state, shown); return shown;
      };
      controller.beginAttempt(); const failed = factory(actual, settings); observe(failed);
      const failedActions = [0, 0, 1, 2, 3, 4, 5];
      for (const index of failedActions) {
        controller.decide(); controller.acknowledge(index, true); failed.tap(index); observe(failed);
      }
      assert.equal(failed.view().why, 'tray');
      assert.equal(verifyAttempt(encodeGame(actual), failedActions, settings, failed.audit()), failedActions.length);
      searches = 0;
      controller.beginAttempt(); const retry = factory(actual, settings); observe(retry);
      let selected = controller.decide();
      assert(selected.plan.knownWin);
      assert.equal(searches, 1);
      const winningPath = selected.plan.path.slice(), independentlyWon = factory(actual, settings);
      for (const index of winningPath) independentlyWon.tap(index);
      assert(independentlyWon.view().win);
      assert.equal(verifyAttempt(encodeGame(actual), winningPath, settings, independentlyWon.audit()), winningPath.length);
      const actions = [];
      let sawCompatibleRole = false;
      while (retry.view().type !== 'productionPhysicalEnd-v1') {
        assert(selected.plan.knownWin);
        let index = selected.plan.index;
        if (deviate && !actions.length) index = index === 0 ? 2 : 0;
        assert(retry.view().legalTiles.includes(index));
        actions.push(index); controller.acknowledge(index, true); retry.tap(index);
        const shown = observe(retry);
        sawCompatibleRole ||= shown.roles[0] === 'none' && !!retry.view().state.alive[0];
        if (retry.view().type !== 'productionPhysicalEnd-v1') {
          selected = controller.decide();
          assert.equal(searches, deviate ? 2 : 1, 'Keep compatible winning continuations, but replan once after a different physical action');
        }
      }
      assert(sawCompatibleRole);
      assert(retry.view().win);
      if (deviate) assert.notEqual(actions[0], winningPath[0]);
      else assert.deepEqual(actions, winningPath);
      assert.equal(controller.known().initialRoles[0], null);
      assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retry.audit()), actions.length);
    }
    factory.verifySource();
    console.log('PASS a physically validated winning witness survives compatible newly visible roles, retains one search and the exact winning continuation, and still independently replays the failed learning attempt and actual retry');
  } finally {
    witness.search = originalSearch;
  }
}

if (require.main === module) test();
module.exports = test;
