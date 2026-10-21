'use strict';
const assert = require('assert');
const { simulatePersonalCampaign } = require('./personal_witness_simulation.js');
const Layouts = require('../../../www/layouts.js');

console.log('Testing personal witness simulation...');

// 1. Simple solvable board with 4 tiles (2 pairs)
const simpleTiles = [
  { x: 0, y: 0, z: 0 },
  { x: 2, y: 0, z: 0 },
  { x: 4, y: 0, z: 0 },
  { x: 6, y: 0, z: 0 }
];
const simpleGame = {
  tiles: simpleTiles,
  nb: Layouts.neighbors(simpleTiles),
  faces: [1, 2, 1, 2],
  down: new Uint8Array([0, 0, 0, 0]),
  rules: null,
  clock: null
};

const resultDennis = simulatePersonalCampaign(simpleGame, 'Dennisisdebeste', { maxAttempts: 3 });
assert(resultDennis.cleared, 'Should clear simple board');
assert.equal(resultDennis.wonOn, 1, 'Should clear simple board on attempt 1');
assert.equal(resultDennis.parameters.depth, 16);

// 2. Board with face-down tiles requiring retry carry-forward
// Tower: Tile 0 covers 1; Tile 2 covers 3
const towerTiles = [
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: 0 },
  { x: 4, y: 0, z: 1 },
  { x: 4, y: 0, z: 0 }
];
const towerGame = {
  tiles: towerTiles,
  nb: Layouts.neighbors(towerTiles),
  faces: [1, 2, 2, 1], // 0 pairs with 3; 1 pairs with 2
  down: new Uint8Array([1, 1, 1, 1]),
  rules: null,
  clock: null
};

const resultTower = simulatePersonalCampaign(towerGame, 'Mrs. Doubtfire', { maxAttempts: 4 });
assert(resultTower.totalAttempts >= 1);
assert(resultTower.parameters.retryLearning > 0);

// 3. Test deterministic reproducibility
const runA = simulatePersonalCampaign(towerGame, 'PUK', { maxAttempts: 2 });
const runB = simulatePersonalCampaign(towerGame, 'PUK', { maxAttempts: 2 });
assert.equal(runA.wonOn, runB.wonOn);
assert.equal(runA.totalAttempts, runB.totalAttempts);

console.log('PASS personal witness simulation: multi-attempt carry-forward, deterministic seeds, and player parameter integration');
