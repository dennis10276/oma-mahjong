'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { describeInformation } = require('./public_information_audit.js');
const { playHumanCampaign, createHumanController, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSession } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), clock: null, rules: null,
    publicFrontier(position) { return { free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [] }; },
    publicExposure(position) { return !position.alive[0] ? [2] : []; } };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: [1, 1, 1, 1], pictures: [1, 1, 2, null], down: [0, 0, 0, 1],
    tray: [], openPeek: -1, moves: 0, relieved: false, arriving: [] };
  const snapshot = structuredClone(state);
  const report = describeInformation(game, state, [0, 1, 3], ['none', 'none', null, null]);
  assert.deepEqual(report.events, [{ afterTaps: 1, index: 0, tray: [1], gained: [{ index: 2,
    rememberedPicture: 2, rememberedDown: 0, observedRole: null, availability: 'guaranteedFree' }] }]);
  assert.deepEqual(report.boundary, { afterTaps: 2, index: 3, reason: 'unseenPicture' });
  assert.deepEqual(state, snapshot);
  const uncertain = { ...game, publicFrontier(position) { return { free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [2] }; } };
  assert.equal(describeInformation(uncertain, state, [0], ['none', 'none', null, null]).events[0].gained[0].availability, 'uncertain');
  const actual = { tiles, nb: game.nb, faces: [1, 1, 2, 2], down: [0, 0, 1, 1], clock: null, rules: null };
  const captured = playHumanCampaign(actual, { captureDecisions: true, captureInformation: true });
  const plain = playHumanCampaign(actual, { captureDecisions: true });
  assert.equal(captured.wonOn, plain.wonOn);
  assert.deepEqual(captured.attempts[0].actions, plain.attempts[0].actions);
  assert(captured.attempts[0].decisions.every(choice => choice.informationAudit));
  assert.throws(() => playHumanCampaign(actual, { captureInformation: true }));
  const layered = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
  const physical = { tiles: layered, nb: Layouts.neighbors(layered), faces: [3, 1, 2, 1, 2, 3],
    down: layered.map(() => 0), rules: null, clock: null };
  const settings = { seed: 1, choiceLimit: 32, tapMs: 1000 }, session = createSession(physical, settings);
  const initial = session.view().state, observed = observeBoard(layered, initial, null,
    { picture: index => physical.faces[index], role: () => 'none' });
  assert.equal(observed.roles[0], null);
  assert.equal(observed.pictures[0], 3);
  for (const mode of ['roles', 'frontierRoles']) {
    const controller = createHumanController(layered, { passiveInformation: mode });
    controller.beginAttempt(); controller.observe(initial, observed);
    const inspected = controller.explainInformation([1, 2]);
    assert.equal(inspected.events.length, 1);
    assert.equal(inspected.events[0].afterTaps, mode === 'roles' ? 1 : 2);
    assert.equal(inspected.events[0].gained[0].availability, mode === 'roles' ? 'blocked' : 'uncertain');
    assert.equal(inspected.events[0].gained[0].observedRole, null);
    assert.equal(controller.known().initialRoles[0], null);
  }
  session.tap(1); assert(!Layouts.isFree(0, session.view().state.alive, physical.nb));
  session.tap(2); assert(Layouts.isFree(0, session.view().state.alive, physical.nb));
  assert.equal(verifyAttempt(encodeGame(physical), [1, 2], settings, session.audit()), 2);
  console.log('PASS public information audits distinguish remembered identities, still-unknown roles and deduced availability, stop before hidden outcomes, preserve state and independently replay captured production campaigns');
}

if (require.main === module) test();
module.exports = test;
