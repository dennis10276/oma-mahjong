'use strict';
const assert = require('assert/strict');
const { summarize } = require('./physical_failure_audit.js');
assert.deepEqual(summarize([]), { runs: 0, endings: {}, meanMoves: null, meanLeft: null, meanInspections: null, meanReopens: null });
assert.deepEqual(summarize([
  { why: 'clock', moves: 10, left: 8, inspections: 4, reopens: 1 },
  { why: 'win', moves: 20, left: 0, inspections: 2, reopens: 0 },
  { why: 'clock', moves: 12, left: 4, inspections: 3, reopens: 2 },
]), { runs: 3, endings: { clock: 2, win: 1 }, meanMoves: 14, meanLeft: 4, meanInspections: 3, meanReopens: 1 });
console.log('PASS physical failure audit: explicit denominators, endings and empty sample');
