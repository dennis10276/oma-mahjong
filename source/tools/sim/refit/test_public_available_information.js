'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { knownRecovery } = require('./public_known_recovery.js');
const { advance } = require('./known_tray_plan.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');
const { safeDiscoveryCount } = require('./public_information_tray_safety.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 },
    { x: 8, y: 0, z: 2 }, { x: 8, y: 0, z: 1 }, { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }];
  const neighbors = Layouts.neighbors(tiles);
  const game = { tiles, nb: neighbors, rules: null, clock: null, publicFrontier(state) {
    const free = state.alive.flatMap((alive, index) => alive && Layouts.isFree(index, state.alive, neighbors) ? [index] : []);
    return { free, uncertain: free.includes(1) ? [1] : [] };
  } };
  for (const field of ['faces', 'down', 'seed', 'deck']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const actual = { tiles, nb: neighbors, faces: [7, 7, 8, 9, 8, 9, 20, 21],
    down: [0, 1, 1, 0, 1, 1, 0, 0], rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const session = factory(actual, settings); session.tap(6); session.tap(7);
  const state = { ...session.view().state, pictures: [7, null, 8, 9, null, 9, null, null] };
  const roots = game.publicFrontier(state).free.map(index => ({ index }));
  assert.equal(knownRecovery(game, state), null);
  const options = { ...REFERENCE_PARAMETERS, nodes: 512, beam: 32, taps: 8, pruneDead: false,
    trayRecovery: false, progressiveReopens: true, shortInformation: 'recoveryAware', recoveryInformationMinTray: 2 };
  const short = search(game, state, roots, options);
  const available = search(game, state, roots, { ...options, recoveryAvailableInformation: true });
  assert(short.information && available.information && !short.knownWin && !available.knownDead);
  assert.equal(short.index, 0);
  assert.equal(available.index, 2, JSON.stringify({ short, available }));
  assert(available.path.length > short.path.length);
  const endpoint = path => {
    let current = state;
    for (const index of path) {
      const moved = advance(game, current, index);
      if (moved.uncertain) return { state: current, index, reason: moved.reason };
      assert(!moved.lost); current = moved.state;
    }
    assert.fail('Expected a genuine information boundary');
  };
  const blocked = endpoint(short.path), usable = endpoint(available.path);
  assert.equal(blocked.reason, 'unobservedObstacleRole');
  assert.equal(usable.reason, 'unseenPicture');
  assert.equal(usable.state.tray.length, blocked.state.tray.length);
  assert(!game.publicFrontier(blocked.state).free.some(index => !game.publicFrontier(blocked.state).uncertain.includes(index)
    && blocked.state.pictures[index] === null));
  const actions = [6, 7];
  for (const index of available.path) {
    if (index === usable.index) break;
    actions.push(index); session.tap(index);
  }
  for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(session.view().state[field], usable.state[field]);
  assert.equal(verifyAttempt(encodeGame(actual), actions, settings, session.audit()), actions.length);
  for (const hidden of [0, 35]) {
    const privateVariant = { ...actual, faces: actual.faces.map((picture, index) => [1, 4].includes(index) ? hidden : picture) };
    const variant = factory(privateVariant, settings);
    for (const index of actions) variant.tap(index);
    assert.deepEqual(variant.view().state, session.view().state);
    assert.equal(verifyAttempt(encodeGame(privateVariant), actions, settings, variant.audit()), actions.length);
    assert.deepEqual(search(game, state, roots, { ...options, recoveryAvailableInformation: true }), available);
  }
  const expired = search(game, state, roots, { ...options, recoveryAvailableInformation: true, deadline: 0 });
  assert(expired.boundary && !expired.knownDead);
  const expandedTiles = tiles.map(tile => ({ ...tile }));
  expandedTiles[4] = { x: 9, y: -1, z: 0 };
  expandedTiles.push({ x: 9, y: 1, z: 0 });
  const expandedNeighbors = Layouts.neighbors(expandedTiles);
  const expanded = { tiles: expandedTiles, nb: expandedNeighbors, rules: null, clock: null, publicFrontier(position) {
    const free = position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, expandedNeighbors) ? [index] : []);
    return { free, uncertain: free.filter(index => [1, 4, 8].includes(index)) };
  } };
  const expandedState = { ...state, alive: [...state.alive, 1], down: [...state.down, 1], pictures: [...state.pictures, null] };
  const expandedRoots = expanded.publicFrontier(expandedState).free.map(index => ({ index }));
  assert.equal(knownRecovery(expanded, expandedState), null);
  const narrow = search(expanded, expandedState, expandedRoots, options);
  const broader = search(expanded, expandedState, expandedRoots, { ...options, recoveryInformationBreadth: true });
  assert.equal(narrow.index, 0);
  assert.equal(broader.index, 2);
  let broaderPosition = expandedState;
  const broaderPrefix = [];
  for (const index of broader.path) {
    const moved = advance(expanded, broaderPosition, index);
    if (moved.uncertain) break;
    assert(!moved.lost); broaderPosition = moved.state; broaderPrefix.push(index);
  }
  const broaderAllowed = expanded.publicFrontier(broaderPosition);
  assert.equal(safeDiscoveryCount(broaderPosition, broaderAllowed), 2);
  assert(broaderAllowed.uncertain.includes(4) && broaderAllowed.uncertain.includes(8));
  const expandedActual = { ...actual, tiles: expandedTiles, nb: expandedNeighbors,
    faces: [...actual.faces, 10], down: [...actual.down, 1] };
  const broaderSession = factory(expandedActual, settings);
  for (const index of [6, 7, ...broaderPrefix]) broaderSession.tap(index);
  assert.deepEqual(broaderSession.view().state.tray, broaderPosition.tray);
  assert.equal(verifyAttempt(encodeGame(expandedActual), [6, 7, ...broaderPrefix], settings, broaderSession.audit()), broaderPrefix.length + 2);
  assert.equal(safeDiscoveryCount({ alive: [1, 1, 1], pictures: [null, null, null], down: [1, 0, null],
    tray: [20, 21, 8], openPeek: -1 }, { free: [0, 1, 2], uncertain: [0] }), 1);
  assert.throws(() => search(game, state, roots, { ...options, recoveryInformationBreadth: 1 }));
  factory.verifySource();
  console.log('PASS crowded adaptive information prefers a longer public physical route to guaranteed available discovery over a shorter uncertain-role boundary, without reading either hidden identity or claiming safety beyond the observation');
}

if (require.main === module) test();
module.exports = test;
