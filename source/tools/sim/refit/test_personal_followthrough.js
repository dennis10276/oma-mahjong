'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { followThroughSamples } = require('./personal_followthrough.js');
const actor = { ...Hard.P, physicalFlips: true, peek: 0, end: 0, plan: 0, allMoves: true, flips: true, forceMatches: false };
const boardOf = (faces, changes = {}) => {
  const tiles = faces.map((face, index) => ({ x: index * 4, y: 0, z: 0 }));
  return { tiles, nb: L.neighbors(tiles), faces, down: faces.map(() => 0), physicalLog: [], ...changes };
};
const recorded = boardOf([0, 1, 0, 1], { follow: [0, 1, 2, 3], log: [], policyLog: [], logMatches: true });
Hard.play(recorded, actor, 1);
assert.deepEqual(followThroughSamples(recorded, recorded.physicalLog, recorded.policyLog),
  [{ tray: 1, followed: false }, { tray: 2, followed: true }, { tray: 1, followed: true }]);
const clock = boardOf([0, 1, 0, 1], { clock: { i: 2, n: 4 }, follow: [0, 1, 2, 3], log: [], policyLog: [], logMatches: true });
Hard.play(clock, actor, 1);
assert.deepEqual(followThroughSamples(clock, clock.physicalLog, clock.policyLog), [{ tray: 1, followed: true }]);
const blind = boardOf([0, 0, 1, 1], { down: [0, 1, 0, 0], follow: [0, 1], log: [], policyLog: [], logMatches: true });
Hard.play(blind, actor, 1);
assert.deepEqual(followThroughSamples(blind, blind.physicalLog, blind.policyLog), []);
assert.deepEqual(followThroughSamples(recorded, recorded.physicalLog.slice(0, 1), recorded.policyLog.slice(0, 1)), []);
const follow = boardOf([0, 0, 1, 1], { start: [0] }), trace = [];
Hard.play(follow, { ...actor, physicalFollowThrough: 1 }, 1, trace);
assert.equal(follow.physicalLog[1].index, 1);
assert(trace.some(item => item.physicalFollowThrough && item.following));
const decline = boardOf([0, 0, 1, 1], { start: [0] });
Hard.play(decline, { ...actor, physicalFollowThrough: [0, 0, 0, 0] }, 1);
assert.notEqual(decline.physicalLog[1].index, 1);
const forced = boardOf([0, 0], { start: [0] });
assert.equal(Hard.play(forced, { ...actor, physicalFollowThrough: [0, 0, 0, 0] }, 1).win, true);
const noGlobalGreed = boardOf([0, 0, 1, 1]);
const independent = structuredClone(noGlobalGreed);
Hard.play(noGlobalGreed, { ...actor, physicalFollowThrough: 1 }, 2);
Hard.play(independent, actor, 2);
assert.deepEqual(noGlobalGreed.physicalLog[0], independent.physicalLog[0]);
const urgent = boardOf([0, 0, 1, 1, 2, 2], { start: [0], clock: { i: 5, n: 2 } });
Hard.play(urgent, { ...actor, physicalPlan: 8, physicalFollowThrough: 1 }, 1);
assert.equal(urgent.physicalLog[1].index, 5);
const hidden = [[0, 1, 2, 0, 1, 2], [0, 2, 1, 0, 1, 2]].map(faces => {
  const game = boardOf(faces, { start: [0], down: [0, 1, 1, 0, 0, 0] });
  Hard.play(game, { ...actor, physicalFollowThrough: 1 }, 2);
  return game.physicalLog[1];
});
assert.deepEqual(hidden[0], hidden[1]);
const followed = boardOf([0, 0, 1, 1], { follow: [0, 2, 1, 3], log: [], policyLog: [], logMatches: true });
const plain = structuredClone(followed);
assert.deepEqual(Hard.play(followed, { ...actor, physicalFollowThrough: 1 }, 1), Hard.play(plain, actor, 1));
assert.deepEqual(followed.policyLog, plain.policyLog);
assert.deepEqual(Hard.play(boardOf([0, 0, 1, 1]), { ...actor, physicalFollowThrough: 0 }, 3),
  Hard.play(boardOf([0, 0, 1, 1]), actor, 3));
for (let seed = 1; seed <= 100; seed++) {
  const game = boardOf([0, 0, 1, 1], { start: [0] });
  Hard.play(game, { ...actor, physicalFollowThrough: 0.7 }, seed);
  assert.equal(game.physicalLog[1].index === 1, L.rng(seed)() < 0.7);
}
const coveredTiles = [{ x: 0, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
const uncovered = boardOf([0, 1, 0, 1], { tiles: coveredTiles, nb: L.neighbors(coveredTiles), follow: [0, 2, 1, 3],
  log: [], policyLog: [], logMatches: true });
Hard.play(uncovered, actor, 1);
assert.deepEqual(followThroughSamples(uncovered, uncovered.physicalLog.slice(0, 2), uncovered.policyLog.slice(0, 2)), []);
console.log('PASS personal follow-through: empirical cues, per-context matching/nonmatching choices, no global greed and honest physical transitions');
