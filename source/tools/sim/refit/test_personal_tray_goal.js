'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { trayGoalSamples } = require('./personal_tray_goal.js');
const tiles = [20, 2, 0, 4, 40, 60, 80, 100].map(coordinate => ({ x: coordinate, y: 0, z: 0 }));
const base = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 2, 1, 2, 3, 3], down: Array(8).fill(0) };
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false };
const replay = changes => {
  const game = { ...base, follow: [0, 2, 4, 1], log: [], physicalLog: [], policyLog: [], logMatches: true, ...changes };
  Hard.play(game, actor, 1);
  return { game, samples: trayGoalSamples(game, game.physicalLog, game.policyLog) };
};
const continued = replay({});
assert.deepEqual(continued.samples.map(sample => [sample.age, sample.followed, sample.completed]),
  [[0, true, false], [1, true, false], [2, true, true]]);
assert.deepEqual(replay({ follow: [0, 6, 7, 2, 4, 1] }).samples.map(sample => sample.followed), [false]);
assert.deepEqual(replay({ clock: { i: 5, n: 20 } }).samples, []);
assert.deepEqual(trayGoalSamples(continued.game, continued.game.physicalLog, continued.game.policyLog, 0), []);
assert.deepEqual(trayGoalSamples(continued.game, continued.game.physicalLog.slice(0, 1), continued.game.policyLog.slice(0, 1)), []);
const covered = tiles.map(tile => ({ ...tile }));
covered[1] = { x: 0, y: 0, z: 0 }; covered[2] = { x: 0, y: 0, z: 1 }; covered[3] = { x: 30, y: 0, z: 0 };
assert.deepEqual(replay({ tiles: covered, nb: L.neighbors(covered) }).samples, []);
assert(replay({ tiles: covered, nb: L.neighbors(covered), memory: [0, 1, 0, 0, 0, 0, 0, 0] }).samples.length > 0);
const state = { alive: [0, 1, 1, 1, 1, 1, 1, 1], tray: [0, 8, 9], openPeek: -1 };
const known = Array(8).fill(1), prepared = { ...base, down: [0, 0, 0, 0, 1, 0, 0, 0] };
const safe = Hard.trayGoalInfo(prepared, state, known, 0);
assert.equal(safe.take.has(2), false);
assert.equal(safe.inspect.has(4), true);
assert.equal(Hard.trayGoalInfo(prepared, { ...state, openPeek: 4 }, known, 0).take.has(2), true);
const hidden = [2, 6], hiddenKnown = known.map((value, index) => hidden.includes(index) ? 0 : value);
const hiddenDown = base.down.map((value, index) => hidden.includes(index) ? 1 : value);
const summaries = [[0, 0, 1, 2, 1, 2, 3, 3], [0, 0, 3, 2, 1, 2, 1, 3]].map(faces => {
  const info = Hard.trayGoalInfo({ ...base, faces, down: hiddenDown }, { ...state, tray: [0] }, hiddenKnown, 0);
  return [info.depth, [...info.take], [...info.inspect], [...info.frontier]];
});
assert.deepEqual(summaries[0], summaries[1]);
assert.deepEqual(replay({ faces: [0, 0, 1, 2, 1, 2, 101, 101] }).samples, []);
console.log('PASS tray-goal observations: persistent ages, dropout, safe preparation, frozen knowledge, censoring and hidden-picture invariance');
