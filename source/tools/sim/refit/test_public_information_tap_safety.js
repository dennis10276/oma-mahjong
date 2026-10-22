'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { informationTraySafe } = require('./public_information_tray_safety.js');
const { createSession } = require('./production_physical_session.js');

function test() {
  const faces = [1, 2, 3, 9, 1, 2, 3, 9];
  const tiles = faces.map((picture, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actualGame = { tiles, nb: Layouts.neighbors(tiles), faces, down: faces.map(() => 0), rules: null, clock: null };
  const session = createSession(actualGame);
  for (const index of [0, 1, 2]) session.tap(index);
  const state = { ...session.view().state, pictures: faces.map((picture, index) => index < 3 ? null : picture) };
  const game = { tiles, nb: actualGame.nb, clock: null,
    publicFrontier(position) {
      return { free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: position.alive[3] ? [3] : [] };
    } };
  for (const field of ['faces', 'rules', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const allowed = game.publicFrontier(state);
  assert(!informationTraySafe(state, 3, true, allowed), 'A different free tray match does not make this unmatched uncertain tap safe');
  assert(informationTraySafe(state, 4, true, allowed));
  assert(informationTraySafe(state, 3, false, allowed), 'Passive revelation after a known prefix needs no extra commitment');
  assert(informationTraySafe({ ...state, down: state.down.map((value, index) => index === 3 ? 1 : value) }, 3, true, allowed));
  assert(!informationTraySafe({ ...state, down: state.down.map((value, index) => index === 3 ? null : value) }, 3, true, allowed));
  const peeked = { ...state, openPeek: 7, down: state.down.map((value, index) => index === 7 ? 1 : value) };
  assert(informationTraySafe(peeked, 3, true, allowed));
  assert(!informationTraySafe(peeked, 3, true, { ...allowed, uncertain: [3, 7] }));
  const options = { ...REFERENCE_PARAMETERS, nodes: 1, taps: 1, beam: 1, finishKnown: false,
    pruneDead: false, trayRecovery: false };
  const planned = search(game, state, [{ index: 3 }, { index: 4 }], options);
  assert.equal(planned.index, 4, 'A guaranteed tray escape must outrank an uncertain fourth unmatched commitment');
  session.tap(planned.index);
  assert.deepEqual(session.view().state.tray, [2, 3]);
  const unsafe = createSession(actualGame);
  for (const index of [0, 1, 2, 3]) unsafe.tap(index);
  assert.equal(unsafe.view().why, 'tray', 'The rejected old choice really is an immediate production loss');
  const twin = createSession({ ...actualGame, down: peeked.down });
  for (const index of [0, 1, 2, 7, 3]) twin.tap(index);
  assert.deepEqual(twin.view().state.tray, [1, 2, 3]);
  assert.equal(twin.view().state.alive[3], 0); assert.equal(twin.view().state.alive[7], 0);
  console.log('PASS information-action tray safety belongs to the actual boundary tap, not to an unrelated free match; unopened peeks and passive revelations remain safe');
}

if (require.main === module) test();
module.exports = test;
