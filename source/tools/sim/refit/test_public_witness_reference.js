'use strict';
const assert = require('assert/strict'), Hard = require('../../../www/hard.js'), Layouts = require('../../../www/layouts.js');
const { reference, referenceFactory } = require('./public_witness_reference.js');
const { uniformPrior } = require('./personal_public_picture_prior.js');
const gameOf = (faces, changes = {}) => {
  const tiles = faces.map((face, index) => ({ x: index * 8, y: 0, z: 0 }));
  return { tiles, nb: Layouts.neighbors(tiles), faces, down: faces.map(() => 0), rules: null, clock: null, ...changes };
};
const parameters = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, forceMatches: false,
  peek: 0, end: 0, plan: 0, physicalPlan: 0, kindModel: { weights: {} }, publicPicturePrior: Array.from(uniformPrior()) };
for (const game of [gameOf([1, 1, 2, 2]), gameOf([1, 1], { clock: { i: 1, n: 1 } }), gameOf([1, 1, 2, 2], { down: [1, 1, 1, 1] })]) {
  const policy = reference();
  const played = { ...game, physicalLog: [] };
  const result = Hard.play(played, { ...parameters, physicalChoice: policy, physicalTrayPlanning: policy.physicalTrayPlanning }, 1);
  assert(result.win); assert.equal(result.moves, game.faces.length);
  assert(played.physicalLog.length >= game.faces.length / 2);
}
const policy = reference(), game = gameOf([1, 1, 2, 2]);
const state = { alive: [1, 1, 1, 1], pictures: game.faces, down: game.down, tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
const physical = require('./known_tray_plan.js'), tilePolicy = reference(), legacyPolicy = reference();
assert.throws(() => tilePolicy.acknowledgeTile(0));
let position = structuredClone(state);
while (position.alive.some(Boolean)) {
  const available = physical.legal(game, position).free.map(index => ({ index }));
  tilePolicy.physicalTrayPlanning(game, position, available); legacyPolicy.physicalTrayPlanning(game, position, available);
  const chosen = tilePolicy.report().index;
  assert.equal(chosen, available[legacyPolicy({ observationVersion: 1, F: available.map(() => []) })].index);
  assert.throws(() => tilePolicy.acknowledgeTile(999)); tilePolicy.acknowledgeTile(chosen);
  position = physical.advance(game, position, chosen).state;
}
assert.deepEqual(tilePolicy.stats(), legacyPolicy.stats());
const actions = game.faces.map((face, index) => ({ index, inspect: false }));
policy.physicalTrayPlanning(game, state, actions);
const decision = { observationVersion: 1, F: actions.map(() => []), kindContext: [] };
assert.deepEqual(policy.probabilities(decision), policy.probabilities(decision));
assert.equal(policy.stats().retainedSteps, 0);
assert.throws(() => policy({ ...decision, observationVersion: undefined }));
const factory = referenceFactory(); assert.throws(() => factory.physicalTrayPlanning(game, state, actions));
const result = Hard.rateChain(game, 2, 20261110, { ...parameters, physicalChoiceForAttempt: factory,
  physicalTrayPlanning: factory.physicalTrayPlanning, learnFromLoss: true }, 0, 3);
assert.equal(result.first, 1); assert.equal(factory.stats().length, 2);
const deadFaces = [4, 5, 6, 1, 2, 1, 4, 5, 2, 6];
const deadTiles = [{ x: 40, y: 0, z: 0 }, { x: 48, y: 0, z: 0 }, { x: 56, y: 0, z: 0 },
  { x: 0, y: 0, z: 3 }, { x: 8, y: 0, z: 2 }, { x: 0, y: 0, z: 2 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }];
const deadPolicy = reference();
const deadGame = { tiles: deadTiles, nb: Layouts.neighbors(deadTiles), faces: deadFaces, down: deadFaces.map((face, index) => +(index === 3 || index === 4)),
  memory: new Uint8Array(deadFaces.length).fill(1), start: [0, 1, 2], physicalLog: [] };
const deadResult = Hard.play(deadGame, { ...parameters, physicalChoice: deadPolicy, physicalTrayPlanning: deadPolicy.physicalTrayPlanning }, 1);
assert.equal(deadResult.why, 'tray'); assert.equal(deadResult.moves, 4);
assert(deadPolicy.stats().provedDeadEnds > 0); assert(deadGame.physicalLog.length < 10);
let injectedCalls = 0;
const injectedSearch = (...args) => { injectedCalls++; return require('./public_witness_search.js').search(...args); };
const injectedFactory = referenceFactory(undefined, injectedSearch);
const injectedResult = Hard.rateChain(game, 2, 20261110, { ...parameters, physicalChoiceForAttempt: injectedFactory,
  physicalTrayPlanning: injectedFactory.physicalTrayPlanning, learnFromLoss: true }, 0, 3);
assert.deepEqual(injectedResult, result); assert(injectedCalls >= 2);
assert.deepEqual(injectedFactory.stats(), factory.stats());
assert.throws(() => reference(undefined, null));
console.log('PASS witness reference executes physical taps through production, retains only actual selected routes, preserves public tags and resets planner state per canonical attempt factory');
