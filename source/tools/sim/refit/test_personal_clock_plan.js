'use strict';
const assert = require('assert/strict');
const { clockPlanAt } = require('./personal_clock_plan.js');
const observed = { name: 'Gerda', t: 10, availableAt: 20, clockFailed: true, probabilities: [0.8, 0.4, 0.2, 0.1, 0.05] };
assert.equal(clockPlanAt([], 'Gerda', 30).horizon, 10);
const fitted = clockPlanAt([observed], 'Gerda', 30);
assert.equal(fitted.horizon, 0);
assert.equal(fitted.ownGames, 1);
assert.equal(fitted.ownAvailableThrough, 20);
assert.deepEqual(clockPlanAt([observed, { ...observed, availableAt: 30, clockFailed: false },
  { ...observed, name: 'PUK', availableAt: 31, clockFailed: false }], 'Gerda', 30), fitted);
assert.equal(clockPlanAt([observed], 'Gerda', 20).horizon, 10);
const family = clockPlanAt([{ ...observed, name: 'PUK' }], 'Gerda', 30);
assert.equal(family.horizon, 0);
assert.equal(family.ownGames, 0);
assert.equal(family.familyAvailableThrough, 20);
assert.equal(clockPlanAt([{ ...observed, probabilities: [0.2, 0.2, 0.2, 0.2, 0.2] }], 'Gerda', 30).horizon, 10);
console.log('PASS personal clock onset: default ties, completed availability and earlier family observations');
