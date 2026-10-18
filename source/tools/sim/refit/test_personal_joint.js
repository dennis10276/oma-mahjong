'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const kinds = () => Object.fromEntries(['flip', 'pair', 'single', 'fatal'].map(kind => [kind, Array(Hard.KIND_CONTEXT.length).fill(0)]));
const actorOf = () => ({ ...Hard.P, physicalFlips: true, peek: 0, end: 0, plan: 0, allMoves: true, flips: true,
  forceMatches: false, w: Array(Hard.FEAT.length).fill(0), spatial: Array(Hard.POLICY_FEAT.length - Hard.FEAT.length).fill(0),
  jointKindModel: { weights: kinds() } });
const boardOf = (faces, changes = {}) => {
  const tiles = faces.map((face, index) => ({ x: index * 4, y: 0, z: 0 }));
  return { tiles, nb: L.neighbors(tiles), faces, down: faces.map(() => 0), physicalLog: [], ...changes };
};
const match = actorOf();
match.jointKindModel.weights.flip[0] = 20;
match.spatial[Hard.POLICY_FEAT.indexOf('visibleTrayMatch') - Hard.FEAT.length] = 100;
const game = boardOf([0, 0, 1, 1], { start: [0], down: [0, 0, 1, 1] });
Hard.play(game, match, 1);
assert.equal(game.physicalLog[1].index, 1);
assert.equal(game.physicalLog[1].kind, 'take');
const inspect = actorOf();
inspect.jointKindModel.weights.flip[0] = 100;
inspect.spatial[Hard.POLICY_FEAT.indexOf('x') - Hard.FEAT.length] = 100;
const positions = boardOf([0, 0, 1, 1], { down: [1, 1, 1, 1] });
Hard.play(positions, inspect, 1);
assert.equal(positions.physicalLog[0].index, 3);
assert.equal(positions.physicalLog[0].kind, 'flip');
const hiddenChoices = [[0, 1, 0, 1], [1, 0, 0, 1]].map(faces => {
  const board = boardOf(faces, { down: [1, 1, 0, 0] });
  Hard.play(board, inspect, 2);
  return board.physicalLog[0];
});
assert.deepEqual(hiddenChoices[0], hiddenChoices[1]);
assert.throws(() => Hard.play(boardOf([0, 0]), { ...match, kindModel: { weights: kinds() } }, 1), /cannot also mask/);
const followed = boardOf([0, 0, 1, 1], { down: [1, 1, 0, 0], follow: [-1, -2], log: [], policyLog: [], logMatches: true });
const plain = structuredClone(followed);
const { jointKindModel, ...ordinary } = match;
assert.deepEqual(Hard.play(followed, match, 1), Hard.play(plain, ordinary, 1));
assert.deepEqual(followed.policyLog, plain.policyLog);
const calibrated = actorOf();
calibrated.w[6] = 0.2;
calibrated.w[19] = 0.3;
calibrated.w[20] = 1;
calibrated.spatial[Hard.POLICY_FEAT.indexOf('x') - Hard.FEAT.length] = -0.8;
calibrated.jointKindModel.weights.flip[0] = 0.7;
calibrated.jointKindModel.weights.single[0] = -0.2;
calibrated.goalWeights = Array(Hard.GOAL_FEAT.length).fill(0);
calibrated.goalWeights[Hard.GOAL_FEAT.indexOf('clockTaken')] = 2;
const calibrationBoard = boardOf([0, 0, 1, 1], { down: [1, 0, 1, 0], clock: { i: 1, n: 4 },
  follow: [1], log: [], policyLog: [], logMatches: true });
Hard.play(calibrationBoard, calibrated, 1);
const decision = calibrationBoard.policyLog[0], weights = [...calibrated.w, ...calibrated.spatial, ...calibrated.goalWeights];
const values = decision.F.map((feature, index) => {
  const kind = feature[19] ? 'flip' : feature[18] ? 'fatal' : feature[14] ? 'pair' : 'single';
  return feature.concat(decision.goals[index]).reduce((sum, value, position) => sum + value * weights[position], 0)
    + decision.kindContext.reduce((sum, value, position) => sum + value * calibrated.jointKindModel.weights[kind][position], 0);
});
const probabilities = values.map(value => Math.exp(value - Math.max(...values)));
for (let seed = 1; seed <= 100; seed++) {
  const random = L.rng(seed);
  random(); random();
  let draw = random() * probabilities.reduce((sum, value) => sum + value, 0), selected = 0;
  while (selected < probabilities.length - 1 && (draw -= probabilities[selected]) > 0) selected++;
  const board = boardOf([0, 0, 1, 1], { down: [1, 0, 1, 0], clock: { i: 1, n: 4 } });
  Hard.play(board, calibrated, seed);
  assert.equal(board.physicalLog[0].index, [1, 3, 0, 2][selected]);
}
console.log('PASS joint personal choice: cross-kind values, learned flip position, hidden-picture invariance and unchanged follow');
