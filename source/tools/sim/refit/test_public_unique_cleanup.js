'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { knownCleanup } = require('./public_unique_cleanup.js');
const { legal, advance } = require('./known_tray_plan.js');
const { analyzeRecovery } = require('./public_recovery_graph.js');
const { createSession } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const arrangements = new Map();
  const permute = (prefix, rest) => {
    if (!rest.length) { arrangements.set(prefix.join(','), prefix); return; }
    for (const [offset, picture] of rest.entries()) permute(prefix.concat(picture), rest.filter((value, index) => index !== offset));
  };
  permute([], [0, 0, 1, 1, 2, 2]);
  const shapes = [Array.from({ length: 6 }, (value, index) => ({ x: index * 4, y: 0, z: 0 })),
    Array.from({ length: 6 }, (value, index) => ({ x: Math.floor(index / 2) * 8, y: 0, z: index % 2 }))];
  let controls = 0;
  for (const tiles of shapes) for (const pictures of arrangements.values()) for (const orientation of [0, 21, 63]) for (const removed of [[], [0], [0, 2], [0, 2, 4]]) {
    const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
    const tray = [];
    for (const index of removed) {
      const waiting = tray.indexOf(pictures[index]);
      if (waiting >= 0) tray.splice(waiting, 1); else tray.push(pictures[index]);
    }
    const state = { pictures, down: pictures.map((picture, index) => (orientation >> index) & 1),
      alive: pictures.map((picture, index) => +!removed.includes(index)), tray,
      moves: removed.length, openPeek: -1, relieved: false, arriving: [] };
    const initial = JSON.stringify(state), actions = legal(game, state).free.map(index => ({ index }));
    const cleanup = knownCleanup(game, state, actions);
    if (!cleanup) continue;
    const before = analyzeRecovery(game, state, { nodes: 10000 });
    const after = analyzeRecovery(game, cleanup.state, { nodes: 10000 });
    assert(before.complete && after.complete);
    assert.equal(after.knownWinningRoute, before.knownWinningRoute, 'Commuting an observed unique pair must preserve the existence of a winning continuation');
    let position = state;
    for (const index of cleanup.path) {
      const moved = advance(game, position, index);
      assert(!moved.uncertain && !moved.lost); position = moved.state;
    }
    assert.deepEqual(position, cleanup.state); assert.equal(JSON.stringify(state), initial);
    controls++;
  }
  const tiles = shapes[0], game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  const state = { alive: [1, 1, 1, 1, 1, 1], pictures: [1, 1, 2, 2, 3, 3], down: [0, 0, 0, 0, 0, 0],
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = legal(game, state).free.map(index => ({ index }));
  assert.equal(knownCleanup(game, { ...state, pictures: [1, 1, 2, 2, 3, null] }, actions), null);
  assert.equal(knownCleanup(game, { ...state, pictures: [1, 1, 2, 2, 3, 101] }, actions), null);
  assert.equal(knownCleanup(game, { ...state, tray: [101] }, actions), null);
  assert.equal(knownCleanup({ ...game, clock: { i: 0, n: 20 } }, state, actions), null);
  assert.equal(knownCleanup(game, { ...state, pictures: [1, 1, 1, 2, 2, 2] }, actions), null);
  assert.equal(knownCleanup(game, { ...state, tray: [7, 8, 9] }, actions), null);
  const crowded = { ...state, tray: [7, 8, 9], down: [1, 0, 0, 0, 0, 0] };
  assert.deepEqual(knownCleanup(game, crowded, actions).path, [0, 1]);
  assert.equal(knownCleanup({ ...game, publicFrontier: () => ({ free: [0, 1], uncertain: [1] }) }, state, actions), null);
  assert.equal(knownCleanup(game, state, [{ index: 4 }]).path[0], 4);
  const partial = { ...state, alive: [0, 1, 1, 1, 1, 1], pictures: [null, 1, 2, 2, 3, 3], tray: [1] };
  assert.deepEqual(knownCleanup(game, partial, actions).path, [1]);
  const actualGame = { ...game, faces: state.pictures, down: crowded.down,
    rules: { iceNb: [[2], [2], [0, 1], [], [], []], ice: { 2: 2 }, keys: [0, 1], locks: new Set([3]) } };
  const settings = { seed: 1, choiceLimit: 64, tapMs: 1000 }, session = createSession(actualGame, settings);
  const observed = { ...crowded, tray: [] }, observedGame = { ...game, rules: actualGame.rules };
  const cleanup = knownCleanup(observedGame, observed, actions);
  assert.deepEqual(cleanup.path, [0, 1]);
  for (const index of cleanup.path) session.tap(index);
  assert(session.view().legalTiles.includes(2) && session.view().legalTiles.includes(3));
  assert.equal(verifyAttempt(encodeGame(actualGame), cleanup.path, settings, session.audit()), cleanup.path.length);
  console.log('PASS ' + controls + ' exhaustive known cleanup controls preserve winning continuations; closed twins, tray matches, public uncertainty, duplicate classes, clocks and Jokers remain guarded, with original-production key/ice/lock replay');
}

if (require.main === module) test();
module.exports = test;
