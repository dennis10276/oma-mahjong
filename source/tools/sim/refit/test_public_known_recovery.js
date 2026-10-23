'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { knownRecovery } = require('./public_known_recovery.js');
const { advance } = require('./known_tray_plan.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 32, tapMs: 1000 };
  let controls = 0;
  for (let shift = 0; shift < 36; shift++) for (const mode of ['faceUp', 'openTwin', 'ice', 'trayMatch']) {
    const tiles = [0, 2, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
    const first = (1 + shift) % 36, second = (7 + shift) % 36;
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [first, first, second, second],
      down: [mode === 'openTwin' || mode === 'ice' ? 1 : 0, 0, 0, 0], clock: null,
      rules: mode === 'ice' ? { iceNb: Layouts.iceNeighbors(tiles), ice: { 1: 1 }, keys: [], locks: new Set() } : null };
    const game = { tiles, nb: actual.nb, clock: null, rules: actual.rules };
    for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
    const session = factory(actual, settings), prefix = mode === 'faceUp' ? [] : [0];
    for (const index of prefix) session.tap(index);
    const frame = session.view().state;
    const state = { ...frame, pictures: actual.faces.map((picture, index) => frame.alive[index] ? picture : null) };
    const snapshot = structuredClone(state), recovered = knownRecovery(game, state);
    assert(recovered);
    assert.equal(recovered.path.length, mode === 'openTwin' || mode === 'trayMatch' ? 1 : 2);
    assert.equal(recovered.kind, mode === 'openTwin' ? 'openTwin' : mode === 'trayMatch' ? 'trayMatch' : 'knownPair');
    assert(recovered.state.tray.length <= state.tray.length);
    let predicted = state;
    for (const index of recovered.path) {
      const moved = advance(game, predicted, index); assert(!moved.uncertain && !moved.lost);
      const after = session.tap(index);
      for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(after.state[field], moved.state[field]);
      predicted = moved.state;
    }
    assert.equal(verifyAttempt(encodeGame(actual), prefix.concat(recovered.path), settings, session.audit()), prefix.length + recovered.path.length);
    assert.deepEqual(state, snapshot);
    assert.equal(knownRecovery(game, state, 2, Date.now() - 1), null);
    if (mode === 'ice') assert.equal(knownRecovery(game, state, 1), null);
    controls++;
  }
  const tiles = [0, 4].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  const state = { alive: [1, 1], pictures: [1, 1], down: [0, 0], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  assert.equal(knownRecovery(game, { ...state, pictures: [1, null] }), null);
  assert.equal(knownRecovery(game, { ...state, pictures: [101, 101] }), null);
  assert.equal(knownRecovery(game, { ...state, tray: [7, 8, 9] }), null);
  const uncertain = { ...game, publicFrontier(position) {
    return { free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [1] };
  } };
  assert.equal(knownRecovery(uncertain, state), null);
  const extended = { tiles: tiles.concat([{ x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }]), rules: null, clock: { i: 3, n: 1 } };
  extended.nb = Layouts.neighbors(extended.tiles);
  assert.equal(knownRecovery(extended, { ...state, alive: [1, 1, 1, 1], pictures: [1, 1, null, null], down: [0, 0, 1, 1] }), null);
  assert.throws(() => knownRecovery(game, state, 3));
  assert.throws(() => knownRecovery(game, state, 2, NaN));
  factory.verifySource();
  console.log('PASS ' + controls + ' one/two-tap local recovery witnesses replay through production for face-up pairs, open twins, tray matches and observed ice dependencies; hidden values, uncertain roles, unsupported Jokers, crowding, clock loss and expired limits are refused');
}

if (require.main === module) test();
module.exports = test;
