'use strict';
const assert = require('assert/strict');
const { withholdClosedRoles } = require('./fixtures/withheld_roles.js');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt, playHumanCampaign } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 14 }, (unused, index) => ({ x: index === 0 ? 0 : 2 + (index - 1) * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 9, 9, 3, 3, 4, 4, 5, 5, 6, 6],
    down: tiles.map((unused, index) => +(index === 0)), clock: null,
    rules: { ice: { 0: 1 }, iceNb: Layouts.iceNeighbors(tiles), locks: new Set(), keys: [4, 5] } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  for (const rememberBlockedTaps of [false, true]) {
    const controller = createHumanController(tiles, { exclusiveRoles: true, rememberBlockedTaps });
    const observe = session => {
      const state = session.view().state;
      controller.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
        relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps },
      observeBoard(tiles, state, null, { picture: index => actual.faces[index], role: withholdClosedRoles(state, index => visibleRole(actual, state, index)) }));
    };
    const take = (session, index) => {
      assert(session.view().legalTiles.includes(index));
      controller.decide(); controller.acknowledge(index, true); session.tap(index); observe(session);
    };
    controller.beginAttempt(); const failed = factory(actual, settings); observe(failed);
    assert(!failed.view().legalTiles.includes(0)); controller.decide();
    const beforeRejected = structuredClone(failed.view()); controller.acknowledge(0, false);
    assert.deepEqual(failed.view(), beforeRejected, 'The real rejected probe consumes no move, physical tap or new try');
    assert.equal(controller.known().pictures[0], null); assert.equal(controller.known().initialRoles[0], null);
    take(failed, 2);
    assert.equal(controller.explainInformation([0]).boundary.reason,
      rememberBlockedTaps ? 'blockedKnownSuffix' : 'unobservedObstacleRole');
    for (const index of [3, 6, 8, 10, 12]) take(failed, index);
    assert.equal(failed.view().why, 'tray'); controller.completeAttempt('physicalLoss');
    assert.equal(verifyAttempt(encodeGame(actual), [2, 3, 6, 8, 10, 12], settings, failed.audit()), 6);
    controller.beginAttempt(); const retried = factory(actual, settings); observe(retried);
    assert(!retried.view().legalTiles.includes(0));
    assert.equal(controller.explainInformation([0]).boundary.reason,
      rememberBlockedTaps ? 'blockedKnownSuffix' : 'unobservedObstacleRole');
    assert.equal(controller.blockedEvidence().length, +rememberBlockedTaps);
    assert.equal(controller.known().initialRoles[0], null, 'A rejected tap reveals an obstruction, not its initial ice/lock identity');
    const actions = [2, 3, 1, 0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    for (const index of actions) take(retried, index);
    assert(retried.view().win);
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retried.audit()), actions.length);
    assert.equal(controller.known().initialRoles[0], null);
  }
  const wrongGraph = structuredClone(actual); wrongGraph.rules.iceNb[0] = [];
  assert.throws(() => playHumanCampaign(wrongGraph, { planning: { rememberBlockedTaps: true } }), /geometric ice neighborhood/);
  assert.throws(() => createHumanController(tiles, { rememberBlockedTaps: 'yes' }));
  assert.deepEqual(createHumanController(tiles, { rememberBlockedTaps: true }).blockedEvidence(), []);
  factory.verifySource();
  console.log('PASS an actual rejected free-tile probe teaches obstacle-only evidence, preserves it after unrelated removals and a real failed attempt, releases the inference after thawing, invents no picture/role and independently replays both failures and complete retry clears');
}

if (require.main === module) test();
module.exports = test;
