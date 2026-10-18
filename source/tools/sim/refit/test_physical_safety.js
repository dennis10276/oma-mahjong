'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0,
  forceMatches: false, physicalSafety: 1 };
const boardOf = (faces, changes = {}) => {
  const tiles = faces.map((face, index) => ({ x: index * 4, y: 0, z: 0 }));
  return { tiles, nb: L.neighbors(tiles), faces, down: faces.map(() => 0), ...changes };
};
const visible = boardOf([0, 1, 2, 0, 1, 2, 3, 3], { start: [0, 1, 2] });
const careless = { ...actor, kinds: { 't3n-': { fatal: 1 } } };
assert.equal(Hard.play(visible, { ...careless, physicalSafety: 0 }, 1).why, 'tray');
assert(Hard.play(visible, careless, 1).win);

const tiles = [{ x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }, { x: 28, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
  { x: 8, y: 0, z: 0 }, { x: 8, y: 0, z: 1 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 32, y: 0, z: 0 }];
const closed = boardOf([0, 1, 2, 3, 3, 0, 1, 2, 4, 4, 5, 5], { tiles, nb: L.neighbors(tiles),
  down: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], start: [0, 1, 2], memory: Array(12).fill(1), physicalLog: [] });
const closedTrace = [], closedResult = Hard.play(closed, actor, 1, closedTrace);
assert.equal(closedTrace.find(item => item.physicalSafety !== undefined).reason, 'knownPair');
assert.deepEqual(closed.physicalLog.slice(3, 5).map(item => [item.index, item.kind, item.moves]), [[3, 'flip', 3], [4, 'take', 5]]);
assert.deepEqual(closed.physicalLog[4].tray, [0, 1, 2]);
assert(closedResult.win);
const novel = { ...closed, memory: null, physicalLog: [] }, novelTrace = [];
assert(Hard.play(novel, actor, 1, novelTrace).win);
assert.equal(novelTrace.find(item => item.physicalSafety !== undefined).reason, 'novelAtFullTray');

const hiddenChoices = [[3, 5], [5, 3]].map(pictures => {
  const faces = closed.faces.slice(); faces[3] = pictures[0]; faces[10] = pictures[1];
  const down = closed.down.slice(); down[10] = 1;
  const trace = [];
  Hard.play({ ...closed, faces, down, memory: null, physicalLog: [] }, actor, 2, trace);
  return trace.find(item => item.physicalSafety !== undefined);
});
assert.deepEqual(hiddenChoices[0], hiddenChoices[1]);

const clock = boardOf([0, 0, 1, 1], { start: [0], clock: { i: 3, n: 2 } }), clockTrace = [];
const clockResult = Hard.play(clock, { ...actor, physicalPlan: 14 }, 1, clockTrace);
assert.equal(clockTrace.find(item => item.physicalPlan !== undefined).physicalPlan, 3);
assert.equal(clockResult.at[3], 1);
assert.notEqual(clockResult.why, 'clock');
const exitTiles = [{ x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
  { x: 0, y: 0, z: 3 }, { x: 12, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
const exitGame = boardOf([0, 1, 2, 3, 3, 0, 1, 2], { tiles: exitTiles, nb: L.neighbors(exitTiles),
  start: [0, 1], memory: Array(8).fill(1), clock: { i: 2, n: 5 } });
const simpleTrace = [], safeTrace = [];
Hard.play(exitGame, { ...actor, physicalPlan: 14 }, 1, simpleTrace);
const exitResult = Hard.play(exitGame, { ...actor, physicalPlan: 14, physicalClockSafeExit: true }, 1, safeTrace);
assert.equal(simpleTrace.find(item => item.physicalPlan !== undefined).physicalPlan, 2);
assert.equal(safeTrace.find(item => item.physicalPlan !== undefined).physicalPlan, 3);
assert(exitResult.win);
assert.equal(exitResult.at[2], 4);

const jokerTiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
jokerTiles[3].z = 2; jokerTiles[4] = { x: jokerTiles[3].x, y: 0, z: 1 };
jokerTiles[7] = { x: jokerTiles[3].x, y: 0, z: 0 };
jokerTiles[5].z = 1; jokerTiles[6] = { x: jokerTiles[5].x, y: 0, z: 0 };
const joker = boardOf([0, 1, 2, 101, 0, 101, 1, 2], { tiles: jokerTiles, nb: L.neighbors(jokerTiles),
  down: [0, 0, 0, 1, 0, 1, 0, 0], start: [0, 1, 2], physicalLog: [] });
Hard.play(joker, actor, 1);
assert.deepEqual(joker.physicalLog.slice(3, 5).map(item => [item.index, item.kind, item.moves]), [[3, 'flip', 3], [3, 'take', 5]]);
assert.deepEqual(joker.physicalLog[4].tray, [0, 2]);

const closedMistake = boardOf([0, 1, 2, 0, 3], { start: [0, 1, 2], down: [0, 0, 0, 0, 1], memory: Array(5).fill(1), physicalLog: [] });
Hard.play(closedMistake, { ...actor, physicalSafety: 0, forceMatches: true, matchError: 1 }, 1);
assert.equal(closedMistake.physicalLog[3].index, 3);
assert.equal(closedMistake.physicalLog[3].kind, 'take');
const followed = boardOf([0, 0, 1, 1], { follow: [2, 3], log: [], policyLog: [], logMatches: true });
const plain = structuredClone(followed);
assert.deepEqual(Hard.play(followed, actor, 1), Hard.play(plain, { ...actor, physicalSafety: 0 }, 1));
assert.deepEqual(followed.policyLog, plain.policyLog);
assert.deepEqual(Hard.play(visible, { ...actor, physicalSafety: 0 }, 2), Hard.play(visible, { ...actor, physicalSafety: undefined }, 2));
console.log('PASS physical finishing: known matches, separate pair taps, novel full-tray inspections, clock priority, wildcard timing and no closed-tile fatal shortcut');
