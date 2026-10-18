'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0,
  forceMatches: false, physicalPlan: 14, physicalPlanNodes: 300 };
const boardOf = (faces, changes = {}) => {
  const tiles = faces.map((face, index) => ({ x: index * 4, y: 0, z: 0 }));
  return { tiles, nb: L.neighbors(tiles), faces, down: faces.map(() => 0), ...changes };
};
const visible = boardOf([0, 0, 1, 1], { clock: { i: 3, n: 1 }, physicalLog: [] });
const visibleTrace = [], visibleResult = Hard.play(visible, actor, 1, visibleTrace);
assert.equal(visibleTrace.find(item => item.physicalPlan !== undefined).physicalPlan, 3);
assert.equal(visibleResult.at[3], 0);
assert.notEqual(visibleResult.why, 'clock');
assert.equal(visible.physicalLog[0].moves, 1);

const blindClock = boardOf([0, 0, 1, 1], { down: [1, 0, 0, 0], clock: { i: 0, n: 1 }, physicalLog: [] });
const blindTrace = [], blindResult = Hard.play(blindClock, actor, 1, blindTrace);
assert.deepEqual(blindTrace.filter(item => item.physicalPlan !== undefined).slice(0, 2)
  .map(item => [item.physicalPlan, item.inspect, item.known]), [[0, true, false], [0, false, true]]);
assert.deepEqual(blindClock.physicalLog.slice(0, 2).map(item => [item.index, item.kind, item.moves]), [[0, 'flip', 0], [0, 'take', 1]]);
assert.equal(blindResult.at[0], 0);

const atomic = boardOf([1, 2, 3, 0, 0, 1, 2, 3], { down: [0, 0, 0, 0, 1, 0, 0, 0],
  start: [0, 1, 2], openPeekAtStart: 4, clock: { i: 4, n: 4 }, physicalLog: [] });
const atomicTrace = [], atomicResult = Hard.play(atomic, actor, 1, atomicTrace);
assert.equal(atomicTrace.find(item => item.physicalPlan !== undefined).physicalPlan, 3);
assert.equal(atomicResult.at[4], 4);
assert.notEqual(atomicResult.why, 'clock');
assert.equal(atomic.physicalLog[3].moves, 5);
assert.deepEqual(atomic.physicalLog[3].tray, [1, 2, 3]);

const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
const blocked = boardOf([1, 0, 0, 1], { tiles, nb: L.neighbors(tiles), down: [0, 1, 0, 0], start: [2], clock: { i: 0, n: 2 } });
assert.equal(Hard.play(blocked, actor, 1).why, 'clock');
const enough = { ...blocked, clock: { i: 0, n: 3 }, physicalLog: [] };
const enoughResult = Hard.play(enough, actor, 1);
assert.equal(enoughResult.at[0], 2);
assert.notEqual(enoughResult.why, 'clock');

const hiddenDecisions = [[0, 1, 0, 1], [1, 0, 0, 1]].map(faces => {
  const trace = [];
  Hard.play(boardOf(faces, { down: [1, 1, 0, 0], clock: { i: 0, n: 1 } }), actor, 2, trace);
  return trace.find(item => item.physicalPlan !== undefined);
});
assert.deepEqual(hiddenDecisions[0], hiddenDecisions[1]);
const coveredTiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 8, y: 0, z: 0 },
  { x: 8, y: 0, z: 1 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
const coveredDecisions = [[2, 0, 3, 1, 0, 1], [3, 0, 2, 1, 0, 1]].map(faces => {
  const trace = [];
  Hard.play(boardOf(faces, { tiles: coveredTiles, nb: L.neighbors(coveredTiles), clock: { i: 0, n: 2 } }), actor, 2, trace);
  return trace.find(item => item.physicalPlan !== undefined);
});
assert.equal(coveredDecisions[0].physicalPlan, 1);
assert.deepEqual(coveredDecisions[0], coveredDecisions[1]);
const mixedTiles = [...coveredTiles, { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }];
const hiddenSlots = [0, 2, 4, 6], baseFaces = [0, 1, 2, 3, 1, 0, 2, 3], shuffle = L.rng(20261029);
let firstChoice = null;
for (let sample = 0; sample < 32; sample++) {
  const faces = baseFaces.slice(), pictures = hiddenSlots.map(index => faces[index]);
  for (let position = pictures.length - 1; position > 0; position--) {
    const other = Math.floor(shuffle() * (position + 1));
    [pictures[position], pictures[other]] = [pictures[other], pictures[position]];
  }
  hiddenSlots.forEach((index, position) => { faces[index] = pictures[position]; });
  const trace = [];
  Hard.play(boardOf(faces, { tiles: mixedTiles, nb: L.neighbors(mixedTiles), down: [0, 0, 0, 0, 1, 0, 1, 0],
    clock: { i: 0, n: 6 } }), actor, 3, trace);
  const choice = trace.find(item => item.physicalPlan !== undefined || item.inspection !== undefined || item.pick);
  if (!sample) firstChoice = choice; else assert.deepEqual(choice, firstChoice);
}

const lockedClock = boardOf([0, 1, 1, 0, 2, 2], { clock: { i: 0, n: 3 },
  rules: { ice: {}, iceNb: [], locks: new Set([0]), keys: [1, 2] } });
const lockedResult = Hard.play(lockedClock, actor, 1);
assert.equal(lockedResult.at[1], 0);
assert.equal(lockedResult.at[2], 1);
assert.equal(lockedResult.at[0], 2);
assert.notEqual(lockedResult.why, 'clock');
const icedClock = boardOf([0, 1, 1, 0], { clock: { i: 0, n: 2 },
  rules: { ice: { 0: 1 }, iceNb: [[1]], locks: new Set(), keys: [] } });
const icedResult = Hard.play(icedClock, actor, 1);
assert.equal(icedResult.at[1], 0);
assert.equal(icedResult.at[0], 1);
assert.notEqual(icedResult.why, 'clock');
assert(icedResult.seen.every(value => value > 0));
const reliefClock = boardOf([0, 0, 1, 1], { clock: { i: 3, n: 1 },
  rules: { ice: {}, iceNb: [], locks: new Set([0, 1, 2, 3]), keys: [0, 1] } });
assert.equal(Hard.play(reliefClock, actor, 1).at[3], 0);

const { designed } = require('./boards.js');
for (const horizon of [8, 14, 24]) {
  const remembered = designed('1.55', 105), stats = new Proxy({}, {
    set(target, field, value) {
      if (field === 'physicalClockPlans') assert(value < 200, 'Known route must not alternate reopenings indefinitely');
      target[field] = value;
      return true;
    },
  });
  const rememberedResult = Hard.play({ ...remembered, memory: Array(remembered.faces.length).fill(1) },
    { ...actor, physicalPlan: horizon, stats }, 1);
  assert(rememberedResult.at[remembered.clock.i] >= 0);
  assert.notEqual(rememberedResult.why, 'clock');
}

const followed = boardOf([0, 0, 1, 1], { clock: { i: 3, n: 2 }, follow: [2, 3], log: [], policyLog: [], logMatches: true });
const followedPlain = structuredClone(followed);
assert.deepEqual(Hard.play(followed, actor, 1), Hard.play(followedPlain, { ...actor, physicalPlan: 0 }, 1));
assert.deepEqual(followed.policyLog, followedPlain.policyLog);
const ordinary = boardOf([0, 0, 1, 1]);
assert.deepEqual(Hard.play(ordinary, { ...actor, physicalPlan: 0 }, 2), Hard.play(ordinary, { ...actor, physicalPlan: undefined }, 2));
assert.throws(() => Hard.play(ordinary, { ...actor, plan: 10 }, 1), /Physical-tap actors/);
console.log('PASS physical clock planning: legal single taps, blind reveals, mandatory auto-matches, atomic deadlines, hidden-picture invariance and unchanged follow/defaults');
