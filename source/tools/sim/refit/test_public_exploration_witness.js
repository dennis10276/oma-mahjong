'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { explorationWitness } = require('./public_exploration_witness.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { advance } = require('./known_tray_plan.js');

function test() {
  const tiles = Array.from({ length: 4 }, (value, index) => ({ x: index * 4, y: 0, z: 0 }));
  const geometry = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(geometry, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: [1, 1, 1, 1], pictures: [null, 5, 6, 6], down: [1, 0, 0, 0],
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const snapshot = JSON.stringify(state), roots = [0, 1, 2, 3].map(index => ({ index }));
  const result = explorationWitness(geometry, state, roots, { nodes: 100, deadline: Date.now() + 1000 });
  assert.equal(result.kind, 'actualPeekRequired');
  assert.deepEqual(result.path, [0]); assert.equal(result.knownPrefixTaps, 0);
  assert.equal(result.boundaryIndex, 0); assert.equal(result.knownWin, false);
  assert.equal(result.imaginedPicturesAdded, 0); assert.equal(JSON.stringify(state), snapshot);
  assert.equal(advance(geometry, state, 0).reason, 'unseenPicture');
  const factory = createSessionFactory();
  for (const hidden of [5, 6, 7, 101]) {
    const game = { tiles, nb: geometry.nb, faces: [hidden, 5, 6, 6], down: state.down, rules: null, clock: null };
    const session = factory(game, { seed: 1, tapMs: 1000, choiceLimit: 16 });
    const observed = session.tap(result.path[0]);
    assert.equal(observed.state.openPeek, 0);
    assert.equal(state.pictures[0], null);
  }
  const expired = explorationWitness(geometry, state, roots, { deadline: Date.now() - 1 });
  assert.equal(expired.path, null); assert.equal(expired.reason, 'deadline');
  const tight = { ...geometry, clock: { i: 3, n: 2 } };
  const tightResult = explorationWitness(tight, state, [{ index: 0 }], { nodes: 20, deadline: Date.now() + 1000 });
  assert.equal(tightResult.path, null, 'An unknown peek is not guaranteed clock-safe when two moves remain');
  const crowded = explorationWitness(geometry, { ...state, tray: [8, 9] }, [{ index: 0 }],
    { nodes: 20, deadline: Date.now() + 1000 });
  assert.equal(crowded.path, null, 'Information search cannot assume an unknown picture will recover a crowded tray');
  for (const hidden of [...Array(36).keys(), 101]) {
    const game = { tiles, nb: geometry.nb, faces: [hidden, 5, 6, 7], down: [1, 0, 1, 0], rules: null, clock: { i: 3, n: 4 } };
    const session = factory(game, { seed: 1, tapMs: 1000, choiceLimit: 16 });
    session.tap(1); session.tap(2);
    const actual = session.view().state;
    const position = Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving'].map(field => [field, actual[field]]));
    position.pictures = [null, 5, 6, 7]; position.down = game.down.slice();
    const publicGame = { ...geometry, clock: game.clock };
    const clockPlan = explorationWitness(publicGame, position, [{ index: 0 }], { nodes: 20, deadline: Date.now() + 1000 });
    assert.deepEqual(clockPlan.path, [0]);
    const observed = session.tap(0);
    assert.notEqual(observed.why, 'clock', 'The unknown peek must leave room even when an ordinary open pair removes two tiles');
    assert.equal(position.pictures[0], null);
  }
  const forced = explorationWitness(geometry, state, [{ index: 2 }], { nodes: 100, deadline: Date.now() + 1000 });
  assert.equal(forced.path[0], 2); assert.equal(forced.path.at(-1), 0);
  assert.equal(forced.knownPrefixTaps, forced.path.length - 1);
  const pairedSession = factory({ tiles, nb: geometry.nb, faces: [7, 5, 6, 6], down: state.down, rules: null, clock: null },
    { seed: 1, tapMs: 1000, choiceLimit: 16 });
  let position = structuredClone(state);
  for (const index of forced.path.slice(0, -1)) {
    const predicted = advance(geometry, position, index); assert(!predicted.uncertain && !predicted.lost);
    const observed = pairedSession.tap(index);
    for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(observed.state[field], predicted.state[field]);
    position = predicted.state;
  }
  pairedSession.tap(forced.boundaryIndex);
  assert.equal(pairedSession.view().state.openPeek, 0);
  const stackTiles = Array.from({ length: 6 }, (value, index) => ({ x: 0, y: 0, z: index }))
    .concat(Array.from({ length: 6 }, (value, index) => ({ x: 4 + index * 4, y: 0, z: 0 })));
  const stackFaces = [7, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 7];
  const stackDown = stackTiles.map((tile, index) => +(index === 0));
  const stackGeometry = { tiles: stackTiles, nb: Layouts.neighbors(stackTiles), rules: null, clock: null };
  const stackState = { alive: stackTiles.map(() => 1), pictures: stackFaces.map((picture, index) => index === 0 ? null : picture),
    down: stackDown, tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const deep = explorationWitness(stackGeometry, stackState, [{ index: 5 }], { nodes: 2000, deadline: Date.now() + 1000 });
  assert(deep.path && deep.knownPrefixTaps >= 5, 'The search must reach a hidden bottom through multiple known stack removals');
  assert.equal(deep.path[0], 5); assert.equal(deep.path.at(-1), 0);
  assert.equal(deep.boundaryIndex, 0); assert.equal(deep.knownWin, false);
  const deepSession = factory({ ...stackGeometry, faces: stackFaces, down: stackDown }, { seed: 1, tapMs: 1000, choiceLimit: 64 });
  let deepPosition = structuredClone(stackState);
  for (const index of deep.path.slice(0, -1)) {
    const predicted = advance(stackGeometry, deepPosition, index); assert(!predicted.uncertain && !predicted.lost);
    const observed = deepSession.tap(index);
    for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(observed.state[field], predicted.state[field]);
    deepPosition = predicted.state;
  }
  assert.equal(stackState.pictures[0], null); deepSession.tap(deep.boundaryIndex);
  factory.verifySource();
  console.log('PASS bounded information witnesses preserve unknown pictures, require actual peeks, retain public root restrictions, reject crowded/tight-clock assumptions and replay known physical prefixes');
}

if (require.main === module) test();
module.exports = test;
