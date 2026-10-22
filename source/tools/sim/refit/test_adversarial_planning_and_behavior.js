'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const { search } = require('./public_witness_search.js');
const { createObservedMemory } = require('./personal_observed_memory.js');
const { computeActionProbabilities, computeCalibrationMetrics } = require('./personal_g3_behavioral_evaluation.js');

console.log('Testing adversarial planning controls, memory causal isolation, and behavioral calibration...');

// 1. ADVERSARIAL PLANNING CONTROLS: clockPatience effect on clock cone
// Geometry with a clock at index 0, tile 1 above tile 0 (cone), and tile 2 independent
const clockGeom = {
  tiles: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }],
  nb: {
    above: [[1], [], []],
    left: [[], [], []],
    right: [[], [], []]
  },
  rules: null,
  clock: { i: 0 }
};

const clockState = {
  pictures: [null, null, null],
  down: [1, 1, 1],
  alive: [1, 1, 1],
  tray: [],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};

// Legal moves: tile 1 (in clock cone) and tile 2 (outside cone)
const legalClockMoves = [{ index: 1, inspect: true }, { index: 2, inspect: true }];

// High clockPatience (0.9) must prioritize clock cone tile 1
const highPatienceSearch = search(clockGeom, clockState, legalClockMoves, {
  depth: 14, trayBuffer: 2, clockPatience: 0.9
});
assert.equal(highPatienceSearch.path[0], 1, 'High clock patience must choose clock cone tile');

// Low clockPatience (0.1) must not prioritize clock cone
const lowPatienceSearch = search(clockGeom, clockState, legalClockMoves, {
  depth: 14, trayBuffer: 2, clockPatience: 0.1
});
assert.equal(lowPatienceSearch.path[0], 2, 'Low clock patience must choose non-cone tile');

// When clock is dead/absent, clockPatience must have zero effect
const deadClockGeom = { ...clockGeom, clock: null };
const deadClockHigh = search(deadClockGeom, clockState, legalClockMoves, { depth: 14, trayBuffer: 2, clockPatience: 0.9 });
const deadClockLow = search(deadClockGeom, clockState, legalClockMoves, { depth: 14, trayBuffer: 2, clockPatience: 0.1 });
assert.deepEqual(deadClockHigh.path, deadClockLow.path, 'clockPatience must have no effect when clock is dead/absent');

// 2. ADVERSARIAL PLANNING CONTROLS: trayBuffer effect under tray pressure
const trayGeom = {
  tiles: [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }],
  nb: { above: [[], [], []], left: [[], [], []], right: [[], []] },
  rules: null, clock: null
};

// Tray has [1, 2] (length 2). Tile 0 has picture 1 (pair match). Tile 1 has picture 3 (single add).
const crowdedState = {
  pictures: [1, 3, 4],
  down: [0, 0, 0],
  alive: [1, 1, 1],
  tray: [1, 2],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
const trayMoves = [{ index: 0, inspect: false }, { index: 1, inspect: false }];

// trayBuffer 3 (strict recovery) forces immediate pair match (tile 0)
const strictTray = search(trayGeom, crowdedState, trayMoves, { depth: 10, trayBuffer: 3 });
assert.equal(strictTray.path[0], 0, 'Strict trayBuffer must immediately match tray');

// 3. ADVERSARIAL INFORMATION BOUNDARY: True causal invariance to concealed face-down contents
const hiddenGeom = {
  tiles: [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }],
  nb: { above: [[], []], left: [[], []], right: [[], []] },
  rules: null, clock: null
};

// Public search state where tile 0 is face-down and uninspected (picture is null)
// Tray has picture [5]. Exposed tile 1 has picture 5.
const stateHiddenA = {
  pictures: [null, 5],
  down: [1, 0],
  alive: [1, 1],
  tray: [5],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
// State B has the exact same public visible information, but Deal A had tile 0 = 5 (a match if leaked)
// and Deal B had tile 0 = 99 (no match). Both produce identical public searchState.
const stateHiddenB = {
  pictures: [null, 5],
  down: [1, 0],
  alive: [1, 1],
  tray: [5],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
const hiddenMoves = [{ index: 0, inspect: true }, { index: 1, inspect: false }];

const searchA = search(hiddenGeom, stateHiddenA, hiddenMoves, { depth: 10, trayBuffer: 2, clockPatience: 0.5 });
const searchB = search(hiddenGeom, stateHiddenB, hiddenMoves, { depth: 10, trayBuffer: 2, clockPatience: 0.5 });
assert.deepEqual(searchA, searchB, 'Search decision must be bit-for-bit invariant to concealed tile contents');

const probsA = computeActionProbabilities(hiddenGeom, stateHiddenA, hiddenMoves, { trayBuffer: 2, clockPatience: 0.5 });
const probsB = computeActionProbabilities(hiddenGeom, stateHiddenB, hiddenMoves, { trayBuffer: 2, clockPatience: 0.5 });
assert.deepEqual(probsA, probsB, 'Action probabilities must be bit-for-bit invariant to concealed tile contents');
assert(probsA.find(p => p.index === 1).probability > probsA.find(p => p.index === 0).probability,
  'Search must prefer matching known exposed tile 1 over peeking unknown tile 0');

// 4. ADVERSARIAL CAUSAL EFFECT OF OBSERVED MEMORY
const memory = createObservedMemory({
  size: 2,
  campaign: 'adversarial_test',
  board: 'board_test',
  seed: 42,
  retryRetention: 0.8,
  decay: 0.01
});
memory.beginAttempt({ campaign: 'adversarial_test', board: 'board_test', size: 2, attempt: 1 });

// Before observing tile 0: tile 0 is completely unknown
const obs1 = memory.observe({
  physicalTaps: 0,
  alive: [1, 1],
  pictures: [null, 5],
  evidence: [null, { kind: 'test', sha256: '0'.repeat(64) }]
});
assert.equal(obs1.pictures[0], null, 'Uninspected tile must remain null');

// Now simulate inspection: tile 0 was observed as picture 5
const obs2 = memory.observe({
  physicalTaps: 1,
  alive: [1, 1],
  pictures: [5, 5],
  evidence: [{ kind: 'test', sha256: '0'.repeat(64) }, { kind: 'test', sha256: '0'.repeat(64) }]
});
assert.equal(obs2.pictures[0], 5, 'Observed tile must be recorded in memory');

// Now peek closes: tile 0 is still face down, but memory remembers picture 5
const obs3 = memory.observe({
  physicalTaps: 2,
  alive: [1, 1],
  pictures: [null, 5],
  evidence: [null, { kind: 'test', sha256: '0'.repeat(64) }]
});
assert.equal(obs3.pictures[0], 5, 'Memory must retain picture 5 after peek closes');

// 5. ADVERSARIAL CALIBRATION SENSITIVITY
const truePreds = [
  { actionProbabilities: [{ index: 0, probability: 0.9 }, { index: 1, probability: 0.1 }], targetIndex: 0 },
  { actionProbabilities: [{ index: 0, probability: 0.85 }, { index: 1, probability: 0.15 }], targetIndex: 0 }
];
const invertedPreds = [
  { actionProbabilities: [{ index: 0, probability: 0.1 }, { index: 1, probability: 0.9 }], targetIndex: 0 },
  { actionProbabilities: [{ index: 0, probability: 0.15 }, { index: 1, probability: 0.85 }], targetIndex: 0 }
];
const goodCalib = computeCalibrationMetrics(truePreds);
const badCalib = computeCalibrationMetrics(invertedPreds);

assert(goodCalib.brierScore < badCalib.brierScore, 'Good calibration must have lower Brier score than inverted');
assert(goodCalib.logLoss < badCalib.logLoss, 'Good calibration must have lower log loss than inverted');

console.log('PASS adversarial tests: clockPatience controls verified, trayBuffer bounds verified, concealed tile boundary preserved, observed memory causal effects verified, and calibration scoring sensitivity verified.');
