'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { advance } = require('./known_tray_plan.js');
const { informationActions } = require('./public_information_actions.js');

function test() {
  const tiles = Array.from({ length: 4 }, (unused, index) => ({ x: index * 3, y: 0, z: 0 }));
  const geometry = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  const pictures = [0, 0, 1, 1], down = [1, 0, 0, 0];
  const state = { alive: [1, 1, 1, 1], pictures, down, tray: [], moves: 0, openPeek: -1,
    relieved: false, arriving: [] };
  const choices = informationActions(geometry, state, [0, 1, 2, 3]);
  assert(choices.some(choice => JSON.stringify(choice.path) === '[0,0]'));
  assert(choices.some(choice => JSON.stringify(choice.path) === '[0,1]'));
  assert(!choices.some(choice => JSON.stringify(choice.path) === '[0]'));
  assert.deepEqual(choices.map(choice => choice.id), choices.map((unused, index) => index));
  const factory = createSessionFactory();
  for (const choice of choices) {
    const session = factory({ ...geometry, faces: pictures, down }, { seed: 7, choiceLimit: 32, tapMs: 1000 });
    let predicted = state;
    for (const index of choice.path) {
      const moved = advance(geometry, predicted, index);
      assert.equal(moved.uncertain, undefined); assert.equal(moved.lost, false);
      assert(session.view().legalTiles.includes(index));
      const actual = session.tap(index);
      for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(actual.state[field], moved.state[field]);
      predicted = moved.state;
    }
  }
  const unknown = informationActions(geometry, { ...state, pictures: [0, 0, 1, null] }, [0, 3]);
  assert(unknown.some(choice => choice.path.length === 1 && choice.index === 3 && choice.kind === 'information'));
  assert(unknown.some(choice => JSON.stringify(choice.path) === '[0,3]' && choice.kind === 'knownPeekThenInformation'));
  const crowded = informationActions(geometry, { ...state, tray: [2, 3, 4] }, [0]);
  assert(!crowded.some(choice => JSON.stringify(choice.path) === '[0,0]'));
  assert(crowded.some(choice => JSON.stringify(choice.path) === '[0,1]'));
  const originals = JSON.stringify(state);
  informationActions(geometry, state, [0, 1]); assert.equal(JSON.stringify(state), originals);
  const clockGeometry = { ...geometry, clock: { i: 2, n: 1 } };
  const clockChoices = informationActions(clockGeometry, state, [0]);
  assert.deepEqual(clockChoices.map(choice => choice.path), [[0, 2]]);
  const clockSession = factory({ ...clockGeometry, faces: pictures, down }, { seed: 7, choiceLimit: 32, tapMs: 1000 });
  for (const index of clockChoices[0].path) clockSession.tap(index);
  assert.equal(clockSession.view().state.moves, 1); assert.equal(clockSession.view().state.alive[2], 0);
  assert.notEqual(clockSession.view().type, 'productionPhysicalEnd-v1');
  const uncertainRole = { ...geometry, publicFrontier: () => ({ free: [0, 1, 2, 3], uncertain: [0], relieved: false }) };
  assert.deepEqual(informationActions(uncertainRole, state, [0]).map(choice => choice.path), [[0]]);
  assert.throws(() => informationActions({ ...geometry, faces: pictures }, state, [0]));
  factory.verifySource();
  console.log('PASS known zero-progress peeks expand to separately scored physical take/pair/information options; unknown single looks remain, proven second-tap losses are omitted, and every known option independently matches production without hidden pictures');
}

if (require.main === module) test();
module.exports = test;
