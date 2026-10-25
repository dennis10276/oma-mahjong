'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { createDrawnRoleFrontier, drawnRolePlanningAllowed } = require('./public_drawn_role_frontier.js');
const { explorationWitness } = require('./public_exploration_witness.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
    ...Array.from({ length: 6 }, (unused, index) => ({ x: 8 + index * 4, y: 0, z: 0 }))];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [7, 2, 2, 3, 3, 4, 4, 7],
    down: tiles.map((tile, index) => +(index === 0)), clock: null,
    rules: { ice: {}, iceNb: Layouts.iceNeighbors(tiles), locks: null, keys: [0, 7] } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  for (const drawnRoleInformation of [false, true]) {
    const controller = createHumanController(tiles, { drawnRoleInformation, passiveInformation: 'roles', retryInformationWitness: true });
    const session = factory(actual, settings); controller.beginAttempt();
    const observe = () => {
      const view = session.view(), state = view.state, legal = new Set(view.legalTiles ?? []);
      const frame = observeBoard(tiles, state, null, { picture: index => actual.faces[index],
        role: index => visibleRole(actual, state, index), takeable: index => legal.has(index) });
      controller.observe(state, frame); return frame;
    };
    const opening = observe();
    assert.equal(opening.roles[0], null); assert.equal(opening.down[0], 1); assert.equal(opening.pictures[0], null);
    const prediction = controller.explainInformation([1]);
    assert.equal(prediction.boundary, null); assert.equal(prediction.events.length, +drawnRoleInformation);
    if (drawnRoleInformation) {
      assert.deepEqual(prediction.events[0].gained.map(gain => gain.index), [0]);
      assert.equal(prediction.events[0].gained[0].rememberedPicture, null);
      assert.equal(prediction.events[0].gained[0].observedRole, null);
    }
    const actions = [1, 0, 7, 2, 3, 4, 5, 6];
    for (const [offset, index] of actions.entries()) {
      assert(session.view().legalTiles.includes(index));
      controller.decide(); controller.acknowledge(index, true); session.tap(index);
      const frame = observe();
      if (offset === 0) {
        assert.equal(frame.roles[0], 'key'); assert.equal(frame.pictures[0], null);
        assert.equal(controller.known().pictures[0], null, 'Predicting back-symbol exposure never discloses the hidden picture');
      }
      if (offset === 1) assert.equal(controller.known().pictures[0], 7, 'Only the actual required peek learns the picture');
    }
    assert(session.view().win); controller.completeAttempt('cleared');
    assert.equal(verifyAttempt(encodeGame(actual), actions, settings, session.audit()), actions.length);
    const state = { alive: tiles.map(() => 1), down: opening.down, pictures: opening.pictures,
      tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 };
    const publicGame = { tiles, nb: actual.nb, rules: null, clock: null,
      ...(drawnRoleInformation ? { publicRoleExposure: createDrawnRoleFrontier(tiles, { ...state, roles: opening.roles }, 'roles') } : {}) };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(publicGame, field,
      { get() { throw Error('Private ' + field); } });
    const snapshot = JSON.stringify(state), route = explorationWitness(publicGame, state, [{ index: 1 }], { nodes: 64, taps: 8 });
    assert.deepEqual(route.path, drawnRoleInformation ? [1] : [1, 0]);
    assert.equal(route.kind, drawnRoleInformation ? 'newPublicExposure' : 'actualPeekRequired');
    assert.equal(route.imaginedPicturesAdded, 0); assert.equal(JSON.stringify(state), snapshot);
    if (drawnRoleInformation) assert.deepEqual(route.newlyExposed, [0]);
  }
  const state = { alive: tiles.map(() => 1), moves: 0, relieved: false };
  const publicGame = { tiles, nb: actual.nb, rules: null, clock: { i: 7, n: 20 } };
  for (const field of ['faces', 'deck', 'seed', 'down']) Object.defineProperty(publicGame, field,
    { get() { throw Error('Private gate ' + field); } });
  assert(drawnRolePlanningAllowed(publicGame, state, [19, 19]));
  assert(!drawnRolePlanningAllowed(publicGame, state, [20, 30]));
  assert(!drawnRolePlanningAllowed(publicGame, state, [0, 18]));
  assert(!drawnRolePlanningAllowed(publicGame, { ...state, moves: 1 }, [19, 19]));
  assert(!drawnRolePlanningAllowed(publicGame, { ...state, alive: state.alive.map((alive, index) => index === 7 ? 0 : alive) }, [0, 100]));
  assert(!drawnRolePlanningAllowed({ ...publicGame, clock: null }, state, [0, 100]));
  assert(drawnRolePlanningAllowed({ ...publicGame, clock: null }, state));
  const keyGame = { ...publicGame, rules: { ice: {}, iceNb: Layouts.iceNeighbors(tiles), locks: new Set([7]), keys: [6] } };
  assert(!drawnRolePlanningAllowed(keyGame, state, [16, 16]));
  assert(drawnRolePlanningAllowed(keyGame, state, [16, 16], [0]));
  for (const invalid of [null, [], [20, 10], [1.5, 20], [0, 1, 2]]) {
    assert.throws(() => drawnRolePlanningAllowed(publicGame, state, invalid));
    assert.throws(() => createHumanController(tiles, { drawnRoleInformation: true, drawnRoleClockSlackRange: invalid }));
  }
  assert.throws(() => createHumanController(tiles, { drawnRoleClockSlackRange: [5, 20] }));
  for (const [clock, range, expected] of [[{ i: 7, n: 20 }, [19, 19], 1],
    [{ i: 7, n: 20 }, [20, 30], 0], [{ i: 7, n: 20 }, [0, 18], 0], [null, [0, 100], 0]]) {
    const game = { ...actual, clock }, session = factory(game, settings);
    const controller = createHumanController(tiles,
      { drawnRoleInformation: true, drawnRoleClockSlackRange: range, passiveInformation: 'roles', retryInformationWitness: true });
    controller.beginAttempt();
    const view = session.view(), legal = new Set(view.legalTiles ?? []);
    const observed = observeBoard(tiles, view.state, clock, { picture: index => actual.faces[index],
      role: index => visibleRole(game, view.state, index), takeable: index => legal.has(index) });
    controller.observe(view.state, observed);
    assert.equal(controller.explainInformation([1]).events.length, expected);
    assert.equal(controller.known().pictures[0], null);
  }
  assert.throws(() => createHumanController(tiles, { drawnRoleInformation: 'yes' }));
  factory.verifySource();
  console.log('PASS ordinary and retry information planning recognize future drawn-back-symbol exposure without guessing its role or picture, actual peeks remain required, private fields stay unread and both physical clears independently replay');
}

if (require.main === module) test();
module.exports = test;
