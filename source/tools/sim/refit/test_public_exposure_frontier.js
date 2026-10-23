'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { observeBoard, tileVisibility } = require('./human_board_visibility.js');
const { createExposureFrontier, informationInCone } = require('./public_exposure_frontier.js');
const { createSession } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');
const { legal } = require('./known_tray_plan.js');
const { search } = require('./public_witness_search.js');

function test() {
  const cone = new Set([1, 2]);
  assert.equal(informationInCone(cone, 1, [4]), false, 'A clock-route removal must not give clock relevance to unrelated information');
  assert.equal(informationInCone(cone, 4, [1]), true, 'Information about the clock route remains relevant even if an outside tile uncovered it');
  assert.equal(informationInCone(cone, 1), true);
  assert.equal(informationInCone(cone, 4), false);
  assert.equal(informationInCone(cone, 1, []), false);
  assert.equal(informationInCone(null, 1, [1]), false);
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0.28, y: 0.28 / 1.24, z: 1 }, { x: 1, y: 0, z: 1 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 },
    { x: 12.28, y: 0.28 / 1.24, z: 1 }, { x: 20, y: 0, z: 0 }];
  for (const tile of tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Private geometry picture'); } });
  let controls = 0, canonical = null, canonicalPlan = null;
  for (const hiddenDown of [0, 1]) for (let hiddenPicture = 0; hiddenPicture < 36; hiddenPicture++) {
    const actualGame = { tiles, nb: Layouts.neighbors(tiles), faces: [hiddenPicture, 7, 9, 7, hiddenPicture, 9, 2, 2],
      down: [hiddenDown, 0, 0, 0, 0, 0, 0, 0], rules: null, clock: null };
    const settings = { seed: 1, choiceLimit: 16, tapMs: 1000 }, session = createSession(actualGame, settings);
    const observe = state => observeBoard(tiles, state, null, { picture: index => actualGame.faces[index], role: () => 'none' });
    const initial = session.view().state, first = observe(initial);
    assert.equal(first.pictures[0], null); assert.equal(first.down[0], null);
    assert.equal(first.pictures[4], null);
    if (canonical === null) canonical = first; else assert.deepEqual(first, canonical);
    const state = { ...initial, pictures: first.pictures, down: first.down };
    const frontier = createExposureFrontier(tiles, state);
    assert.deepEqual(frontier(state), []);
    const publicGame = { tiles, nb: actualGame.nb, rules: null, clock: null,
      publicFrontier(position) {
        const free = position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, actualGame.nb) ? [index] : []);
        return { free, uncertain: free.filter(index => first.roles[index] === null) };
      } };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(publicGame, field, { get() { throw Error('Private ' + field); } });
    const options = { taps: 2, nodes: 1, beam: 1, pruneDead: false, knownPairMacros: true };
    const blind = search(publicGame, state, [{ index: 1 }], options);
    assert(!blind.information && blind.knownProgress === 2);
    publicGame.publicExposure = frontier;
    const informed = search(publicGame, state, [{ index: 1 }], options);
    assert(informed.information && !informed.knownDead && !informed.knownWin && informed.unknownTransitions > 0);
    assert.deepEqual(informed.path, [1, 3], 'Value newly readable information without discarding a continuation using only previously known pictures');
    const carried = search(publicGame, state, [{ index: 1 }], { ...options, taps: 1 });
    assert.equal(carried.goal, 'boundedProgress', 'Uncovering information by adding an unmatched carrier must not receive risk-neutral information priority');
    assert(carried.information && !carried.knownDead);
    if (canonicalPlan === null) canonicalPlan = informed; else assert.deepEqual(informed, canonicalPlan);
    const clockGame = { ...publicGame, clock: { i: 2, n: 3 } };
    const clockPlan = search(clockGame, state, [{ index: 1 }], { ...options, taps: 4, nodes: 64, beam: 8 });
    assert(clockPlan.safeClockExit, 'Newly readable fields must not erase an already known physically safe clock continuation');
    const clockActual = { ...actualGame, clock: clockGame.clock }, clockSession = createSession(clockActual, settings);
    for (const index of clockPlan.path) clockSession.tap(index);
    assert.equal(clockSession.view().state.alive[2], 0);
    assert(clockSession.view().state.tray.length <= 2);
    assert.equal(verifyAttempt(encodeGame(clockActual), clockPlan.path, settings, clockSession.audit()), clockPlan.path.length);
    session.tap(1);
    const after = session.view().state;
    assert.equal(Layouts.isFree(0, after.alive, actualGame.nb), false, 'A picture can be revealed before its tile becomes takeable');
    assert.deepEqual(frontier(after), [0]); assert(Object.isFrozen(frontier(after)));
    const second = observe(after);
    assert.equal(second.down[0], hiddenDown);
    assert.equal(second.pictures[0], hiddenDown ? null : hiddenPicture);
    assert.equal(verifyAttempt(encodeGame(actualGame), [1], settings, session.audit()), 1);
    const rememberedBack = createExposureFrontier(tiles, { ...state, down: [1, ...state.down.slice(1)] });
    assert.deepEqual(rememberedBack(after), [], 'Exposing a remembered back does not disclose its picture');
    const rememberedPicture = createExposureFrontier(tiles, { ...state, down: [0, ...state.down.slice(1)], pictures: [hiddenPicture, ...state.pictures.slice(1)] });
    assert.deepEqual(rememberedPicture(after), []);
    const unknownRoles = first.roles.slice();
    const roleOnly = { ...state, down: [0, ...state.down.slice(1)], pictures: [hiddenPicture, ...state.pictures.slice(1)], roles: unknownRoles };
    assert.deepEqual(createExposureFrontier(tiles, roleOnly)(after), [0]);
    unknownRoles[0] = 'none';
    assert.deepEqual(createExposureFrontier(tiles, roleOnly)(after), []);
    const knownFaceUp = createExposureFrontier(tiles, { ...state, down: [0, ...state.down.slice(1)] });
    assert.deepEqual(knownFaceUp(after), [0]);
    assert.deepEqual(knownFaceUp({ alive: [0, ...after.alive.slice(1)] }), []);
    const restored = { ...after, alive: initial.alive.slice() };
    assert.deepEqual(frontier(restored), []); restored.alive[1] = 0;
    assert.deepEqual(frontier(restored), [0]);
    const full = tileVisibility(tiles, after, null), selected = tileVisibility(tiles, after, null, [0, 4]);
    for (const [index, visible] of full.tiles.entries()) assert.deepEqual(selected.tiles[index], [0, 4].includes(index) ? visible : null);
    assert.throws(() => tileVisibility(tiles, after, null, [-1]));
    assert(legal(actualGame, after).free.includes(2));
    session.tap(3);
    assert.equal(verifyAttempt(encodeGame(actualGame), informed.path, settings, session.audit()), informed.path.length);
    controls++;
  }
  console.log('PASS ' + controls + ' concealed worlds value new geometry-visible information before takeability without discarding known pair/clock witnesses; no future values are sampled, subset masks match the central gate, and both continuations independently replay in production');
}

if (require.main === module) test();
module.exports = test;
