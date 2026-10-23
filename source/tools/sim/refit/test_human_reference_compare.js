'use strict';
const assert = require('assert/strict');
const { compareTraces } = require('./human_reference_compare.js');

function test() {
  const state = { alive: [1, 1], pictures: [1, null], down: [0, 1], tray: [], moves: 0, physicalTaps: 0 };
  const choice = { state, index: 0, accepted: true, plan: { goal: 'information', path: [0] } };
  const rejected = { ...choice, accepted: false };
  const first = [rejected, choice], second = [rejected, { ...choice, index: 1 }];
  const compared = compareTraces(first, second, { i: 1 });
  assert.equal(compared.commonDecisions, 1); assert.equal(compared.firstDifferentDecision, 2);
  assert(compared.sameProjectionAtDivergence);
  assert.equal(compared.current[0].accepted, false); assert.equal(compared.current[1].picture, 1);
  assert.equal(compared.alternative[1].picture, null); assert.equal(compared.current[1].unknownAlive, 1);
  assert.equal(compareTraces(first, first, null).firstDifferentDecision, null);
  assert.equal(compareTraces([], [choice], null).firstDifferentDecision, 1);
  assert.equal(compareTraces([choice], [{ ...choice, accepted: false }], null).firstDifferentDecision, 1);
  console.log('PASS public trace comparison includes rejected decisions, reports only actual observed fields and distinguishes identical prefixes from divergent actions without writing full traces');
}

if (require.main === module) test();
module.exports = test;
