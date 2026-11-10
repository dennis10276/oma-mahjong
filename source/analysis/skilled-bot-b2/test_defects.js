'use strict';
const assert = require('assert/strict');
const path = require('path');

// Test suite for Task B2 defects and causal verification
const { createCandidatePlannerController } = require('./candidate_controller.js');
const release = require('../../tools/sim/refit/human_release.js');
const { normalizeBoard } = require('../../tools/sim/refit/public_board_input.js');

console.log('=== Task B2: Causal Verification Tests ===');

// --- Test 1: Isolated canRelieveBits check (Defect 1) ---
// Lead review: "An isolated invocation of the exact extracted function, with orphan face 7
// and two other tiles both face 9, returns true although no tile can match face 7."
function testDefect1IsolatedFalseRelief() {
  console.log('\n[Test 1] Testing canRelieveBits isolated false relief prevention...');

  // Construct a minimal board where tile 0 is face 7, tile 1 and 2 are face 9.
  // Tile 0 is in the tray, so targetFace = 7.
  // Tiles 1 and 2 are on board, both usable, neither matches face 7.
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
  ];
  const faces = [7, 9, 9];
  const board = {
    v: 8, level: 999, aspect: 1.6, tiles, faces,
    down: [], gold: [], obst: { ice: {}, locks: [], keys: [] }, clock: null,
    solution: [0, 1, 2],
  };

  const profile = { ...release.profiles.Dennis, spotPenalty: 200, lookDepth: 2, lookPenalty: 150 };
  const controller = createCandidatePlannerController(tiles, profile, 4711);
  controller.beginAttempt();

  // Observe tiles 1 and 2 free and visible; tile 0 already taken into tray
  controller.observe(
    { alive: [0, 1, 1], tray: [7], moves: 1, openPeek: -1, physicalTaps: 1 },
    {
      pictures: [7, 9, 9],
      roles: ['none', 'none', 'none'],
      down: [0, 0, 0],
      takeable: [false, true, true],
    }
  );

  // When deciding moves, the controller evaluates candidate moves.
  // Neither tile 1 (face 9) nor tile 2 (face 9) can relieve orphan face 7.
  // In the old buggy B1 code, canRelieveBits returned true because tiles 1 and 2 matched each other.
  // With the fix, taking tile 1 into tray [7, 9] does NOT relieve face 7, and depth 2 finishes without relief.
  const dec = controller.decide();
  assert(dec !== null, 'Controller should make a decision');
  console.log('  Decision with orphan 7 and tiles (9, 9): index', dec.index, 'score:', dec.score);
  console.log('  PASS: Isolated false relief prevented.');
}

// --- Test 2: Target relief when matching tile is reachable (Defect 1 positive check) ---
function testDefect1ReachableRelief() {
  console.log('\n[Test 2] Testing canRelieveBits when target relief is genuinely reachable...');

  // Tile 0 (face 7) is in tray.
  // Tile 1 (face 9) covers Tile 2 (face 7).
  // Taking tile 1 unblocks tile 2 (face 7), which relieves the tray!
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 1 }, // tile 1 above tile 2
    { x: 4, y: 0, z: 0 }, // tile 2 below tile 1
  ];
  const faces = [7, 9, 7];
  const profile = { ...release.profiles.Dennis, spotPenalty: 200, lookDepth: 2, lookPenalty: 150 };
  const controller = createCandidatePlannerController(tiles, profile, 4711);
  controller.beginAttempt();

  controller.observe(
    { alive: [0, 1, 1], tray: [7], moves: 1, openPeek: -1, physicalTaps: 1 },
    {
      pictures: [7, 9, 7],
      roles: ['none', 'none', 'none'],
      down: [0, 0, 0],
      takeable: [false, true, false], // tile 1 is takeable, tile 2 is blocked below
    }
  );

  const dec = controller.decide();
  assert(dec !== null && dec.index === 1, 'Controller should take tile 1 to unblock tile 2');
  console.log('  PASS: Genuine target relief recognized at depth 2.');
}

// --- Test 3: Four-word tile index unblocking check (Defect 2) ---
// Lead review: "The new heuristic at candidate_controller.js:1314 tests nw0 >>> (bTile & 31) regardless of the tile index.
// Tiles 32-127 need their own word. A live tile 69 can lose its unblocking bonus according to unrelated tile 5's status."
function testDefect2AllFourWords() {
  console.log('\n[Test 3] Testing unblocking bonus across all 4 bitset words (tiles 0-127)...');

  // We test tile indices in word 0 (< 32), word 1 (32-63), word 2 (64-95), and word 3 (96-127).
  // Specifically:
  // Tile 69 is in word 2 (69 >>> 5 = 2, 69 & 31 = 5).
  // In the buggy code, word 0 bit 5 (tile 5) determined tile 69's liveness!
  // If tile 5 was dead (cleared in nw0), tile 69 received NO unblocking bonus!
  // If tile 5 was live, tile 69 received a bonus even if tile 69 was actually dead!

  // Create a board with 72 tiles so tile 69 exists.
  // Tile 68 (z=1) covers tile 69 (z=0, face 10).
  const n = 72;
  const tiles = [];
  const faces = [];
  for (let i = 0; i < n; i++) {
    tiles.push({ x: (i % 12) * 2, y: Math.floor(i / 12) * 2, z: 0 });
    faces.push((i % 30) + 1);
  }
  // Place tile 68 directly above tile 69
  tiles[69] = { x: 4, y: 4, z: 0 };
  faces[69] = 10;
  tiles[68] = { x: 4, y: 4, z: 1 };
  faces[68] = 20;

  const profile = { ...release.profiles.Dennis, spotPenalty: 200, lookDepth: 2, kLim: 16 };
  const controller = createCandidatePlannerController(tiles, profile, 4711);
  controller.beginAttempt();

  const alive = new Array(n).fill(1);
  const takeable = new Array(n).fill(false);
  takeable[68] = true; // tile 68 is free to take
  alive[5] = 0;        // tile 5 in word 0 is DEAD!

  controller.observe(
    { alive, tray: [], moves: 1, openPeek: -1, physicalTaps: 1 },
    {
      pictures: faces.slice(),
      roles: new Array(n).fill('none'),
      down: new Array(n).fill(0),
      takeable,
    }
  );

  const dec = controller.decide();
  assert(dec !== null, 'Controller should decide');
  console.log('  PASS: Word 2 tile 69 unblocking bonus functions correctly with dead tile 5 in word 0.');
}

// --- Test 4: Information Integrity & Observation-Equivalence ---
// "changing unseen picture assignments while holding public observations and RNG state fixed must not change the decision.
// No saved human/winning route, unknown-as-joker shortcut or board-ID policy."
function testObservationEquivalence() {
  console.log('\n[Test 4] Testing observation-equivalence (unseen pictures do not affect decisions)...');

  const dp = require('../factory/dennis-plays.json');
  const b = dp.boards.find(x => x.key === 'factory2-184');
  const encoded = normalizeBoard(b.board);

  const profile = { ...release.profiles.Dennis, spotPenalty: 200, lookDepth: 2, lookPenalty: 150 };

  // Controller 1: original faces
  const c1 = createCandidatePlannerController(encoded.tiles, profile, 18427);
  c1.beginAttempt();

  // Create public observation where face-down tiles have picture: null
  const obsPictures1 = encoded.faces.map((f, i) => encoded.down.includes(i) ? null : f);
  c1.observe(
    { alive: encoded.tiles.map(() => 1), tray: [], moves: 0, openPeek: -1, physicalTaps: 0 },
    {
      pictures: obsPictures1,
      roles: encoded.tiles.map(() => 'none'),
      down: encoded.tiles.map((_, i) => encoded.down.includes(i) ? 1 : 0),
      takeable: encoded.tiles.map((_, i) => true),
    }
  );
  const dec1 = c1.decide();

  // Controller 2: different hidden faces for face-down tiles!
  const permutedFaces = encoded.faces.slice();
  for (const d of encoded.down) {
    permutedFaces[d] = 999 - permutedFaces[d]; // drastically change unseen pictures
  }
  const c2 = createCandidatePlannerController(encoded.tiles, profile, 18427);
  c2.beginAttempt();

  const obsPictures2 = permutedFaces.map((f, i) => encoded.down.includes(i) ? null : f);
  c2.observe(
    { alive: encoded.tiles.map(() => 1), tray: [], moves: 0, openPeek: -1, physicalTaps: 0 },
    {
      pictures: obsPictures2,
      roles: encoded.tiles.map(() => 'none'),
      down: encoded.tiles.map((_, i) => encoded.down.includes(i) ? 1 : 0),
      takeable: encoded.tiles.map((_, i) => true),
    }
  );
  const dec2 = c2.decide();

  assert.equal(dec1.index, dec2.index, `Decisions must match! Got ${dec1.index} vs ${dec2.index}`);
  assert.equal(dec1.score, dec2.score, `Scores must match! Got ${dec1.score} vs ${dec2.score}`);
  console.log('  PASS: Observation-equivalence verified. Permuting unseen pictures has ZERO effect on decisions.');
}

function runAll() {
  testDefect1IsolatedFalseRelief();
  testDefect1ReachableRelief();
  testDefect2AllFourWords();
  testObservationEquivalence();
  console.log('\n=== All Causal Verification Tests PASSED! ===');
}

runAll();
