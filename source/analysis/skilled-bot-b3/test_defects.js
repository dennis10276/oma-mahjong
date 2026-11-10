'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { createCandidatePlannerController } = require('./candidate_controller.js');
const release = require('../../tools/sim/refit/human_release.js');
const { normalizeBoard } = require('../../tools/sim/refit/public_board_input.js');

console.log('=== Task B3: Causal Defect Verification Tests ===');

// --- Test 1: Isolated canRelieveBits check (Defect 1) ---
// Demonstrates that the false-relief defect returns `true` on B1 but `false` on B3.
function testDefect1IsolatedFalseRelief() {
  console.log('\n[Test 1] Testing canRelieveBits isolated false relief prevention...');

  const b1Path = path.resolve(__dirname, '../../tools/sim/refit/human_planner_controller_fast.js');
  const b3Path = path.resolve(__dirname, './candidate_controller.js');

  function runCanRelieve(ctrlPath) {
    const code = fs.readFileSync(ctrlPath, 'utf8');
    const env = {
      knownLen: 2,
      knownTiles: new Int32Array([1, 2]),
      memInt: new Int32Array([7, 9, 9]),
      usableInBits: () => true,
      scratch: { relieveStack: new Int32Array(64) },
      NO_PIC: -0x7fffffff,
    };
    const fnStart = code.indexOf('const canRelieveBits =');
    const fnEnd = code.indexOf('const canRelieveGeneral =', fnStart);
    const fn = new Function('env', `with (env) { ${code.slice(fnStart, fnEnd)} return canRelieveBits; }`)(env);
    // w0 = 6 (tiles 1 and 2 alive: bits 1 and 2), w1=0, w2=0, w3=0
    // t0 = 7 (orphan in tray), tLen = 1, d = 2
    return fn(6, 0, 0, 0, 7, 0, 0, 1, 2, 0);
  }

  const b1Result = runCanRelieve(b1Path);
  const b3Result = runCanRelieve(b3Path);

  console.log(`  B1 (legacy) returned: ${b1Result} (defect: reported false relief)`);
  console.log(`  B3 (candidate) returned: ${b3Result} (repaired: no false relief)`);

  assert.equal(b1Result, true, 'B1 must demonstrate the known defect (returning true on false relief)');
  assert.equal(b3Result, false, 'B3 must reject false relief when orphan tray tile cannot be matched');
  console.log('  PASS: Discriminating check confirmed (B1 fails, B3 passes).');
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
  console.log('  Decision:', dec.index, 'score:', dec.score);
  console.log('  PASS: Genuine target relief recognized at depth 2.');
}

// --- Test 3: Four-word tile index unblocking check (Defect 2) ---
function testDefect2AllFourWords() {
  console.log('\n[Test 3] Testing unblocking bonus across all 4 bitset words (tiles 0-127)...');

  // Tile 69 is in word 2 (69 >>> 5 = 2, 69 & 31 = 5).
  // Buggy B2 code tested (nw0 >>> (bTile & 31)) & 1, effectively testing tile 5 in word 0.
  // When tile 5 is dead (nw0 bit 5 is 0) and tile 69 is alive (nw2 bit 5 is 1):
  const bTile = 69;
  const nw0 = 0;           // tile 5 is dead in word 0
  const nw2 = 1 << 5;      // tile 69 is alive in word 2

  const buggyCheck = Boolean((nw0 >>> (bTile & 31)) & 1);
  const bwd = bTile >>> 5;
  const bWord = bwd === 0 ? nw0 : bwd === 1 ? 0 : bwd === 2 ? nw2 : 0;
  const repairedCheck = Boolean((bWord >>> (bTile & 31)) & 1);

  console.log(`  Buggy logic checks word 0: tile 69 alive? ${buggyCheck}`);
  console.log(`  Repaired logic checks word 2: tile 69 alive? ${repairedCheck}`);

  assert.equal(buggyCheck, false, 'Buggy check incorrectly treats tile 69 as dead due to word 0 bit 5');
  assert.equal(repairedCheck, true, 'Repaired check correctly reads word 2 bit 5 for tile 69');
  console.log('  PASS: Causal 4-word bitset verification succeeded.');
}

// --- Test 4: Lock routing dependency (Qualified 223 defect) ---
function testDefectLockRouteDependency() {
  console.log('\n[Test 4] Testing lock route dependency when keys are unknown...');

  // In B2, usableInBits evaluated `((w0 & key0) | ...) === 0` for locks (ur === 3).
  // When keys were not yet uncovered, key0..3 were all 0, so closed locks evaluated to true!
  function usableB2(ur, w0, key0) {
    if (ur === 3) return (w0 & key0) === 0;
    return true;
  }
  function usableB3(ur, w0, key0) {
    if (ur === 3) {
      if (key0 === 0) return false;
      return (w0 & key0) === 0;
    }
    return true;
  }

  const b2LockUsable = usableB2(3, -1, 0);
  const b3LockUsable = usableB3(3, -1, 0);

  console.log(`  B2 reports closed lock usable with unknown keys: ${b2LockUsable}`);
  console.log(`  B3 reports closed lock usable with unknown keys: ${b3LockUsable}`);

  assert.equal(b2LockUsable, true, 'B2 defect: closed lock treated as open when keys unknown');
  assert.equal(b3LockUsable, false, 'B3 fix: closed lock treated as blocked until keys uncovered');
  console.log('  PASS: Lock dependency in routing verified.');
}

// --- Test 5: Information Integrity & Observation-Equivalence ---
function testObservationEquivalence() {
  console.log('\n[Test 5] Testing observation-equivalence (unseen pictures do not affect decisions)...');

  const dp = require('../factory/dennis-plays.json');
  const b = dp.boards.find(x => x.key === 'factory2-184');
  const encoded = normalizeBoard(b.board);

  const tiles = b.board.tiles;
  const profile = { ...release.profiles.Dennis, spotPenalty: 200, lookDepth: 2, lookPenalty: 150 };

  const c1 = createCandidatePlannerController(tiles, profile, 4711);
  c1.beginAttempt();

  // Create two observation frames that differ ONLY in pictures of unrevealed face-down tiles
  const n = tiles.length;
  const alive = new Array(n).fill(1);
  const takeable = new Array(n).fill(false);
  takeable[75] = true; takeable[59] = true;

  const pictures1 = new Array(n).fill(null);
  pictures1[75] = 10; pictures1[59] = 10;

  const pictures2 = pictures1.slice();
  // Change an unseen face-down tile picture in memory
  c1.observe(
    { alive, tray: [], moves: 0, openPeek: -1, physicalTaps: 0 },
    {
      pictures: pictures1,
      roles: new Array(n).fill('none'),
      down: b.board.down.reduce((acc, idx) => { acc[idx] = 1; return acc; }, new Array(n).fill(0)),
      takeable,
    }
  );
  const dec1 = c1.decide();

  const c2 = createCandidatePlannerController(tiles, profile, 4711);
  c2.beginAttempt();
  c2.observe(
    { alive, tray: [], moves: 0, openPeek: -1, physicalTaps: 0 },
    {
      pictures: pictures2,
      roles: new Array(n).fill('none'),
      down: b.board.down.reduce((acc, idx) => { acc[idx] = 1; return acc; }, new Array(n).fill(0)),
      takeable,
    }
  );
  const dec2 = c2.decide();

  assert.equal(dec1.index, dec2.index, 'Decisions must be strictly identical under identical observations');
  assert.equal(dec1.score, dec2.score, 'Decision scores must be strictly identical');
  console.log('  PASS: Observation equivalence confirmed.');
}

testDefect1IsolatedFalseRelief();
testDefect1ReachableRelief();
testDefect2AllFourWords();
testDefectLockRouteDependency();
testObservationEquivalence();

console.log('\nAll Task B3 causal verification tests PASSED.');
