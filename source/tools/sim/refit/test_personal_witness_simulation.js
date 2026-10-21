'use strict';
const assert = require('assert/strict');
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

// 2. Production physics: Valid two-tile all-down clock deal
// In production physics, pure inspection costs 0 removal moves, clearing tap clears deal on attempt 1
const clockTiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
const clockGame = {
  tiles: clockTiles,
  nb: Layouts.neighbors(clockTiles),
  faces: [1, 1],
  down: new Uint8Array([1, 1]),
  rules: null,
  clock: { i: 1, n: 1 }
};
const resClock = simulatePersonalCampaign(clockGame, 'Dennisisdebeste', { maxAttempts: 3 });
assert.equal(resClock.wonOn, 1, 'Two-tile clock deal should clear on attempt 1 in production physics');

// 3. Production physics: Four distinct pictures tray overflow deal
// Must lose immediately to tray >= 4 and return wonOn = null (never maxAttempts)
const trayTiles = [
  { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 24, y: 0, z: 0 },
  { x: 32, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }
];
const trayGame = {
  tiles: trayTiles,
  nb: Layouts.neighbors(trayTiles),
  faces: [1, 2, 3, 4, 5, 6], // no matches possible
  down: new Uint8Array([0, 0, 0, 0, 0, 0]),
  rules: null,
  clock: null
};
const resTray = simulatePersonalCampaign(trayGame, 'Mrs. Doubtfire', { maxAttempts: 2 });
assert.equal(resTray.wonOn, null, 'Unsolvable tray deal should return wonOn = null');
assert(resTray.history.every(h => h.why === 'tray' || h.status === 'physicalLoss'), 'Should lose to tray');

// 4. Board with face-down tiles requiring retry carry-forward
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

// 5. Test deterministic reproducibility
const runA = simulatePersonalCampaign(towerGame, 'PUK', { maxAttempts: 2 });
const runB = simulatePersonalCampaign(towerGame, 'PUK', { maxAttempts: 2 });
assert.equal(runA.wonOn, runB.wonOn);
assert.equal(runA.totalAttempts, runB.totalAttempts);

// 6. Test numerical caps and unsupported transitions remain unresolved
// Under choiceLimit: 1, session terminates as computationCensored; wonOn must be null, no retry allowed
const resCapped = simulatePersonalCampaign(towerGame, 'Dennisisdebeste', { maxAttempts: 3, choiceLimit: 1 });
assert.equal(resCapped.wonOn, null, 'Capped campaign must return wonOn = null');
assert.equal(resCapped.cleared, false, 'Capped campaign must not be marked cleared');
assert.equal(resCapped.totalAttempts, 1, 'Capped campaign must not perform retries');
assert.equal(resCapped.history.length, 1);
assert.equal(resCapped.history[0].status, 'unresolved', 'Capped campaign must record status unresolved');

console.log('PASS personal witness simulation: production physics via Hard, two-tile clock clear, tray overflow loss, wonOn null on failure, and multi-attempt retry learning');
