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

// Concealed picture invariance tests:
// 1. Shuffling or changing concealed pictures under face-down or covered tiles
// MUST produce 100% identical decision indices, probabilities, and planning reports
// at every physical step BEFORE any of those concealed pictures becomes observable.
// 2. Once a tile is flipped or uncovered (observable), the bot legitimately reacts to the revealed face.
{
  const testTiles = [
    { x: 0, y: 0, z: 1 }, { x: 8, y: 0, z: 1 }, { x: 16, y: 0, z: 1 }, { x: 24, y: 0, z: 1 },
    { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }
  ];
  const testNb = Layouts.neighbors(testTiles);
  const testDown = [0, 0, 0, 0, 1, 0, 1, 0];
  const simulateTrace = faces => {
    const policy = reference();
    const g = { tiles: testTiles, nb: testNb, faces, down: testDown, rules: null, clock: null, physicalLog: [] };
    const trace = [];
    const choiceHook = decision => {
      const chosen = policy(decision);
      trace.push({
        chosen,
        probs: policy.probabilities(decision),
        report: policy.report()
      });
      return chosen;
    };
    choiceHook.observe = policy.observe;
    choiceHook.probabilities = policy.probabilities;
    choiceHook.physicalTrayPlanning = policy.physicalTrayPlanning;
    Hard.play(g, { ...parameters, physicalChoice: choiceHook, physicalTrayPlanning: policy.physicalTrayPlanning }, 1);
    return { trace, log: g.physicalLog };
  };

  const baseFaces = [1, 1, 2, 2, 7, 8, 9, 10];
  const baseline = simulateTrace(baseFaces);
  const rng = Layouts.rng(20261115);

  for (let iter = 0; iter < 40; iter++) {
    // Keep top visible tiles [1, 1, 2, 2] unchanged, randomize concealed tiles 4..7
    const alteredFaces = [1, 1, 2, 2,
      Math.floor(rng() * 36), Math.floor(rng() * 36),
      Math.floor(rng() * 36), Math.floor(rng() * 36)];
    const trial = simulateTrace(alteredFaces);
    // Before any bottom tile (4..7) is uncovered or inspected (first 2 match steps):
    for (let s = 0; s < 2; s++) {
      assert.equal(trial.trace[s].chosen, baseline.trace[s].chosen);
      assert.deepEqual(trial.trace[s].probs, baseline.trace[s].probs);
      assert.deepEqual(trial.trace[s].report.path[0], baseline.trace[s].report.path[0]);
      assert.equal(trial.log[s].index, baseline.log[s].index);
      assert.equal(trial.log[s].kind, baseline.log[s].kind);
    }
  }

  // Pure face-down inspection invariance test:
  const lineTiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }, { x: 32, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }];
  const lineNb = Layouts.neighbors(lineTiles);
  const lineDown = [0, 0, 0, 0, 1, 1];
  const runLine = faces => {
    const policy = reference();
    const g = { tiles: lineTiles, nb: lineNb, faces, down: lineDown, rules: null, clock: null, physicalLog: [] };
    const trace = [];
    const choiceHook = decision => {
      const chosen = policy(decision);
      trace.push({ chosen, report: policy.report() });
      return chosen;
    };
    choiceHook.observe = policy.observe;
    choiceHook.probabilities = policy.probabilities;
    choiceHook.physicalTrayPlanning = policy.physicalTrayPlanning;
    Hard.play(g, { ...parameters, physicalChoice: choiceHook, physicalTrayPlanning: policy.physicalTrayPlanning }, 1);
    return { trace, log: g.physicalLog };
  };

  const lineA = runLine([1, 2, 3, 4, 1, 2]); // Tile 4 has face 1 (would match tray)
  const lineB = runLine([1, 2, 3, 4, 30, 31]); // Tile 4 has face 30 (does not match tray)
  // Step 0: decisions before concealed tiles 4, 5 are observed must match
  assert.equal(lineA.trace[0].chosen, lineB.trace[0].chosen);
  assert.deepEqual(lineA.trace[0].report.path, lineB.trace[0].report.path);
  // After observation, the outcome branches legitimately:
  assert.equal(lineA.log[2].kind, 'take'); // Tile 4 is taken immediately as tray match
  assert.equal(lineB.log[2].kind, 'flip'); // Tile 4 is inspected because it does not match
}

console.log('PASS witness reference executes physical taps through production, retains only actual selected routes, preserves public tags, and concealed-picture changes cannot affect decisions before observation');
