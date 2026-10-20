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

// Behavioral knobs and Personal Bots parameterization tests
const { PERSONAL_PROFILES } = require('./public_witness_search.js');
assert(PERSONAL_PROFILES['Dennisisdebeste'] && PERSONAL_PROFILES['Mrs. Doubtfire'] && PERSONAL_PROFILES['PUK'] && PERSONAL_PROFILES['Gerda']);
for (const [name, prof] of Object.entries(PERSONAL_PROFILES)) {
  assert(Number.isInteger(prof.depth) && prof.depth > 0);
  assert(Number.isInteger(prof.trayBuffer) && prof.trayBuffer >= 0 && prof.trayBuffer <= 3);
  assert(typeof prof.clockPatience === 'number' && prof.clockPatience >= 0 && prof.clockPatience <= 1);
  assert(typeof prof.memoryDecay === 'number' && prof.memoryDecay >= 0 && prof.memoryDecay <= 1);
  assert(typeof prof.retryLearning === 'number' && prof.retryLearning >= 0 && prof.retryLearning <= 1);
}

// depth knob
const depthReport = search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { depth: 4 });
assert.equal(depthReport.depth, 4); assert(depthReport.knownWin);

// trayBuffer knob
const trayBufReport = search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { trayBuffer: 2 });
assert.equal(trayBufReport.trayBuffer, 2);

// clockPatience knob
const patientClock = search(clock.game, clock.state, actionsOf(clock.game, clock.state), { clockPatience: 0.9 });
assert.equal(patientClock.clockPatience, 0.9);
const urgentClock = search(clock.game, clock.state, actionsOf(clock.game, clock.state), { clockPatience: 0.1 });
assert.equal(urgentClock.clockPatience, 0.1);

// memoryDecay and retryLearning knobs
const decayReport = search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { memoryDecay: 0.2, retryLearning: 0.8 });
assert.equal(decayReport.memoryDecay, 0.2);
assert.equal(decayReport.retryLearning, 0.8);

// Validation assertions on out-of-range knobs
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { clockPatience: 1.5 }));
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { memoryDecay: -0.1 }));
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { retryLearning: 2.0 }));
assert.throws(() => search(fixture.game, fixture.state, actionsOf(fixture.game, fixture.state), { trayBuffer: 5 }));

console.log('PASS witness search uses public pictures only, constructs separate physical clock-safe taps, stops at unknown reveals, retains bounds, exposes behavioral knobs, and respects actual root restrictions');

