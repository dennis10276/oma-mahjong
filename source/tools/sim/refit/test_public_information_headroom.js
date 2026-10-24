'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { informationTraySafe } = require('./public_information_tray_safety.js');
const { advance } = require('./known_tray_plan.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 1 },
    { x: 12, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 16, y: 0, z: 0 },
    { x: 24, y: 0, z: 0 }, { x: 28, y: 0, z: 0 }];
  const neighbors = Layouts.neighbors(tiles), game = { tiles, nb: neighbors, rules: null, clock: null };
  for (const field of ['faces', 'down', 'seed', 'deck']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const actual = { tiles, nb: neighbors, faces: [7, 35, 8, 8, 35, 7, 20, 21],
    down: [0, 1, 0, 0, 1, 0, 0, 0], rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const session = factory(actual, settings); session.tap(6); session.tap(7);
  const state = { ...session.view().state, pictures: [7, null, 8, 8, null, 7, null, null] };
  const roots = state.alive.flatMap((alive, index) => alive && Layouts.isFree(index, state.alive, neighbors) ? [{ index }] : []);
  const options = { ...REFERENCE_PARAMETERS, nodes: 512, taps: 8, beam: 32, pruneDead: false,
    trayRecovery: false, knownPairMacros: true, shortInformation: true };
  const ordinary = search(game, state, roots, options);
  const limited = search(game, state, roots, { ...options, informationTrayLimit: 2 });
  const describe = result => {
    let position = state;
    const prefix = [];
    for (const index of result.path) {
      const moved = advance(game, position, index);
      if (moved.uncertain) return { position, prefix, index, reason: moved.reason };
      assert(!moved.lost); position = moved.state; prefix.push(index);
    }
    assert.fail('Expected an information boundary');
  };
  const short = describe(ordinary), spacious = describe(limited);
  assert.equal(short.position.tray.length, 3);
  assert.equal(spacious.position.tray.length, 2);
  assert(limited.path.length > ordinary.path.length);
  assert(ordinary.information && limited.information && !limited.knownDead && !limited.knownWin);
  assert.equal(spacious.reason, 'unseenPicture');
  assert(informationTraySafe(spacious.position, spacious.index, true, { free: [spacious.index] }, 2));
  assert(!informationTraySafe({ ...spacious.position, down: spacious.position.down.map(() => 0) }, spacious.index, true,
    { free: [spacious.index] }, 2), 'An unseen face-up commitment may use the third spot; a closed inspection cannot');
  let controls = 0;
  for (const hidden of [...Array(36).keys(), 101]) {
    const variant = { ...actual, faces: actual.faces.map((picture, index) => [1, 4].includes(index) ? hidden : picture) };
    const replay = factory(variant, settings), actions = [6, 7, ...spacious.prefix, spacious.index];
    for (const index of actions) replay.tap(index);
    assert(replay.view().state.tray.length <= 2);
    assert.equal(verifyAttempt(encodeGame(variant), actions, settings, replay.audit()), actions.length);
    controls++;
  }
  const comparable = result => Object.fromEntries(['index', 'path', 'goal', 'knownWin', 'knownDead', 'information'].map(field => [field, result[field]]));
  const crowded = { ...state, tray: [20, 21, 22] };
  assert.deepEqual(comparable(search(game, crowded, roots, { ...options, informationTrayLimit: 2 })),
    comparable(search(game, crowded, roots, options)), 'An already crowded root keeps ordinary safe probes available');
  const clocked = { ...game, clock: { i: 0, n: 20 } };
  assert.deepEqual(comparable(search(clocked, state, roots, { ...options, informationTrayLimit: 2 })),
    comparable(search(clocked, state, roots, options)));
  const expired = search(game, state, roots, { ...options, informationTrayLimit: 2, deadline: 0 });
  assert(expired.boundary && !expired.knownDead);
  assert.throws(() => search(game, state, roots, { ...options, informationTrayLimit: -1 }));
  assert.throws(() => search(game, state, roots, { ...options, informationTrayLimit: 4 }));
  factory.verifySource();
  console.log('PASS information headroom prefers a longer known prefix ending at two carriers, independently replays all' + controls
    + ' unseen identities, preserves crowded-root probes and clock ranking, and never treats a bounded search as a loss');
}

if (require.main === module) test();
module.exports = test;
