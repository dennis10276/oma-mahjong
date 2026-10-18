'use strict';
const assert = require('assert/strict');
const { knownPlanFactory } = require('./personal_known_plan_choice.js');
const { FEATURES } = require('./known_tray_plan.js');
const { featuresOf } = require('./known_tray_plan.js');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const actor = { withinWeights: new Array(76).fill(0), kindModel: { weights: Object.fromEntries(
  ['flip', 'pair', 'single', 'fatal'].map(kind => [kind, new Array(26).fill(0)])) } };
const model = { type: 'personalKnownTrayPlan-v1', features: FEATURES, weights: [2, 0, 0, 0, 0], parameters: { taps: 6, nodes: 256, progress: 4 } };
const decision = { F: [new Array(76).fill(0), new Array(76).fill(0)], immediate: [new Array(29).fill(0), new Array(29).fill(0)],
  kindContext: new Array(26).fill(0), knownPlan: [[0, 0, 0, 0, 0], [1, 1, 0, 0, 0]] };
const choose = knownPlanFactory(actor, model);
assert(choose.probabilities(decision)[1] > 0.8);
assert.deepEqual(knownPlanFactory(actor, model, 0).probabilities(decision), [0.5, 0.5]);
assert.equal(choose(decision, 0.9), 1);
assert(knownPlanFactory(actor, { ...model, weights: [-2, 0, 0, 0, 0] }).probabilities(decision)[0] > 0.8);
assert.throws(() => knownPlanFactory(actor, { ...model, weights: [2, 0, 0, 0, 1] }), /Invalid/);
assert.throws(() => choose.probabilities({ ...decision, knownPlan: [[0], [1]] }), /Invalid/);
assert.throws(() => choose(decision, 1), /Invalid/);
const tiles = [0, 0, 1, 1, 2, 2].map((face, index) => ({ x: index * 4, y: 0, z: 0 }));
const game = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1, 2, 2], down: [1, 1, 0, 0, 0, 0] };
const persona = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0,
  forceMatches: false, kindModel: actor.kindModel, w: actor.withinWeights.slice(0, 21),
  spatial: actor.withinWeights.slice(21, 68), goalWeights: actor.withinWeights.slice(68), physicalChoice: choose };
for (const seed of [1, 7, 19]) {
  assert.deepEqual(Hard.rateChain(game, 4, seed, { ...persona, physicalTrayPlanning: choose.physicalTrayPlanning }, 0.75, 4),
    Hard.rateChain(game, 4, seed, { ...persona, physicalTrayPlanning: featuresOf }, 0.75, 4));
}
assert(choose.physicalTrayPlanning.stats().hits > 0);
console.log('PASS personal known-plan coefficients can prefer, ignore or reject route progress without enforcing greed');
