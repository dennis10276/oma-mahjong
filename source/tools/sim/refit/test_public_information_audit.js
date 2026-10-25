'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { describeInformation } = require('./public_information_audit.js');
const { playHumanCampaign, createHumanController, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSession, createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

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
  const known = { ...state, pictures: [1, 1, 2, 2], down: [0, 0, 0, 0] };
  const delayed = { ...game, publicExposure(position) { return !position.alive[0] && !position.alive[1] ? [2] : []; } };
  const timing = { ...REFERENCE_PARAMETERS, nodes: 1, taps: 2, beam: 4, progress: 4, finishKnown: false,
    pruneDead: false, knownPairMacros: true };
  const root = [{ index: 0 }];
  const distant = search(delayed, known, root, { ...timing, passiveInformation: 'roles' });
  const immediate = search(delayed, known, root, { ...timing, passiveInformation: 'immediateRoles' });
  assert(distant.information && distant.path.length === 2);
  assert(!immediate.information && !immediate.knownWin && !immediate.knownDead);
  assert(immediate.unknownTransitions > 0, 'Unrewarded future observations still prevent an exhaustive known-world death claim');
  assert(search(delayed, known, root, { ...timing, passiveInformation: 'shortRoles' }).information);
  assert(search(delayed, known, root, { ...timing, passiveInformation: 'shortAll' }).information);
  const nextFrame = search(game, known, root, { ...timing, passiveInformation: 'immediateRoles' });
  assert(nextFrame.information && nextFrame.path.length === 2 && nextFrame.index === 0,
    'An immediate clue keeps its credit through a fully known neutral recovery prefix');
  const distantTiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const distantGame = { tiles: distantTiles, nb: Layouts.neighbors(distantTiles), rules: null, clock: null,
    publicExposure(position) { return position.alive.slice(0, 4).every(alive => !alive) ? [4] : []; } };
  const distantState = { ...known, alive: distantTiles.map(() => 1), pictures: [1, 1, 2, 2, 3, 3], down: distantTiles.map(() => 0) };
  const horizon = { ...timing, nodes: 64, taps: 4, beam: 16, progress: 8 };
  assert(search(distantGame, distantState, root, { ...horizon, passiveInformation: 'roles' }).information);
  const short = search(distantGame, distantState, root, { ...horizon, passiveInformation: 'shortRoles' });
  assert(!short.information && short.unknownTransitions > 0 && !short.knownDead);
  const shortAll = search(distantGame, distantState, root, { ...horizon, passiveInformation: 'shortAll' });
  assert(!shortAll.information && shortAll.unknownTransitions > 0 && !shortAll.knownDead);
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
  const pictureTiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0.56, y: 0.84 / 1.24, z: 2 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
  const pictureFactory = createSessionFactory();
  let canonicalForecast = null;
  for (const picture of [...Array(36).keys(), 101]) {
    const pictureGame = { tiles: pictureTiles, nb: Layouts.neighbors(pictureTiles),
      faces: [picture, 2, 7, 7, picture, 2], down: pictureTiles.map(() => 0), rules: null, clock: null };
    const pictureSession = pictureFactory(pictureGame, settings), opening = pictureSession.view().state;
    const observe = position => observeBoard(pictureTiles, position, null,
      { picture: index => pictureGame.faces[index], role: () => 'none' });
    const first = observe(opening);
    assert.equal(first.pictures[0], null); assert.equal(first.down[0], null); assert.equal(first.roles[0], null);
    const controllers = ['shortRoles', 'shortAll'].map(mode => {
      const controller = createHumanController(pictureTiles, { passiveInformation: mode });
      controller.beginAttempt(); controller.observe(opening, first); return controller;
    });
    assert.deepEqual(controllers[0].explainInformation([2]).events, []);
    const forecast = controllers[1].explainInformation([2]);
    assert.equal(forecast.events.length, 1); assert.equal(forecast.events[0].afterTaps, 1);
    assert.deepEqual(forecast.events[0].gained, [{ index: 0, rememberedPicture: null,
      rememberedDown: null, observedRole: null, availability: 'blocked' }]);
    assert.equal(controllers[1].known().pictures[0], null, 'Forecasting exposure must not store a future picture');
    if (canonicalForecast === null) canonicalForecast = forecast; else assert.deepEqual(forecast, canonicalForecast);
    pictureSession.tap(2);
    const next = pictureSession.view().state, observation = observe(next);
    assert.equal(observation.pictures[0], picture); assert.equal(observation.roles[0], null);
    assert(!Layouts.isFree(0, next.alive, pictureGame.nb));
    controllers[1].observe(next, observation);
    assert.equal(controllers[1].known().pictures[0], picture, 'Only the actual revealed picture enters memory');
    assert.equal(verifyAttempt(encodeGame(pictureGame), [2], settings, pictureSession.audit()), 1);
  }
  pictureFactory.verifySource();
  console.log('PASS public information audits distinguish remembered identities, still-unknown roles and deduced availability, stop before hidden outcomes, preserve state and independently replay captured production campaigns');
}

if (require.main === module) test();
module.exports = test;
