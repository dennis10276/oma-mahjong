'use strict';
const assert = require('assert/strict');
const { firstVisit, withoutDischargedBounds } = require('./human_reference_ablation.js');

function test() {
  const visited = new Map();
  assert(firstVisit(visited, 'same', 4)); assert(!firstVisit(visited, 'same', 3));
  assert.equal(visited.get('same'), 4);
  const input = { free: [0, 2, 4], blocked: [3], uncertain: [1, 5], unresolved: true,
    reasons: [{ index: 0, status: 'free', reason: 'observedMonotoneSafety' },
      { index: 1, status: 'uncertain', reason: 'unobservedCurrentRole' },
      { index: 2, status: 'free', reason: 'AllSupportedObstaclesDischargedUnderPublicBounds' },
      { index: 3, status: 'blocked', reason: 'geometry' },
      { index: 4, status: 'free', reason: 'observedIceThawedUnderExclusiveRoleContract' },
      { index: 5, status: 'uncertain', reason: 'unobservedCurrentRole' }] };
  const snapshot = JSON.stringify(input), result = withoutDischargedBounds(input);
  assert.deepEqual(result.free, [0, 4]); assert.deepEqual(result.uncertain, [1, 2, 5]);
  assert.deepEqual(result.blocked, [3]); assert(result.unresolved);
  assert.deepEqual(result.reasons[2], { index: 2, status: 'uncertain', reason: 'unobservedCurrentRole' });
  assert.equal(JSON.stringify(input), snapshot);
  const unchanged = { ...input, reasons: input.reasons.filter(reason => reason.index !== 2) };
  assert.equal(withoutDischargedBounds(unchanged), unchanged);
  console.log('PASS diagnostic ablations change only first-visit dominance or newly discharged unknown roles, retaining observed thaw/safety, action ordering and immutable public inputs');
}

if (require.main === module) test();
module.exports = test;
