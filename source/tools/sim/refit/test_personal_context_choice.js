'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { choiceFactory } = require('./personal_context_choice.js');
const encoded = { withinWeights: new Array(76).fill(0), kindModel: { weights: Object.fromEntries(['flip', 'pair', 'single', 'fatal'].map(kind => [kind, new Array(26).fill(0)])) } };
const empty = { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] };
const choices = [[0], [0], [0]].map(() => new Array(76).fill(0));
choices[2][19] = 1;
const decision = { F: choices, immediate: choices.map(() => new Array(29).fill(0)), kindContext: new Array(26).fill(0) };
assert.deepEqual(choiceFactory(encoded, empty).probabilities(decision), [0.25, 0.25, 0.5]);
assert.equal(choiceFactory(encoded, empty)(decision, 0.8), 2);
assert.throws(() => choiceFactory(encoded, { ...empty, trees: [[[0, 1, 0, 0, 0]]] }));
assert.throws(() => choiceFactory(encoded, empty)(decision, 1));
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false,
  kindModel: encoded.kindModel, w: encoded.withinWeights.slice(0, 21), spatial: encoded.withinWeights.slice(21, 68), goalWeights: encoded.withinWeights.slice(68) };
const make = faces => {
  const tiles = faces.map((face, index) => ({ x: index * 8, y: 0, z: 0 }));
  return { tiles, nb: L.neighbors(tiles), faces, down: [0, 1, 1, 0, 0, 0] };
};
const snapshots = [[0, 1, 2, 0, 1, 2], [0, 2, 1, 0, 1, 2]].map(faces => {
  let initial = null;
  const choose = choiceFactory(encoded, empty);
  Hard.play(make(faces), { ...actor, physicalChoice: (features, draw) => {
    if (!initial) initial = structuredClone(features);
    assert(features.F.every(feature => feature.length === 76));
    assert(features.immediate.every(feature => feature.length === 29));
    assert.equal(features.kindContext.length, 26);
    return choose(features, draw);
  } }, 1);
  assert(initial);
  return initial;
});
assert.deepEqual(snapshots[0], snapshots[1]);
const followed = { ...make([0, 1, 2, 0, 1, 2]), follow: [0], log: [], policyLog: [], physicalLog: [] };
const plain = structuredClone(followed);
assert.deepEqual(Hard.play(followed, { ...actor, physicalChoice: () => { throw new Error('Follow cannot call context selection'); } }, 1), Hard.play(plain, actor, 1));
assert.deepEqual(followed.policyLog, plain.policyLog);
assert.deepEqual(followed.physicalLog, plain.physicalLog);
assert.throws(() => Hard.play(make([0, 1, 2, 0, 1, 2]), { ...actor, physicalChoice: () => 1000 }, 1));
const repeated = { ...make([0, 1, 2, 0, 1, 2]), down: [1, 1, 1, 1, 1, 1], physicalLog: [] };
let inspections = 0;
const chooseRepeat = features => {
  const wanted = inspections++ % 2 ? 0.2 : 0;
  const selected = features.F.findIndex(feature => feature[19] && Math.abs(feature[21] - wanted) < 1e-12);
  assert(selected >= 0, 'A legal repeated physical inspection must remain available');
  return selected;
};
const stats = {};
const bounded = Hard.play(repeated, { ...actor, physicalChoice: chooseRepeat, physicalChoiceLimit: 6, stats }, 1);
assert.equal(bounded.why, 'contextChoiceLimit');
assert.equal(repeated.physicalLog.length, 6);
assert.equal(bounded.moves, 0);
assert.equal(stats.contextChoiceLimits, 1);
assert.throws(() => Hard.play(make([0, 1, 2, 0, 1, 2]), { ...actor, physicalChoice: chooseRepeat, physicalChoiceLimit: 0 }, 1));
console.log('PASS contextual runtime: hierarchical type normalization, physical flip selection, hidden-picture invariance, exact followed controls and strict validation');
