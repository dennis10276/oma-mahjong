'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { knownHypothesisPrefix } = require('./public_known_hypothesis_prefix.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 4, 4],
    down: [1, 0, 1, 0, 0, 0, 0, 0], rules: null, clock: null };
  const geometry = { tiles, nb: actual.nb, rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(geometry, field,
    { get() { throw Error('Known prefix accessed private ' + field); } });
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const session = factory(actual, settings), state = { ...session.view().state, pictures: [1, 1, null, 2, 3, 3, 4, 4] };
  const before = JSON.stringify(state), proposed = [0, 1, 2, 3, 4, 5, 6, 7];
  const prefix = knownHypothesisPrefix(geometry, state, proposed, { deadline: Date.now() + 1000 });
  assert.deepEqual(prefix.path, [0, 1]); assert.equal(prefix.stopReason, 'uncertain');
  assert.equal(prefix.boundaryIndex, 2); assert.equal(prefix.knownProgress, 2); assert.equal(prefix.knownWin, false);
  assert.equal(prefix.sampledContinuationIsKnown, false); assert.equal(prefix.observedFact, false);
  assert.equal(JSON.stringify(state), before); assert.deepEqual(proposed, [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const index of prefix.path) session.tap(index);
  assert.deepEqual(session.view().state.tray, []);
  assert.equal(verifyAttempt(encodeGame(actual), prefix.path, settings, session.audit()), 2);
  const full = knownHypothesisPrefix(geometry, { ...state, pictures: actual.faces.slice() }, proposed,
    { deadline: Date.now() + 1000 });
  assert.equal(full.knownWin, true); assert.equal(full.stopReason, 'win');
  const clear = factory(actual, settings);
  for (const index of full.path) clear.tap(index);
  assert(clear.view().win); assert.equal(verifyAttempt(encodeGame(actual), full.path, settings, clear.audit()), full.path.length);
  const blocked = knownHypothesisPrefix({ ...geometry, publicFrontier: () => ({ free: [0], uncertain: [0] }) },
    state, proposed, { deadline: Date.now() + 1000 });
  assert.deepEqual(blocked.path, []); assert.equal(blocked.stopReason, 'uncertain');
  const twinRole = knownHypothesisPrefix({ ...geometry, publicFrontier: () => ({ free: [0, 1], uncertain: [0] }) },
    { ...state, openPeek: 0 }, [1], { deadline: Date.now() + 1000 });
  assert.deepEqual(twinRole.path, []); assert.equal(twinRole.stopReason, 'uncertain');
  const orientation = knownHypothesisPrefix(geometry, { ...state, down: [null, ...state.down.slice(1)] },
    [0], { deadline: Date.now() + 1000 });
  assert.deepEqual(orientation.path, []); assert.equal(orientation.stopReason, 'uncertain');
  const losing = knownHypothesisPrefix(geometry, { ...state, down: tiles.map(() => 0), tray: [5, 6, 7] }, [0],
    { deadline: Date.now() + 1000 });
  assert.deepEqual(losing.path, []); assert.equal(losing.stopReason, 'lost');
  const clocked = knownHypothesisPrefix({ ...geometry, clock: { i: 7, n: 1 } },
    { ...state, down: tiles.map(() => 0) }, [0], { deadline: Date.now() + 1000 });
  assert.deepEqual(clocked.path, []); assert.equal(clocked.stopReason, 'lost');
  const repeated = knownHypothesisPrefix(geometry, { ...state, down: tiles.map(() => 1), pictures: actual.faces.slice() },
    [0, 2, 0], { deadline: Date.now() + 1000 });
  assert.deepEqual(repeated.path, [0, 2]); assert.equal(repeated.stopReason, 'cycle');
  const expired = knownHypothesisPrefix(geometry, state, proposed, { deadline: 0 });
  assert.deepEqual(expired.path, []); assert.equal(expired.stopReason, 'deadline');
  let time = 0;
  const late = knownHypothesisPrefix({ ...geometry, publicFrontier: () => { time = 20; return { free: [0], relieved: false }; } },
    state, [0], { deadline: 10, now: () => time });
  assert.deepEqual(late.path, []); assert.equal(late.stopReason, 'deadline');
  const stack = [{ x: 0.28, y: 0.28 / 1.24, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
  const opening = { alive: [1, 1, 1, 1], pictures: [1, null, 1, 2], down: [0, 0, 0, 0],
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [], roles: ['none', null, 'none', 'none'] };
  const exposed = knownHypothesisPrefix({ tiles: stack, nb: Layouts.neighbors(stack), rules: null, clock: null,
    publicExposure: createExposureFrontier(stack, opening) }, opening, [0, 2], { deadline: Date.now() + 1000 });
  assert.deepEqual(exposed.path, [0]); assert.equal(exposed.stopReason, 'information');
  const illegal = knownHypothesisPrefix({ tiles: stack, nb: Layouts.neighbors(stack), rules: null, clock: null },
    opening, [1], { deadline: Date.now() + 1000 });
  assert.deepEqual(illegal.path, []); assert.equal(illegal.stopReason, 'illegal');
  assert.throws(() => knownHypothesisPrefix({ ...geometry, faces: actual.faces }, state, proposed, { deadline: 1 }));
  factory.verifySource();
  console.log('PASS only real-memory known non-losing taps survive a sampled route prefix; unknown pictures/roles, new exposure, cycles, physical tray/clock losses and deadlines stop retention; partial and complete paths independently replay in production');
}

if (require.main === module) test();
module.exports = test;
