'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false };
const make = (faces, changes = {}) => {
  const tiles = faces.map((face, index) => ({ x: index * 8, y: 0, z: 0 }));
  return { tiles, nb: L.neighbors(tiles), faces, down: faces.map(() => 0), log: [], policyLog: [], physicalLog: [], logMatches: true, ...changes };
};
const recorded = make([0, 1, 0, 1], { start: [0], follow: [1], clock: { i: 2, n: 5 }, valueLog: true });
const single = structuredClone(recorded), plain = structuredClone(recorded);
delete plain.valueLog;
assert.deepEqual(Hard.play(recorded, actor, 1), Hard.play(plain, actor, 1));
assert.deepEqual(recorded.physicalLog, plain.physicalLog);
Hard.play(single, { ...actor, physicalSingleStep: true }, 1);
for (const [index, decision] of recorded.policyLog.entries()) {
  assert.deepEqual(decision.immediate, single.policyLog[index].F.map((feature, position) => feature.slice(0, Hard.FEAT.length).concat(single.policyLog[index].goals[position])));
  const { immediate, ...withoutValue } = decision;
  assert.deepEqual(withoutValue, plain.policyLog[index]);
}
const chosen = recorded.policyLog[0];
assert.equal(chosen.immediate[chosen.k][1], 1);
assert.equal(chosen.immediate[chosen.k][Hard.FEAT.length + Hard.GOAL_FEAT.indexOf('clockTaken')], 0);
const captured = [[0, 1, 2, 0, 1, 2], [0, 2, 1, 0, 1, 2]].map(faces => {
  const game = make(faces, { down: [0, 1, 1, 0, 0, 0], valueLog: true, captureValue: true });
  const result = Hard.play(game, { ...actor, kindModel: { weights: {} } }, 1);
  assert.equal(result.why, 'valueCapture');
  assert.equal(result.moves, 0);
  assert.equal(game.physicalLog.length, 0);
  assert(game.capturedValue.F.every(feature => feature.length === Hard.POLICY_FEAT.length + Hard.GOAL_FEAT.length));
  assert(game.capturedValue.immediate.every(feature => feature.length === Hard.FEAT.length + Hard.GOAL_FEAT.length));
  return game.capturedValue;
});
assert.deepEqual(captured[0], captured[1]);
assert.throws(() => Hard.play(make([0, 0], { captureValue: true }), { ...actor, physicalPlan: 8 }, 1));
console.log('PASS value features: actual-tap consequences, unchanged controls, hidden-picture invariance and pre-action opening capture');
