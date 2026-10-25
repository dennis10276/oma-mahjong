'use strict';
const assert = require('assert/strict');
const { withholdClosedRoles } = require('./fixtures/withheld_roles.js');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 10 }, (_, index) => ({ x: index === 0 ? 0 : 2 + (index - 1) * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 3, 4, 5, 2, 3, 4, 5],
    down: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], clock: null,
    rules: { ice: { 0: 1 }, iceNb: Layouts.iceNeighbors(tiles), locks: null, keys: [] } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const decisions = [];
  for (const rememberAcceptedTaps of [false, true]) {
    const controller = createHumanController(tiles, { rememberAcceptedTaps });
    const observe = session => {
      const state = session.view().state;
      const observed = observeBoard(tiles, state, null,
        { picture: index => actual.faces[index], role: withholdClosedRoles(state, index => visibleRole(actual, state, index)) });
      controller.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
        relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps }, observed);
    };
    const start = () => { controller.beginAttempt(); const session = factory(actual, settings); observe(session); return session; };
    const failed = start();
    for (const index of [1, 0, 2, 3, 4, 5]) {
      assert(failed.view().legalTiles.includes(index));
      controller.decide(); controller.acknowledge(index, true); failed.tap(index); observe(failed);
    }
    assert.equal(failed.view().why, 'tray'); controller.completeAttempt('physicalLoss');
    assert.equal(controller.known().pictures[0], 1);
    assert.equal(controller.known().initialRoles[0], null, 'An accepted tap does not reveal the hidden initial ice role');
    assert.equal(verifyAttempt(encodeGame(actual), [1, 0, 2, 3, 4, 5], settings, failed.audit()), 6);
    const retried = start();
    assert(!retried.view().legalTiles.includes(0), 'The tile really starts frozen on the next attempt');
    const selected = controller.decide(); decisions.push(selected.plan);
    if (rememberAcceptedTaps) {
      assert(selected.plan.knownWin, 'Conditional accepted availability must support the future match after removing its thawing neighbor');
      assert(controller.acceptedEvidence().some(entry => entry.index === 0 && entry.requiredGone.includes(1)));
    } else assert(!selected.plan.knownWin);
    const actions = [];
    let decision = selected;
    while (retried.view().type !== 'productionPhysicalEnd-v1') {
      assert(actions.length < 64);
      const index = decision.plan.index;
      const accepted = retried.view().legalTiles.includes(index);
      controller.acknowledge(index, accepted);
      if (accepted) { actions.push(index); retried.tap(index); observe(retried); }
      if (retried.view().type !== 'productionPhysicalEnd-v1') decision = controller.decide();
    }
    assert(retried.view().win);
    assert.equal(controller.known().initialRoles[0], null);
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retried.audit()), actions.length);
  }
  assert(!decisions[0].knownWin && decisions[1].knownWin);
  assert.deepEqual(createHumanController(tiles, { rememberAcceptedTaps: true }).acceptedEvidence(), []);
  assert.throws(() => createHumanController(tiles, { rememberAcceptedTaps: 'yes' }));
  factory.verifySource();
  console.log('PASS actual accepted taps teach conditional availability across real retries, preserve hidden initial ice and its removal prerequisites, turn the remembered route into a known winning witness and independently replay all accepted actions');
}

if (require.main === module) test();
module.exports = test;
