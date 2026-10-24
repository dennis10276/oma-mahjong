'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
    { x: 8, y: 0, z: 1 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
  const actual = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: { i: 0, n: 6 },
    faces: [9, 7, 9, 8, 7, 8], down: [0, 1, 0, 1, 0, 0] };
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 32 }, session = createSessionFactory()(actual, settings);
  session.tap(4); session.tap(5);
  const state = { ...session.view().state, pictures: [9, null, 9, null, null, null] };
  const game = { tiles, nb: actual.nb, rules: null, clock: actual.clock };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const roots = [0, 1, 3].map(index => ({ index }));
  const options = { ...REFERENCE_PARAMETERS, taps: 6, nodes: 128, beam: 16, pruneDead: false };
  const legacy = search(game, state, roots, options);
  assert.equal(legacy.index, 0);
  assert(!legacy.safeClockExit && !legacy.knownWin);
  const informed = search(game, state, roots, { ...options, clockInformationBeforeRisk: true });
  assert.equal(informed.index, 3);
  assert(informed.information && !informed.knownDead && !informed.knownWin);
  assert(informed.clockPreparationFrontiers > 0);
  const comparable = plan => [plan.index, plan.path, plan.goal, plan.safeClockExit, plan.knownWin, plan.knownDead];
  const urgent = { ...game, clock: { i: 0, n: 4 } };
  assert.deepEqual(comparable(search(urgent, state, roots, options)),
    comparable(search(urgent, state, roots, { ...options, clockInformationBeforeRisk: true })));
  const roomier = { ...state, tray: [7] };
  const safe = search(game, roomier, roots, { ...options, clockInformationBeforeRisk: true });
  assert(safe.safeClockExit);
  assert.deepEqual(comparable(safe), comparable(search(game, roomier, roots, options)));
  const nonclock = { ...game, clock: null };
  assert.deepEqual(comparable(search(nonclock, state, roots, options)),
    comparable(search(nonclock, state, roots, { ...options, clockInformationBeforeRisk: true })));
  for (const index of [3, 0, 2, 1]) session.tap(index);
  assert(session.view().win);
  assert.equal(verifyAttempt(encodeGame(actual), [4, 5, 3, 0, 2, 1], settings, session.audit()), 6);
  assert.throws(() => search(game, state, roots, { ...options, clockInformationBeforeRisk: 'yes' }));
  console.log('PASS optional clock preparation prefers an observed-information frontier over a three-carrier exit, preserves safer exits and urgent/nonclock ordering, and independently replays the resulting production route');
}

if (require.main === module) test();
module.exports = test;
