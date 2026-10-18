'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { featuresOf } = require('./known_tray_plan.js');
const { choiceFactory } = require('./personal_context_choice.js');
const encoded = { withinWeights: new Array(76).fill(0), kindModel: { weights: Object.fromEntries(
  ['flip', 'pair', 'single', 'fatal'].map(kind => [kind, new Array(26).fill(0)])) } };
const choose = choiceFactory(encoded, { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0);
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0,
  forceMatches: false, kindModel: encoded.kindModel, w: encoded.withinWeights.slice(0, 21),
  spatial: encoded.withinWeights.slice(21, 68), goalWeights: encoded.withinWeights.slice(68), physicalChoice: choose };
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 8, y: 0, z: 0 },
  { x: 8, y: 0, z: 1 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
const make = changes => ({ tiles, nb: L.neighbors(tiles), faces: [2, 0, 3, 1, 0, 1], down: [0, 0, 1, 0, 0, 0], ...changes });
const stopped = new Error('Captured public planning state');
const captures = [];
for (const changes of [{}, { faces: [3, 0, 2, 1, 0, 1], down: [1, 0, 0, 0, 0, 0] },
  { faces: Int16Array.from([2, 0, 3, 1, 0, 1]) }]) {
  const game = make(changes);
  let planningFeatures;
  try {
    Hard.play(game, { ...actor, physicalTrayPlanning: (publicGame, state, actions) => {
      assert.deepEqual(Object.keys(publicGame), ['tiles', 'nb', 'rules', 'clock']);
      assert.equal(state.pictures[0], null); assert.equal(state.pictures[2], null);
      assert.equal(state.down[0], 0); assert.equal(state.down[2], 0);
      assert(Object.isFrozen(state) && Object.isFrozen(state.alive) && Object.isFrozen(state.pictures));
      assert(Object.isFrozen(publicGame.tiles[0]) && Object.isFrozen(publicGame.nb.above[0]));
      assert.throws(() => { state.pictures[0] = 77; }, TypeError);
      planningFeatures = featuresOf(publicGame, state, actions);
      captures.push({ game: publicGame, state, actions, features: planningFeatures });
      return planningFeatures;
    }, physicalChoice: decision => {
      assert.deepEqual(decision.knownPlan, planningFeatures.features);
      throw stopped;
    } }, 1);
  } catch (error) { if (error !== stopped) throw error; }
}
assert.deepEqual(captures[0], captures[1]);
assert.deepEqual(captures[0], captures[2]);
for (const seed of [1, 5, 11]) {
  const first = make({ physicalLog: [] }), second = make({ physicalLog: [] });
  assert.deepEqual(Hard.play(first, actor, seed), Hard.play(second, { ...actor, physicalTrayPlanning: featuresOf }, seed));
  assert.deepEqual(first.physicalLog, second.physicalLog);
}
const followed = make({ follow: [1, 4, 3, 5], log: [], logMatches: true, policyLog: [] });
const plain = make({ follow: [1, 4, 3, 5], log: [], logMatches: true, policyLog: [] });
const observationActor = { ...actor, kindModel: undefined, physicalChoice: undefined };
assert.deepEqual(Hard.play(followed, { ...observationActor, physicalTrayPlanning: featuresOf }, 1), Hard.play(plain, observationActor, 1));
assert(followed.policyLog.every(decision => decision.knownPlan?.length === decision.F.length));
assert.deepEqual(followed.policyLog.map(({ knownPlan, ...decision }) => decision), plain.policyLog);
assert.throws(() => Hard.play(make({}), { ...actor, physicalTrayPlanning: true }, 1), /instrumented/);
assert.throws(() => Hard.play(make({ follow: [1, 4, 3, 5], log: [], logMatches: true, policyLog: [] }),
  { ...actor, physicalTrayPlanning: featuresOf }, 1), /unmasked/);
assert.throws(() => Hard.play(make({}), { ...actor, physicalTrayPlanning: () => ({ features: [], nodes: 0, boundaries: 0 }) }, 1), /Invalid known-only/);
console.log('PASS known-only runtime masks unknown pictures and orientation, freezes public inputs and preserves original seeded/followed behavior');
