'use strict';
const assert = require('assert/strict');
const { inspectionAt } = require('./personal_inspection.js');
const recording = (availableAt, novelFlipTaps, novelMatchTaps) => ({ availableAt,
  counts: { noClock: { novelFlipTaps, novelMatchTaps } } });
const past = { Dennis: [recording(10, 2, 8)], Gerda: [recording(11, 3, 7)], PUK: [] };
const fitted = inspectionAt(past, 'Dennis', 20);
assert.equal(fitted.own.games, 1);
assert.equal(fitted.prior, 0.3);
assert.equal(fitted.probability, (2 + 12 * 0.3) / 22);
assert.equal(fitted.familyAvailableThrough, 11);
assert.deepEqual(inspectionAt({ ...past, Dennis: [...past.Dennis, recording(20, 100, 0), recording(21, 100, 0)],
  Gerda: [...past.Gerda, recording(20, 100, 0)] }, 'Dennis', 20), fitted);
assert.equal(inspectionAt(past, 'Dennis', 10).probability, 0);
assert.equal(inspectionAt(past, 'PUK', 20).prior, 0.25);
const age = inspectionAt({ Dennis: [recording(10, 10, 0), recording(11, 0, 10)] }, 'Dennis', 20, 1, 0);
assert.equal(age.probability, 1 / 3);
console.log('PASS inspection profile: strict availability, family balance and chronological decay');
