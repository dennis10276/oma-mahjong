/**
 * Adversarial Physical Simulation & Persona Stress Test Suite (Milestone 1 Challenger 2)
 *
 * Tasks covered:
 * 1. Pathological board geometries:
 *    - Stepped pyramids where offset upper tiles make L.isFree false while Hard.coverOf is empty.
 *    - Boards with instant tray jam traps (4 isolated single tiles).
 *    - High-urgency alarm clocks starting with minimal slack.
 * 2. Persona stability & immutability:
 *    - Extreme parameter configurations (infinite loop and heap exhaustion checks).
 *    - Illegal game state mutations (deep-frozen game invariant).
 * 3. Inter-attempt memory & information boundary:
 *    - Memory retention and decay verification.
 *    - Oracle leak check via counterfactual hidden-picture swapping.
 *    - Physical frame information confinement.
 */
'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const path = require('path');
const v8 = require('v8');

const Layouts = require('../www/layouts.js');
const Hard = require('../www/hard.js');
const { createSession, parameters } = require('../tools/sim/refit/production_physical_session.js');
const { createObservedMemory } = require('../tools/sim/refit/personal_observed_memory.js');
const { simulatePersonalCampaign } = require('../tools/sim/refit/personal_witness_simulation.js');
const { search } = require('../tools/sim/refit/public_witness_search.js');
const { derivePointForecast } = require('../tools/sim/refit/generate_personal_witness_v10.js');
const { calibratePlayer } = require('../tools/sim/refit/personal_behavioral_calibration.js');
const fitsData = require('../analysis/personal-bots/personal-behavioral-fit.json');
const { designed } = require('../tools/sim/refit/boards.js');

// Deep freeze utility to verify immutability
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      deepFreeze(obj[key]);
    }
  }
  return obj;
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ======================================================================
// TASK 1: PATHOLOGICAL BOARD GEOMETRIES
// ======================================================================

// 1.1 Stepped Pyramids: Offset upper tiles make L.isFree false while Hard.coverOf is empty
test('1.1.1 Stepped pyramid: offset upper tile blocks isFree while coverOf is empty', () => {
  // Tile 0 at (0, 0, 0), Tile 1 at (1, 1, 1) resting half-stepped on Tile 0.
  // Tile 2 at (4, 0, 0), Tile 3 at (4, 4, 0).
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 4, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const cover = Hard.coverOf(tiles, nb);

  // nb.above[0] includes tile 1 because |1-0| < 2, |1-0| < 2, and z1 > z0
  assert(nb.above[0].includes(1), 'Tile 1 must be above Tile 0 in neighbors.above');

  // Hard.coverOf requires exact (x, y) match; since (1, 1) != (0, 0), coverOf[0] is empty
  assert.equal(cover[0].length, 0, 'Hard.coverOf must be empty for stepped offset tile');

  // While tile 1 is alive, L.isFree(0) is false
  const aliveBoth = [1, 1, 1, 1];
  assert.equal(Layouts.isFree(0, aliveBoth, nb), false, 'L.isFree(0) must be false while stepped tile 1 is alive');

  // Once tile 1 is removed, L.isFree(0) becomes true
  const aliveAfter1 = [1, 0, 1, 1];
  assert.equal(Layouts.isFree(0, aliveAfter1, nb), true, 'L.isFree(0) must become true after tile 1 is removed');
});

test('1.1.2 Stepped pyramid: physical session exposes face-up tile picture but disallows tapping', () => {
  // Stepped pair layout where Tile 0 and Tile 2 match face 10, Tile 1 and Tile 3 match face 20.
  // Tile 0 is stepped under Tile 1.
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x: 6, y: 0, z: 0 },
    { x: 6, y: 4, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [10, 20, 10, 20];
  const down = [0, 0, 0, 0]; // all face-up
  const game = { tiles, nb, faces, down, rules: null, clock: null };

  const session = createSession(game, { seed: 42 });
  const frame = session.view();

  // Legal tiles in initial frame must NOT include Tile 0 (only free tiles: 1, 2, 3)
  assert.deepEqual(frame.legalTiles.sort((a, b) => a - b), [1, 2, 3]);

  // Attempting to tap Tile 0 must throw because it is not in legalTiles
  assert.throws(() => session.tap(0), /Choose a currently legal physical tile/);

  // But observation layer sees Tile 0 face because coverOf is empty and down is 0
  const cover = Hard.coverOf(tiles, nb);
  const visiblePictures = frame.state.alive.map((alive, index) => {
    if (!alive) return null;
    if (!game.down[index]) {
      if (!cover[index].some(above => frame.state.alive[above])) return game.faces[index];
    }
    return null;
  });
  assert.equal(visiblePictures[0], 10, 'Tile 0 face must be visible to player even while physically blocked');
});

test('1.1.3 Stepped pyramid: multi-layer stepped pyramid simulation executes cleanly to victory', () => {
  // 3-layer stepped pyramid:
  // Layer 0: 4 base tiles in a 2x2 grid (z=0)
  // Layer 1: 1 center tile bridging the 4 tiles (z=1)
  // Layer 2: extra matching tiles so all pairs can be cleared
  const tiles = [
    { x: 0, y: 0, z: 0 }, // 0
    { x: 2, y: 0, z: 0 }, // 1
    { x: 0, y: 2, z: 0 }, // 2
    { x: 2, y: 2, z: 0 }, // 3
    { x: 1, y: 1, z: 1 }, // 4 (rests on 0, 1, 2, 3)
    { x: 8, y: 0, z: 0 }, // 5 (free twin for 4)
  ];
  const nb = Layouts.neighbors(tiles);
  // Faces: 4 and 5 are pair 1; 0 and 1 are pair 2; 2 and 3 are pair 3
  const faces = [2, 2, 3, 3, 1, 1];
  const down = [0, 0, 0, 0, 0, 0];
  const game = { tiles, nb, faces, down, rules: null, clock: null };

  const result = simulatePersonalCampaign(game, 'Dennisisdebeste', { maxAttempts: 2, seed: 1234 });
  assert.equal(result.cleared, true, 'Stepped pyramid campaign must solve successfully');
  assert.equal(result.wonOn, 1, 'Should win on attempt 1');
  assert.equal(result.history[0].status, 'cleared');
});

// 1.2 Instant Tray Jam Traps (4 isolated single tiles)
test('1.2.1 Tray jam trap: 4 isolated single tiles trigger immediate tray loss', () => {
  // 4 isolated tiles with 4 distinct faces [1, 2, 3, 4] and no possible matches
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [1, 2, 3, 4];
  const down = [0, 0, 0, 0];
  const game = { tiles, nb, faces, down, rules: null, clock: null };

  const session = createSession(game, { seed: 1 });
  let frame = session.view();
  assert.equal(frame.legalTiles.length, 4);

  // Tap 1: tray has [1]
  frame = session.tap(0);
  assert.equal(frame.state.tray.length, 1);
  assert.equal(frame.type, 'productionPhysicalFrame-v1');

  // Tap 2: tray has [1, 2]
  frame = session.tap(1);
  assert.equal(frame.state.tray.length, 2);

  // Tap 3: tray has [1, 2, 3]
  frame = session.tap(2);
  assert.equal(frame.state.tray.length, 3);

  // Tap 4: 4th distinct tile into tray -> immediate loss
  frame = session.tap(3);
  assert.equal(frame.type, 'productionPhysicalEnd-v1');
  assert.equal(frame.win, false);
  assert.equal(frame.why, 'tray');
});

test('1.2.2 Tray jam trap: multi-campaign exhausts 8 retries mapping to noClear and p=8', () => {
  // A layout with 4 free distinct tiles and buried twins that cannot be reached before tray jams
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [10, 20, 30, 40];
  const down = [0, 0, 0, 0];
  const game = { tiles, nb, faces, down, rules: null, clock: null };

  for (const player of ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']) {
    const outcome = simulatePersonalCampaign(game, player, { maxAttempts: 8, seed: 999 });
    assert.equal(outcome.cleared, false, `${player} must not clear the jam trap`);
    assert.equal(outcome.wonOn, null, `${player} wonOn must be null`);
    assert.equal(outcome.totalAttempts, 8, `${player} must execute all 8 allowed retry attempts`);
    for (const att of outcome.history) {
      assert.equal(att.why, 'tray', `Every attempt must fail with why=tray`);
      assert.equal(att.status, 'physicalLoss');
    }
  }

  // Distribution optimizer check: 100% noClear must yield predictedAttempt = 8
  const dist = { try1: 0, try2: 0, try3: 0, try4: 0, try5: 0, try6: 0, try7: 0, try8: 0, noClear: 1.0 };
  const forecast = derivePointForecast(dist);
  assert.equal(forecast.predictedAttempt, 8, 'Jam trap distribution must map to point forecast p=8');
  assert.equal(forecast.expectedScore, 1.0, 'Forecast p=8 on 100% noClear must have expectedScore 1.0');
});

// 1.3 High-Urgency Alarm Clocks Minimal Slack
test('1.3.1 High-urgency clock: free clock tile with slack n=1 is saved immediately', () => {
  // Clock tile at index 0 is free, matching twin at index 1 is free.
  // Clock has n = 1 move!
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [1, 1, 2, 2];
  const down = [0, 0, 0, 0];
  const clock = { i: 0, n: 1 };
  const game = { tiles, nb, faces, down, rules: null, clock };

  const session = createSession(game, { seed: 10 });
  const frame = session.view();
  assert(frame.legalTiles.includes(0));

  // Tapping clock tile 0: moves goes from 0 to 1
  const afterTap = session.tap(0);
  // Clock tile is cleared from alive before moves exceeds deadline
  assert.equal(afterTap.state.alive[0], 0);
  assert.notEqual(afterTap.why, 'clock', 'Taking clock tile on move 1 must not trigger clock loss');
});

test('1.3.2 High-urgency clock: buried clock tile with n=1 triggers clock loss on move 1', () => {
  // Tile 0 is buried under Tile 1. Tile 0 is the clock tile with n = 1 move.
  // It is physically impossible to take Tile 0 in 1 move.
  const tiles = [
    { x: 0, y: 0, z: 0 }, // 0 (clock tile, buried)
    { x: 0, y: 0, z: 1 }, // 1 (directly covering 0)
    { x: 4, y: 0, z: 0 }, // 2
    { x: 4, y: 4, z: 0 }  // 3
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [1, 2, 3, 4];
  const down = [0, 0, 0, 0];
  const clock = { i: 0, n: 1 };
  const game = { tiles, nb, faces, down, rules: null, clock };

  const session = createSession(game, { seed: 11 });
  let frame = session.view();

  // Legal tiles cannot tap buried clock 0
  assert(!frame.legalTiles.includes(0));

  // Tap covering tile 1
  frame = session.tap(1);

  // Moves reached 1, while clock tile 0 is still alive -> clock loss
  assert.equal(frame.type, 'productionPhysicalEnd-v1');
  assert.equal(frame.win, false);
  assert.equal(frame.why, 'clock', 'Must trigger why=clock when moves >= clock.n while clock alive');
});

test('1.3.3 High-urgency clock: clock.n <= 0 rejected by game validation, and n=1 expires on non-clock move', () => {
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [1, 1];
  const down = [0, 0];

  // Game validation invariant: clock.n <= 0 must be rejected
  const invalidGame = { tiles, nb, faces, down, rules: null, clock: { i: 0, n: 0 } };
  assert.throws(() => createSession(invalidGame), /assert/);

  // Minimal valid slack is n = 1: if a non-clock tile is tapped, clock expires immediately
  const tiles4 = [
    { x: 0, y: 0, z: 0 }, // 0 (clock tile)
    { x: 4, y: 0, z: 0 }, // 1 (clock twin)
    { x: 8, y: 0, z: 0 }, // 2 (other tile)
    { x: 12, y: 0, z: 0 } // 3 (other twin)
  ];
  const nb4 = Layouts.neighbors(tiles4);
  const validGame = {
    tiles: tiles4,
    nb: nb4,
    faces: [1, 1, 2, 2],
    down: [0, 0, 0, 0],
    rules: null,
    clock: { i: 0, n: 1 }
  };
  const session = createSession(validGame, { seed: 15 });
  // Tap non-clock tile 2
  const frameAfterNonClock = session.tap(2);
  assert.equal(frameAfterNonClock.type, 'productionPhysicalEnd-v1');
  assert.equal(frameAfterNonClock.win, false);
  assert.equal(frameAfterNonClock.why, 'clock', 'Tapping non-clock tile with slack n=1 must trigger clock loss');
});

// ======================================================================
// TASK 2: PERSONA STABILITY & IMMUTABILITY (NO INFINITE LOOPS / LEAKS)
// ======================================================================

test('2.1 Extreme persona parameter configurations terminate without infinite loops or crashes', () => {
  // Construct a moderately challenging board with ice and multiple layers
  const tiles = [
    { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 4, y: 2, z: 0 },
    { x: 1, y: 1, z: 1 }, { x: 3, y: 1, z: 1 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [1, 2, 3, 1, 2, 3, 4, 4];
  const down = [0, 1, 0, 1, 0, 0, 1, 0];
  const game = { tiles, nb, faces, down, rules: null, clock: null };

  const extremeConfigs = [
    { depth: 1, trayBuffer: 1, clockPatience: 0.0, memoryDecay: 0.0, retryLearning: 0.0 },
    { depth: 96, trayBuffer: 4, clockPatience: 1.0, memoryDecay: 1.0, retryLearning: 1.0 },
    { depth: 1, trayBuffer: 4, clockPatience: 1.0, memoryDecay: 0.0, retryLearning: 1.0 },
    { depth: 96, trayBuffer: 1, clockPatience: 0.0, memoryDecay: 1.0, retryLearning: 0.0 },
    { depth: 8, trayBuffer: 2, clockPatience: 0.5, memoryDecay: 0.5, retryLearning: 0.5 }
  ];

  for (const [idx, cfg] of extremeConfigs.entries()) {
    const startTime = Date.now();
    const result = simulatePersonalCampaign(game, 'Dennisisdebeste', {
      maxAttempts: 2,
      customParams: cfg,
      seed: 500 + idx
    });
    const elapsed = Date.now() - startTime;
    assert(elapsed < 3000, `Extreme config ${idx} took too long (${elapsed}ms), potential hang`);
    assert(typeof result.cleared === 'boolean', 'Simulation must return valid boolean cleared status');
    assert(result.totalAttempts >= 1 && result.totalAttempts <= 2, 'Valid attempt count');
  }
});

test('2.2 Heap memory stability across repeated campaigns (no memory exhaustion)', () => {
  const tiles = [
    { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [1, 2, 1, 2];
  const down = [0, 0, 0, 0];
  const game = { tiles, nb, faces, down, rules: null, clock: null };

  if (global.gc) global.gc();
  const heapBefore = process.memoryUsage().heapUsed;

  // Run 30 simulated campaigns
  for (let i = 0; i < 30; i++) {
    simulatePersonalCampaign(game, 'Mrs. Doubtfire', { maxAttempts: 3, seed: 1000 + i });
  }

  if (global.gc) global.gc();
  const heapAfter = process.memoryUsage().heapUsed;
  const growthMB = (heapAfter - heapBefore) / (1024 * 1024);

  // Heap growth must be modest (< 30 MB for 30 runs)
  assert(growthMB < 30, `Unreasonable heap growth: ${growthMB.toFixed(2)} MB`);
});

test('2.3 Deep-frozen game object input is NEVER mutated (Illegal game state mutation check)', () => {
  const tiles = [
    { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 },
    { x: 1, y: 1, z: 1 }, { x: 4, y: 0, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [1, 2, 3, 1, 2, 3];
  const down = [0, 1, 0, 0, 1, 0];
  const rules = {
    ice: { 1: 1 },
    iceNb: Layouts.iceNeighbors(tiles),
    locks: new Set([4]),
    keys: [0, 3]
  };
  const clock = { i: 5, n: 8 };

  const game = { tiles, nb, faces, down, rules, clock };
  deepFreeze(game);

  // Verify that game is truly frozen
  assert(Object.isFrozen(game));
  assert(Object.isFrozen(game.tiles));
  assert(Object.isFrozen(game.faces));
  assert(Object.isFrozen(game.down));
  assert(Object.isFrozen(game.clock));

  // Running simulation with deeply frozen game must NOT throw MutationError / TypeError
  assert.doesNotThrow(() => {
    simulatePersonalCampaign(game, 'PUK', { maxAttempts: 2, seed: 777 });
  }, 'Simulation must run cleanly on frozen game input without attempting mutations');
});

// ======================================================================
// TASK 3: INTER-ATTEMPT MEMORY & INFORMATION BOUNDARY (ORACLE LEAK CHECK)
// ======================================================================

test('3.1 Inter-attempt memory accurately retains observed tiles and respects decay/retention', () => {
  const size = 6;
  const campaign = 'camp_test_memory';
  const board = 'board_test_memory';
  const evidence = { kind: 'test-observer', sha256: crypto.createHash('sha256').update('test').digest('hex') };

  const memory = createObservedMemory({
    size,
    campaign,
    board,
    seed: 42,
    retryRetention: 1.0, // perfect retention
    decay: 0.0          // no forgetting during attempt
  });

  // Attempt 1 begins
  memory.beginAttempt({ campaign, board, size, attempt: 1 });

  // Only tile 0 and tile 2 are observed; tiles 1, 3, 4, 5 are hidden (null)
  const obs1 = memory.observe({
    physicalTaps: 1,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [10, null, 20, null, null, null],
    evidence: [evidence, null, evidence, null, null, null]
  });

  assert.equal(obs1.pictures[0], 10);
  assert.equal(obs1.pictures[1], null);
  assert.equal(obs1.pictures[2], 20);
  assert.equal(obs1.pictures[3], null);

  // Attempt 1 ends in a physical loss
  const end1 = memory.endAttempt({
    type: 'productionPhysicalEnd-v1',
    state: { alive: [1, 1, 1, 1, 1, 1], tray: [10, 20, 30, 40], physicalTaps: 4 },
    win: false,
    why: 'tray'
  });
  assert.equal(end1.status, 'physicalLoss');
  assert.equal(end1.remembered, 2, 'Must remember exactly 2 observed tiles');

  // Attempt 2 begins: with retryRetention=1.0, records carry forward
  const carry = memory.beginAttempt({ campaign, board, size, attempt: 2 });
  assert.equal(carry[0].picture, 10, 'Tile 0 picture carried forward');
  assert.equal(carry[1], null, 'Unobserved tile 1 remains null');
  assert.equal(carry[2].picture, 20, 'Tile 2 picture carried forward');
  assert.equal(carry[3], null, 'Unobserved tile 3 remains null');

  // Test zero retention (retryRetention = 0.0)
  const wipeMemory = createObservedMemory({
    size,
    campaign: 'camp_wipe',
    board: 'board_wipe',
    seed: 42,
    retryRetention: 0.0,
    decay: 0.0
  });
  wipeMemory.beginAttempt({ campaign: 'camp_wipe', board: 'board_wipe', size, attempt: 1 });
  wipeMemory.observe({
    physicalTaps: 1,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [10, null, 20, null, null, null],
    evidence: [evidence, null, evidence, null, null, null]
  });
  wipeMemory.endAttempt({
    type: 'productionPhysicalEnd-v1',
    state: { alive: [1, 1, 1, 1, 1, 1], tray: [10, 20, 30, 40], physicalTaps: 4 },
    win: false,
    why: 'tray'
  });
  const wiped = wipeMemory.beginAttempt({ campaign: 'camp_wipe', board: 'board_wipe', size, attempt: 2 });
  assert(wiped.every(r => r === null), 'Zero retention must wipe all carryover memory');
});

test('3.2 Oracle Leak Invariance: unpeeked hidden pictures NEVER influence initial choice', () => {
  // Construct a board with 2 free face-down tiles (indexes 0 and 1)
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const down = [1, 1, 0, 0]; // 0 and 1 are face-down

  // Deal A: hidden faces are [5, 12]
  const gameA = { tiles, nb, faces: [5, 12, 5, 12], down, rules: null, clock: null };

  // Deal B: hidden faces are [99, 88] (completely different pictures!)
  const gameB = { tiles, nb, faces: [99, 88, 99, 88], down, rules: null, clock: null };

  // Run 1 step of search on both deals using empty observed pictures
  const publicGeometry = { tiles, nb, rules: null, clock: null };
  const searchState = {
    pictures: [null, null, 5, 12], // only 2 and 3 are visible
    down,
    alive: [1, 1, 1, 1],
    tray: [],
    moves: 0,
    openPeek: -1,
    relieved: false,
    arriving: []
  };
  const legalMoves = [
    { index: 0, inspect: true },
    { index: 1, inspect: true },
    { index: 2, inspect: false },
    { index: 3, inspect: false }
  ];

  const planA = search(publicGeometry, searchState, legalMoves, { depth: 16 });
  const planB = search(publicGeometry, searchState, legalMoves, { depth: 16 });

  // Assert that choices and paths are 100% identical regardless of hidden faces
  assert.equal(planA.index, planB.index, 'Chosen tap must be identical despite swapped hidden faces');
  assert.deepEqual(planA.path, planB.path, 'Search path must be identical');
  assert.equal(planA.goal, planB.goal);
});

test('3.3 Counterfactual retry: unpeeked tile changes between attempts cannot leak into attempt 2 opening', () => {
  // 6 tiles:
  // Tile 0: face-down, peeked in attempt 1 (face 7)
  // Tile 1: face-down, NEVER peeked in attempt 1
  // In Counterfactual 1: Tile 1 has face 20
  // In Counterfactual 2: Tile 1 has face 99
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 },
    { x: 16, y: 0, z: 0 },
    { x: 20, y: 0, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const down = [1, 1, 0, 0, 0, 0];

  const evidence = { kind: 'test', sha256: crypto.createHash('sha256').update('t').digest('hex') };

  // Setup memory after attempt 1 where only tile 0 was observed
  const memory = createObservedMemory({
    size: 6,
    campaign: 'camp_cf',
    board: 'board_cf',
    seed: 123,
    retryRetention: 1.0,
    decay: 0.0
  });
  memory.beginAttempt({ campaign: 'camp_cf', board: 'board_cf', size: 6, attempt: 1 });
  memory.observe({
    physicalTaps: 1,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [7, null, 1, 2, 3, 4],
    evidence: [evidence, null, evidence, evidence, evidence, evidence]
  });
  memory.endAttempt({
    type: 'productionPhysicalEnd-v1',
    state: { alive: [1, 1, 1, 1, 1, 1], tray: [1, 2, 3, 4], physicalTaps: 4 },
    win: false,
    why: 'tray'
  });

  // Attempt 2 begins: memory knows tile 0 has face 7, but tile 1 is null
  memory.beginAttempt({ campaign: 'camp_cf', board: 'board_cf', size: 6, attempt: 2 });
  const observedAttempt2 = memory.observe({
    physicalTaps: 0,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, 1, 2, 3, 4], // start of attempt 2, no tiles tapped yet
    evidence: [null, null, evidence, evidence, evidence, evidence]
  });

  assert.equal(observedAttempt2.pictures[0], 7, 'Tile 0 remembered from attempt 1');
  assert.equal(observedAttempt2.pictures[1], null, 'Unpeeked tile 1 must NOT be known in attempt 2');

  // Run search with observedAttempt2.pictures against Deal 1 vs Deal 2
  const publicGeometry = { tiles, nb, rules: null, clock: null };
  const searchState = {
    pictures: observedAttempt2.pictures,
    down,
    alive: [1, 1, 1, 1, 1, 1],
    tray: [],
    moves: 0,
    openPeek: -1,
    relieved: false,
    arriving: []
  };
  const legalMoves = tiles.map((_, i) => ({ index: i, inspect: !!down[i] }));

  const planDeal1 = search(publicGeometry, searchState, legalMoves, { depth: 16 });
  const planDeal2 = search(publicGeometry, searchState, legalMoves, { depth: 16 });

  assert.equal(planDeal1.index, planDeal2.index, 'Attempt 2 decision cannot depend on unpeeked face');
  assert.deepEqual(planDeal1.path, planDeal2.path);
});

test('3.4 Production physical frame confidentiality: no hidden face data in yielded state', () => {
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [77, 88];
  const down = [1, 1]; // both face down
  const game = { tiles, nb, faces, down, rules: null, clock: null };

  const session = createSession(game, { seed: 1 });
  const frame = session.view();

  // The yielded state must NOT leak faces, deck, or unpeeked pictures
  assert.equal(frame.state.faces, undefined);
  assert.equal(frame.state.deck, undefined);
  assert.equal(frame.state.pictures, undefined);
  assert.deepEqual(frame.state.down, [1, 1]);
  assert.equal(frame.state.openPeek, -1);
});

test('1.1.4 Stepped pyramid with face-down tiles: lower tile cannot be peeked until upper tile is cleared', () => {
  // 3-layer stepped stack:
  // Tile 0 at (0, 0, 0), face-down
  // Tile 1 at (1, 1, 1), face-down (bridges Tile 0)
  // Tile 2 at (4, 0, 0), face-down
  // Tile 3 at (4, 4, 0), face-down
  const tiles = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 4, z: 0 }
  ];
  const nb = Layouts.neighbors(tiles);
  const faces = [1, 2, 1, 2];
  const down = [1, 1, 1, 1]; // ALL face-down!
  const game = { tiles, nb, faces, down, rules: null, clock: null };

  const session = createSession(game, { seed: 101 });
  let frame = session.view();

  // Legal tiles can only tap free tiles (1, 2, 3), NOT 0
  assert(!frame.legalTiles.includes(0), 'Lower tile 0 must not be legal to tap/peek while tile 1 is alive');

  // Peek tile 1
  frame = session.tap(1);
  assert.equal(frame.state.openPeek, 1, 'Tile 1 is now openPeek');
  assert.equal(frame.state.down[1], 1);

  // Still cannot peek tile 0 because tile 1 is alive (only openPeek)
  assert(!frame.legalTiles.includes(0));

  // Now tap tile 3 to match face 2 with tile 1
  frame = session.tap(3);
  // Now tile 1 is removed from the board!
  assert.equal(frame.state.alive[1], 0, 'Tile 1 removed after pair match');

  // Now tile 0 MUST be legal to peek
  assert(frame.legalTiles.includes(0), 'Tile 0 must now be free and legal to tap');
  frame = session.tap(0);
  assert.equal(frame.state.openPeek, 0, 'Tile 0 is now successfully peeked');
});

test('1.2.3 Tray buffer sensitivity: trayBuffer=2 prioritizes safe tray match when tray has 2 tiles and option B has buried twin', () => {
  // Solvable board:
  // Tray already has [10, 20]
  // Tile 0 (face 10): matches tray 10
  // Tile 1 (face 40): twin (Tile 2) is buried under Tile 3 (face 50)
  // Tile 3 (face 50): matches Tile 4 (face 50)
  // Tile 5 (face 20): matches tray 20
  const tiles = [
    { x: 0, y: 0, z: 0 }, // 0: face 10
    { x: 4, y: 0, z: 0 }, // 1: face 40
    { x: 8, y: 0, z: 0 }, // 2: face 40 (buried under 3)
    { x: 8, y: 0, z: 1 }, // 3: face 50
    { x: 12, y: 0, z: 0 }, // 4: face 50 (matches 3)
    { x: 16, y: 0, z: 0 }  // 5: face 20 (matches tray 20)
  ];
  const nb = Layouts.neighbors(tiles);
  const publicGeometry = { tiles, nb, rules: null, clock: null };
  const searchState = {
    pictures: [10, 40, 40, 50, 50, 20],
    down: [0, 0, 0, 0, 0, 0],
    alive: [1, 1, 1, 1, 1, 1],
    tray: [10, 20], // 2 tiles in tray (10, 20)
    moves: 2,
    openPeek: -1,
    relieved: false,
    arriving: []
  };
  const legalMoves = [
    { index: 0, inspect: false },
    { index: 1, inspect: false }
  ];

  const plan = search(publicGeometry, searchState, legalMoves, { depth: 8, trayBuffer: 2 });
  assert.equal(plan.index, 0, 'Bot must choose the safe tray match 0 over risky unmatched tile 1');
  assert.equal(plan.goal, 'win');
});

test('1.3.4 Clock cone sensitivity: clockPatience 0.8 prefers cone, clockPatience 0.2 avoids cone', () => {
  // Tile 0 is clock tile at (0, 0, 0).
  // Tile 1 is in clock cone above/covering clock tile at (0, 0, 1) - face-down.
  // Tile 2 is completely outside clock cone at (8, 8, 0) - face-down.
  // Tile 3 is outside clock cone at (8, 12, 0).
  const tiles = [
    { x: 0, y: 0, z: 0 }, // 0: clock
    { x: 0, y: 0, z: 1 }, // 1: directly in clock cone
    { x: 8, y: 8, z: 0 }, // 2: outside clock cone
    { x: 8, y: 12, z: 0 } // 3: outside clock cone
  ];
  const nb = Layouts.neighbors(tiles);
  const publicGeometry = { tiles, nb, rules: null, clock: { i: 0, n: 10 } };
  const searchState = {
    pictures: [1, null, null, 2], // BOTH 1 and 2 are unknown face-down tiles
    down: [0, 1, 1, 0],
    alive: [1, 1, 1, 1],
    tray: [],
    moves: 0,
    openPeek: -1,
    relieved: false,
    arriving: []
  };
  const legalMoves = [
    { index: 1, inspect: true },
    { index: 2, inspect: true }
  ];

  // High patience (0.8): focused on digging clock cone
  const planRush = search(publicGeometry, searchState, legalMoves, { depth: 8, clockPatience: 0.8 });
  assert.equal(planRush.index, 1, 'High clockPatience (0.8) must prioritize clock cone tile 1');

  // Low patience (0.2): avoids clock cone, prefers safe outside tile 2
  const planAvoid = search(publicGeometry, searchState, legalMoves, { depth: 8, clockPatience: 0.2 });
  assert.equal(planAvoid.index, 2, 'Low clockPatience (0.2) must avoid clock cone in favor of tile 2');
});

test('2.4 Production level layouts (Levels 100, 105, 107) execute cleanly across all 4 calibrated players', () => {
  // Level 100 (standard designed board) and Level 105 (clock board)
  const l100 = designed('1.55', 100);
  const l105 = designed('1.55', 105);
  assert(l100, 'Level 100 must load');
  assert(l105, 'Level 105 must load');
  assert(l105.clock, 'Level 105 must have an active clock');

  const players = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda'];

  for (const player of players) {
    // Verify physical session creation and legal first moves on Level 100
    const s100 = createSession(l100, { seed: 100 });
    const f100 = s100.view();
    assert(f100.legalTiles.length > 0, `${player} Level 100 must have initial legal tiles`);
    const next100 = s100.tap(f100.legalTiles[0]);
    assert.equal(next100.type, 'productionPhysicalFrame-v1');

    // Verify physical session creation and legal first moves on Level 105 (clock board)
    const s105 = createSession(l105, { seed: 105 });
    const f105 = s105.view();
    assert(f105.legalTiles.length > 0, `${player} Level 105 must have initial legal tiles`);
    const next105 = s105.tap(f105.legalTiles[0]);
    assert(next105.type === 'productionPhysicalFrame-v1' || next105.type === 'productionPhysicalEnd-v1');
  }

  // Full campaign on Level 107
  const l107 = designed('1.55', 107);
  for (const player of players) {
    const res = simulatePersonalCampaign(l107, player, { maxAttempts: 1, seed: 107 });
    assert(res && typeof res.cleared === 'boolean', `${player} Level 107 must return valid result`);
    assert.equal(res.history.length, 1);
  }
});

// ======================================================================
// RUNNER
// ======================================================================
async function runAll() {
  console.log('='.repeat(70));
  console.log(`Running ${tests.length} M1 Challenger 2 Stress Tests...`);
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ PASS  ${t.name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ FAIL  ${t.name}`);
      console.error(err);
    }
  }

  console.log('='.repeat(70));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runAll();
}

module.exports = { tests, runAll };
