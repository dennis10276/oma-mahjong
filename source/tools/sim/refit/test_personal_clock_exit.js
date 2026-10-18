'use strict';
const assert = require('assert/strict');
const { clockExit, summarize } = require('./personal_clock_exit_audit.js');
const game = { clock: { i: 0, n: 4 } };
const frames = [{ index: 2, kind: 'flip', alive: [1, 1, 1], moves: 0, tray: [], openPeek: 2 },
  { index: 0, kind: 'take', alive: [0, 1, 1], moves: 1, tray: [1, 2, 3], openPeek: 2 },
  { index: 1, kind: 'take', alive: [0, 0, 1], moves: 2, tray: [1, 2, 3, 4], openPeek: -1 }];
const trace = [{ physicalPlan: 2 }, { inspection: 2 }, { physicalPlan: 0 }, { pick: [1] }];
const result = clockExit(game, frames, trace, { why: 'tray' });
assert.equal(result.clockPhaseTaps, 2);
assert.equal(result.plannedClockDecisions, 2);
assert.equal(result.plannedShare, 1);
assert.equal(result.exit.tray, 3);
assert.equal(result.postExitTaps, 1);
assert.equal(result.postExitMoves, 1);
assert.equal(result.trayFailureWithinTwoMoves, true);
assert.deepEqual(result.route, [[2, 'flip'], [0, 'take']]);
assert.equal(clockExit(game, frames.slice(0, 1)).exit, null);
assert.equal(clockExit(game, frames.slice(0, 1)).plannedShare, null);
assert.equal(clockExit(game, frames, null).trayFailureWithinTwoMoves, null);
assert.deepEqual(clockExit({}, frames), { hasClock: false });
assert.equal(clockExit(game, [], trace).plannedShare, null);
const rows = [0, 1, 2, 3].map(run => ({ start: 1, run, win: false, clock: result }));
assert.equal(summarize(rows).identicalClockRoutesAcrossSeeds, 1);
assert.equal(summarize(rows).trayFailuresWithinTwoMoves, 4);
assert.equal(summarize(rows).clockPhaseTaps, 8);
assert.equal(summarize([]).plannedShare, null);
console.log('PASS clock exit distinguishes controller decisions, actual taps and censored human observations');
