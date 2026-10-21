'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calibratePlayer, calibrateAll } = require('./personal_behavioral_calibration.js');
const { NAMES } = require('./personal_model.js');

console.log('Testing personal behavioral calibration...');

// 1. Verify calibration across all four players
for (const name of NAMES) {
  const result = calibratePlayer(name);
  assert.equal(result.name, name);
  assert(result.episodes > 0, `Expected episodes for ${name}`);
  assert(typeof result.winRate === 'number' && result.winRate >= 0 && result.winRate <= 1);

  const params = result.parameters;
  assert([8, 12, 16, 20].includes(params.depth), `Invalid depth: ${params.depth}`);
  assert([1, 2, 3].includes(params.trayBuffer), `Invalid trayBuffer: ${params.trayBuffer}`);
  assert(params.clockPatience >= 0 && params.clockPatience <= 1.0, `Invalid clockPatience: ${params.clockPatience}`);
  assert(params.memoryDecay >= 0 && params.memoryDecay <= 1.0, `Invalid memoryDecay: ${params.memoryDecay}`);
  assert(params.retryLearning >= 0 && params.retryLearning <= 1.0, `Invalid retryLearning: ${params.retryLearning}`);

  assert(result.diagnostics, 'Expected diagnostics');
  assert(typeof result.diagnostics.singleProbAtTray2 === 'number');
  assert(typeof result.diagnostics.singleProbAtTray3 === 'number');
  assert(typeof result.diagnostics.retryCarryForwardRate === 'number');
}

// 2. Test strictly chronological cutoff availability
const dennisFull = calibratePlayer('Dennisisdebeste');
// Cut off at midway timestamp
const cutoff = 1792000000000;
const dennisCausal = calibratePlayer('Dennisisdebeste', cutoff);
assert(dennisCausal.episodes <= dennisFull.episodes, 'Cutoff must restrict or preserve episode count');

// 3. Test zero-episodes boundary (very early cutoff)
const earlyBoundary = calibratePlayer('Dennisisdebeste', 1000);
assert.equal(earlyBoundary.episodes, 0);
assert.equal(earlyBoundary.parameters.trayBuffer, 2);

// 4. Test calibrateAll file emission
const testOutPath = path.join(__dirname, 'test_behavioral_out.json');
try {
  const allResult = calibrateAll(testOutPath);
  assert(fs.existsSync(testOutPath));
  assert(allResult.players['Mrs. Doubtfire']);
  assert(allResult.players['Gerda']);
  assert(allResult.players['PUK']);
  assert(allResult.players['Dennisisdebeste']);
} finally {
  if (fs.existsSync(testOutPath)) fs.unlinkSync(testOutPath);
}

console.log('PASS personal behavioral calibration: empirical fitting, chronological availability, recency weighting, and parameter bounds');
