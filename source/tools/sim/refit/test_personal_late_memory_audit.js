'use strict';
const assert = require('assert/strict');
const { lateObservedSources } = require('./personal_late_memory_audit.js');
const target = { campaign: 1, board: 'same', t: 50 };
const source = { campaign: 1, board: 'same', t: 10, observedThrough: 40, availableAt: 60 };
assert.deepEqual(lateObservedSources([source], target), [source]);
for (const change of [{ observedThrough: 50 }, { observedThrough: undefined }, { campaign: 2 }, { board: 'other' }, { availableAt: 49 }, { t: 51 }]) {
  assert.deepEqual(lateObservedSources([{ ...source, ...change }], target), []);
}
assert.deepEqual(lateObservedSources([source], { ...target, campaign: undefined }), []);
console.log('PASS late-memory audit distinguishes observed event time from later telemetry availability');
