'use strict';
const assert = require('assert/strict'), Layouts = require('../../../www/layouts.js');
const { search, recoveryOf } = require('./public_witness_search.js');
const { legal, advance } = require('./known_tray_plan.js');
const make = (pictures, down = pictures.map(() => 0), changes = {}) => {
  const tiles = pictures.map((picture, index) => ({ x: index * 8, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null, ...changes };
  Object.defineProperty(game, 'faces', { get() { throw new Error('Private picture access'); } });
  const state = { pictures, down, alive: pictures.map(() => 1), tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  return { game, state };
};
const actionsOf = (game, state) => legal(game, state).free.map(index => ({ index, inspect: state.down[index] && state.openPeek !== index }));
const fixture = make([1, 1, 2, 2]);
const report = search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state));
assert(report.knownWin);
let position = fixture.state;
for (const index of report.path) { const moved = advance(fixture.game, position, index); assert(!moved.uncertain && !moved.lost); position = moved.state; }
assert(!position.alive.some(Boolean) && !position.tray.length);
const clock = make([1, 1], [0, 0], { clock: { i: 1, n: 1 } });
const clockPlan = search(clock.game, clock.state, actionsOf(clock.game, clock.state));
assert(clockPlan.knownWin); assert.equal(clockPlan.path[0], 1);
const unknown = make([1, 1, null, null], [0, 0, 1, 1]);
const information = search(unknown.game, unknown.state, actionsOf(unknown.game, unknown.state));
assert(!information.knownWin); assert(information.information); assert(information.unknownTransitions > 0);
const probing = make([1, 2, null, null], [0, 0, 1, 1]);
const selective = search(probing.game, probing.state, actionsOf(probing.game, probing.state), { pairProgress: true });
assert(selective.information && selective.path.length === 1 && selective.index >= 2);
assert.equal(selective.matchedTiles, 0);
const knownEnd = make([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
const finished = search(knownEnd.game, knownEnd.state, actionsOf(knownEnd.game, knownEnd.state),
  { taps: 4, progress: 2, nodes: 4096, beam: 32, finishKnown: true, trayRecovery: true });
assert(finished.knownWin && finished.finishKnown && finished.path.length === 10 && finished.tapLimit === 10);
const notKnownEnd = search(unknown.game, unknown.state, actionsOf(unknown.game, unknown.state),
  { taps: 4, finishKnown: true });
assert(!notKnownEnd.finishKnown && notKnownEnd.tapLimit === 4);
assert.deepEqual(recoveryOf(knownEnd.game, { ...knownEnd.state, tray: [1, 6] }), { immediate: 1, stranded: 1 });
for (const trayRecoveryMin of [0, 2, 3]) {
  const threshold = search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { trayRecovery: true, trayRecoveryMin });
  assert(threshold.knownWin);
}
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { trayRecoveryMin: 4 }));
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { trayRecoveryClockMin: -1 }));
const hybridClock = search(clock.game, clock.state, actionsOf(clock.game, clock.state),
  { trayRecovery: true, trayRecoveryMin: 2, trayRecoveryClockMin: 0 });
assert(hybridClock.knownWin && hybridClock.path[0] === 1);
const limited = search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { nodes: 1, beam: 1, taps: 1 });
assert(limited.boundary && !limited.knownWin);
assert(!limited.knownDead);
const dead = make([1, 2], [1, 1]); dead.state.tray = [4, 5, 6];
const recognised = search(dead.game, dead.state, actionsOf(dead.game, dead.state));
assert(recognised.knownDead); assert.equal(recognised.goal, 'knownDeadEnd');
const unresolved = search(dead.game, { ...dead.state, pictures: [null, 2] }, actionsOf(dead.game, dead.state));
assert(!unresolved.knownDead && unresolved.unknownTransitions > 0);
const deadBounded = search(dead.game, dead.state, actionsOf(dead.game, dead.state), { nodes: 1 });
assert(!deadBounded.knownDead);
const futureDead = { ...dead.state, tray: [4, 5], openPeek: 0 };
const composed = search(dead.game, futureDead, actionsOf(dead.game, futureDead));
assert(composed.knownDead && composed.deadCertificate.safeRemovalsExplored);
assert(advance(dead.game, futureDead, composed.index).removed > 0);
const restricted = search(fixture.game, fixture.state, [{ index: 2, inspect: false }]);
assert.equal(restricted.path[0], 2);
const frozen = JSON.stringify(fixture.state); search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state)); assert.equal(JSON.stringify(fixture.state), frozen);
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { nodes: 0 }));

// Behavioral knobs: invalid parameter rejection and causal parameter ablation tests
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { hallucinatedOption: true }));
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { depth: 0 }));
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { trayBuffer: 5 }));
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { clockPatience: 1.5 }));
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { memoryDecay: -0.1 }));

// 1. Depth causal change
const shallow = search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { depth: 2, finishKnown: false });
const deep = search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { depth: 4, finishKnown: false });
assert(!shallow.knownWin, 'shallow depth must not find multi-step win');
assert(deep.knownWin, 'deep depth must find multi-step win');

// 2. TrayBuffer causal change
const tGame = {
  tiles: [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 2 }, { x: 16, y: 0, z: 0 }],
  nb: { above: [[], [], []], left: [[], [], []], right: [[], []] },
  rules: null, clock: null
};
const tState = {
  pictures: [3, 4, 3],
  down: [0, 0, 0],
  alive: [1, 1, 1],
  tray: [1],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
const resBuff2 = search(tGame, tState, [{ index: 0, inspect: false }, { index: 1, inspect: false }], { trayBuffer: 2, depth: 1 });
const resBuff1 = search(tGame, tState, [{ index: 0, inspect: false }, { index: 1, inspect: false }], { trayBuffer: 1, depth: 1 });
assert.equal(resBuff2.path[0], 0, 'trayBuffer 2 forces pair recovery to prevent stranded single');
assert.equal(resBuff1.path[0], 1, 'trayBuffer 1 tolerates tray growth and follows higher z tiebreaker');

// 3. ClockPatience causal change
const cGame = {
  tiles: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 8, y: 0, z: 5 }],
  nb: {
    above: [[1], [], []],
    left: [[], [], []],
    right: [[], []]
  },
  rules: null,
  clock: { i: 0, n: 5 }
};
const cState = {
  pictures: [1, 2, 3],
  down: [0, 0, 0],
  alive: [1, 1, 1],
  tray: [],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
const resPatient = search(cGame, cState, [{ index: 1, inspect: false }, { index: 2, inspect: false }], { clockPatience: 0.8, depth: 1 });
const resImpatient = search(cGame, cState, [{ index: 1, inspect: false }, { index: 2, inspect: false }], { clockPatience: 0.2, depth: 1 });
assert.equal(resPatient.path[0], 1, 'high clock patience picks in-cone blocker tile 1');
assert.equal(resImpatient.path[0], 2, 'low clock patience picks open board tile 2');

// 4. MemoryDecay causal change
const mGame = {
  tiles: [{ x: 0, y: 0, z: 5 }, { x: 8, y: 0, z: 0 }],
  nb: { above: [[], []], left: [[], []], right: [[], []] },
  rules: null, clock: null
};
const mState = {
  pictures: [1, 1],
  down: [1, 0],
  alive: [1, 1],
  tray: [1],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
const resRetain = search(mGame, mState, [{ index: 0, inspect: false }, { index: 1, inspect: false }], { memoryDecay: 0.0, rng: () => 0.5 });
const resDecay = search(mGame, mState, [{ index: 0, inspect: false }, { index: 1, inspect: false }], { memoryDecay: 1.0, rng: () => 0.5 });
assert.equal(resRetain.path[0], 0, 'remembered picture matches tray and wins z-tiebreaker');
assert.equal(resDecay.path[0], 1, 'forgotten picture loses to known face-up tray match');

// 5. RetryLearning causal change
const rGame = {
  tiles: [{ x: 0, y: 0, z: 5 }, { x: 8, y: 0, z: 0 }],
  nb: { above: [[], []], left: [[], []], right: [[], []] },
  rules: null, clock: null
};
const rState = {
  pictures: [null, 1],
  down: [1, 0],
  alive: [1, 1],
  tray: [1],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
const resLearn = search(rGame, rState, [{ index: 0, inspect: false }, { index: 1, inspect: false }], { retryLearning: 1.0, previousAttemptObserved: [1, null], rng: () => 0.5 });
const resNoLearn = search(rGame, rState, [{ index: 0, inspect: false }, { index: 1, inspect: false }], { retryLearning: 0.0, previousAttemptObserved: [1, null], rng: () => 0.5 });
assert.equal(resLearn.path[0], 0, 'learned picture matches tray and wins z-tiebreaker');
assert.equal(resNoLearn.path[0], 1, 'unlearned picture loses to known face-up tray match');

console.log('PASS witness search uses public pictures only, constructs separate physical clock-safe taps, stops at unknown reveals, retains bounds and respects actual root restrictions');
