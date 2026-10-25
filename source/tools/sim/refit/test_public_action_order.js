'use strict';
const assert = require('assert/strict');
const { publicActionOrder } = require('./public_action_order.js');

function test() {
  const actions = Array.from({ length: 20 }, (_, index) => ({ index }));
  const snapshot = structuredClone(actions);
  assert.deepEqual(publicActionOrder(actions, 1), snapshot);
  const second = publicActionOrder(actions, 2), third = publicActionOrder(actions, 3);
  assert.notDeepEqual(second, snapshot);
  assert.notDeepEqual(second, third);
  assert.deepEqual(publicActionOrder(actions, 2), second);
  for (const ordered of [second, third]) assert.deepEqual(ordered.map(action => action.index).sort((left, right) => left - right), actions.map(action => action.index));
  assert.deepEqual(actions, snapshot);
  assert.throws(() => publicActionOrder(actions, 0));
  console.log('PASS public salts deterministically order the same actions without board data, mutation or private randomness; salt1 preserves existing ordering');
}
if (require.main === module) test();
module.exports = test;
