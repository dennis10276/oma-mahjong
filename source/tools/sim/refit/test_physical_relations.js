'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false };
const prepIndex = Hard.POLICY_FEAT.indexOf('knownPairPrep');
const shareIndex = Hard.KIND_CONTEXT.indexOf('knownPairPrepShare');
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 16, y: 0, z: 1 }];
const replay = (faces, changes = {}, policy = actor) => {
  const board = { tiles, nb: L.neighbors(tiles), faces, down: [1, 1, 0, 0], memory: [1, 1, 1, 1],
    follow: [-1], log: [], policyLog: [], physicalLog: [], logMatches: true, ...changes };
  Hard.play(board, policy, 1);
  const decision = board.policyLog[0];
  return { board, decision, feature: decision ? decision.F[decision.k] : null };
};
const free = replay([0, 0, 1, 1]), blocked = replay([0, 1, 0, 1]);
assert.deepEqual(free.feature.slice(0, prepIndex), blocked.feature.slice(0, prepIndex));
assert.deepEqual(free.decision.kindContext.slice(0, shareIndex), blocked.decision.kindContext.slice(0, shareIndex));
assert.equal(free.feature[prepIndex], 1);
assert.equal(blocked.feature[prepIndex], 0);
assert.equal(free.decision.kindContext[shareIndex], 1);
assert.equal(blocked.decision.kindContext[shareIndex], 0.5);
assert.equal(free.board.physicalLog[0].kind, 'flip');
assert.equal(free.board.physicalLog[0].moves, 0);
assert.deepEqual(free.board.physicalLog[0].alive, [1, 1, 1, 1]);
const unknownState = { memory: [1, 0, 0, 1], down: [1, 1, 1, 0] };
const unknown = replay([0, 0, 2, 1], unknownState);
assert.equal(unknown.feature[prepIndex], 0);
assert.deepEqual(unknown.decision.F, replay([0, 2, 0, 1], unknownState).decision.F);
assert.deepEqual(unknown.decision.kindContext, replay([0, 2, 0, 1], unknownState).decision.kindContext);
const locked = replay([0, 0, 1, 1], { rules: { keys: [3], locks: new Set([1]), ice: {}, iceNb: [] } });
assert.equal(locked.feature[prepIndex], 0);
const iced = replay([0, 0, 1, 1], { rules: { ice: { 1: 1 }, iceNb: [[], [3], [], []], keys: [], locks: new Set() } });
assert.equal(iced.feature[prepIndex], 0);
const twin = replay([0, 0, 1, 1], { follow: [-1, 1] });
assert.equal(twin.board.physicalLog[1].kind, 'take');
assert.deepEqual(twin.board.physicalLog[1].alive, [0, 0, 1, 1]);
for (let seed = 1; seed <= 20; seed++) {
  const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1], down: [1, 1, 0, 0], memory: [1, 1, 1, 1] };
  assert.deepEqual(Hard.play(board, actor, seed), Hard.play(board,
    { ...actor, spatial: Array(Hard.POLICY_FEAT.length - Hard.FEAT.length).fill(0) }, seed));
}
for (const preference of [-1000, 1000]) {
  const spatial = Array(Hard.POLICY_FEAT.length - Hard.FEAT.length).fill(0);
  spatial[prepIndex - Hard.FEAT.length] = preference;
  const selected = replay([0, 1, 0, 1], { follow: undefined }, { ...actor, spatial, kinds: { t0n: { flip: 1 } } });
  assert.equal(selected.board.physicalLog[0].index, preference > 0 ? 1 : 0);
}
console.log('PASS relational features: known free twins, frozen hidden pictures, locks/ice, actual separate taps and default compatibility');
