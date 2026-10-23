'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { observeBoard, tileVisibility } = require('./human_board_visibility.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { createSession } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');
const { legal } = require('./known_tray_plan.js');
const { search } = require('./public_witness_search.js');

function test() {
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
    assert.equal(frontier(state), false);
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
    assert.deepEqual(informed.path, [1], 'Stop at the first actual known prefix that permits observation, before continuing a pair macro blindly');
    if (canonicalPlan === null) canonicalPlan = informed; else assert.deepEqual(informed, canonicalPlan);
    session.tap(1);
    const after = session.view().state;
    assert.equal(Layouts.isFree(0, after.alive, actualGame.nb), false, 'A picture can be revealed before its tile becomes takeable');
    assert.equal(frontier(after), true);
    const second = observe(after);
    assert.equal(second.down[0], hiddenDown);
    assert.equal(second.pictures[0], hiddenDown ? null : hiddenPicture);
    assert.equal(verifyAttempt(encodeGame(actualGame), [1], settings, session.audit()), 1);
    const rememberedBack = createExposureFrontier(tiles, { ...state, down: [1, ...state.down.slice(1)] });
    assert.equal(rememberedBack(after), false, 'Exposing a remembered back does not disclose its picture');
    const rememberedPicture = createExposureFrontier(tiles, { ...state, down: [0, ...state.down.slice(1)], pictures: [hiddenPicture, ...state.pictures.slice(1)] });
    assert.equal(rememberedPicture(after), false);
    const unknownRoles = first.roles.slice();
    const roleOnly = { ...state, down: [0, ...state.down.slice(1)], pictures: [hiddenPicture, ...state.pictures.slice(1)], roles: unknownRoles };
    assert.equal(createExposureFrontier(tiles, roleOnly)(after), true);
    unknownRoles[0] = 'none';
    assert.equal(createExposureFrontier(tiles, roleOnly)(after), false);
    const knownFaceUp = createExposureFrontier(tiles, { ...state, down: [0, ...state.down.slice(1)] });
    assert.equal(knownFaceUp(after), true);
    assert.equal(knownFaceUp({ alive: [0, ...after.alive.slice(1)] }), false);
    const restored = { ...after, alive: initial.alive.slice() };
    assert.equal(frontier(restored), false); restored.alive[1] = 0;
    assert.equal(frontier(restored), true);
    const full = tileVisibility(tiles, after, null), selected = tileVisibility(tiles, after, null, [0, 4]);
    for (const [index, visible] of full.tiles.entries()) assert.deepEqual(selected.tiles[index], [0, 4].includes(index) ? visible : null);
    assert.throws(() => tileVisibility(tiles, after, null, [-1]));
    assert(legal(actualGame, after).free.includes(2));
    controls++;
  }
  console.log('PASS ' + controls + ' concealed worlds produce identical public information-stop plans before takeability; orientation, pictures and roles are never sampled, subset masks match the central gate, and the prefix independently replays in production');
}

if (require.main === module) test();
module.exports = test;
