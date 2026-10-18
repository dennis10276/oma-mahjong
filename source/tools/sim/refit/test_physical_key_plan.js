'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0,
  forceMatches: false, physicalPlan: 8, physicalKeyPlan: 8, physicalKeyPlanNodes: 300 };
const boardOf = (faces, changes = {}) => {
  const tiles = faces.map((face, index) => ({ x: index * 4, y: 0, z: 0 }));
  return { tiles, nb: L.neighbors(tiles), faces, down: faces.map(() => 0), physicalLog: [],
    rules: { ice: {}, iceNb: [], keys: [0, 1], locks: new Set([2, 3]) }, ...changes };
};
const known = boardOf([0, 0, 1, 1]);
const trace = [], result = Hard.play(known, actor, 1, trace);
assert.equal(result.win, true);
assert.deepEqual(trace.filter(item => item.physicalKeyPlan !== undefined).map(item => item.physicalKeyPlan), [0, 1]);
assert.deepEqual(known.physicalLog.slice(0, 2).map(frame => [frame.index, frame.moves]), [[0, 1], [1, 2]]);
const hidden = boardOf([0, 0, 1, 1], { down: [1, 1, 0, 0] });
const hiddenTrace = [];
assert.equal(Hard.play(hidden, actor, 1, hiddenTrace).win, true);
assert.deepEqual(hiddenTrace.filter(item => item.physicalKeyPlan !== undefined).map(item => [item.physicalKeyPlan, item.inspect, item.known]),
  [[0, true, false], [0, false, true], [1, true, false]]);
assert.deepEqual(hidden.physicalLog.slice(0, 3).map(frame => [frame.kind, frame.moves]), [['flip', 0], ['take', 1], ['take', 2]]);
const clock = boardOf([0, 0, 1, 1, 2, 2], { clock: { i: 5, n: 1 },
  rules: { ice: {}, iceNb: [], keys: [0, 1], locks: new Set([2, 3]) } });
const clockTrace = [];
Hard.play(clock, actor, 1, clockTrace);
assert.equal(clockTrace[0].physicalPlan, 5);
assert.equal(clock.physicalLog[0].index, 5);
const hiddenChoices = [[0, 1, 0, 1], [1, 0, 0, 1]].map(faces => {
  const game = boardOf(faces, { down: [1, 1, 0, 0] }), choices = [];
  Hard.play(game, actor, 2, choices);
  return choices.find(item => item.physicalKeyPlan !== undefined);
});
assert.deepEqual(hiddenChoices[0], hiddenChoices[1]);
const blockedTiles = [[2, 0], [0, 0], [4, 0], [20, 0], [22, 0], [40, 0], [42, 0], [60, 0]]
  .map(([x, y]) => ({ x, y, z: 0 }));
const blocked = boardOf([0, 1, 2, 1, 0, 3, 3, 2], { tiles: blockedTiles, nb: L.neighbors(blockedTiles),
  rules: { ice: {}, iceNb: [], keys: [0, 4], locks: new Set([5, 6]) } });
const blockedResult = Hard.play(blocked, actor, 1);
assert(blockedResult.at[0] > 0);
assert(blockedResult.at[1] < blockedResult.at[0] || blockedResult.at[2] < blockedResult.at[0]);
assert(blocked.physicalLog.some(frame => !frame.alive[0] && !frame.alive[4]));
const joker = boardOf([0, 0, 101, 101]);
assert.deepEqual(Hard.play(joker, actor, 1), Hard.play(structuredClone(joker), { ...actor, physicalKeyPlan: 0 }, 1));
const { designed } = require('./boards.js');
for (const level of [100, 101, 105]) {
  const knownBoard = designed('1.55', level), stats = new Proxy({}, {
    set(target, field, value) {
      if (field === 'physicalKeyPlans') assert(value < 200, 'A committed known key route cannot alternate reopenings indefinitely');
      target[field] = value;
      return true;
    },
  });
  Hard.play({ ...knownBoard, memory: Array(knownBoard.faces.length).fill(1) }, { ...actor, stats }, 1);
}
const followed = boardOf([0, 0, 1, 1], { down: [1, 1, 0, 0], follow: [-1, -2], log: [], policyLog: [], logMatches: true });
const plain = structuredClone(followed);
assert.deepEqual(Hard.play(followed, actor, 1), Hard.play(plain, { ...actor, physicalKeyPlan: 0 }, 1));
assert.deepEqual(followed.policyLog, plain.policyLog);
const ordinary = boardOf([0, 0, 1, 1]);
assert.deepEqual(Hard.play(ordinary, { ...actor, physicalKeyPlan: 0 }, 2), Hard.play(ordinary, { ...actor, physicalKeyPlan: undefined }, 2));
console.log('PASS physical key planning: separate legal taps, unseen-key inspection, urgent clock priority and hidden-picture invariance');
