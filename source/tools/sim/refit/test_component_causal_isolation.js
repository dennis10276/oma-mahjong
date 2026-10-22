'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search } = require('./public_witness_search.js');
const { createObservedMemory } = require('./personal_observed_memory.js');

console.log('Testing component causal isolation: search planning vs observation decay vs retry memory carryover...');

// ============================================================================
// 1. SEARCH PLANNING CAUSAL ISOLATION: DEPTH & TRAYBUFFER
// ============================================================================

// 1a. Depth causal isolation: search decisions / horizon
{
  const pictures = [1, 1, 2, 2];
  const tiles = pictures.map((p, i) => ({ x: i * 8, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  const state = {
    pictures,
    down: [0, 0, 0, 0],
    alive: [1, 1, 1, 1],
    tray: [],
    moves: 0,
    openPeek: -1,
    relieved: false,
    arriving: []
  };
  const legalMoves = [0, 1, 2, 3].map(index => ({ index, inspect: false }));

  const shallowPlan = search(game, state, legalMoves, { depth: 2, finishKnown: false });
  const deepPlan = search(game, state, legalMoves, { depth: 4, finishKnown: false });

  assert.equal(shallowPlan.knownWin, false, 'Depth 2 must not certify full multi-step 4-tile win within depth horizon');
  assert.equal(deepPlan.knownWin, true, 'Depth 4 must find complete multi-step clear path');
  console.log('  [PASS] Planning depth causal isolation: shallow (depth 2) vs deep (depth 4)');
}

// 1b. TrayBuffer causal isolation: single tolerance vs immediate pair recovery
{
  const tGame = {
    tiles: [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 2 }, { x: 16, y: 0, z: 0 }],
    nb: { above: [[], [], []], left: [[], [], []], right: [[], []] },
    rules: null,
    clock: null
  };
  const tState = {
    pictures: [3, 4, 3],
    down: [0, 0, 0],
    alive: [1, 1, 1],
    tray: [1], // Single tile in tray
    moves: 0,
    openPeek: -1,
    relieved: false,
    arriving: []
  };
  const actions = [{ index: 0, inspect: false }, { index: 1, inspect: false }];

  // trayBuffer 2 (intolerant of singles) forces immediate pair recovery
  const resBuff2 = search(tGame, tState, actions, { trayBuffer: 2, depth: 1 });
  // trayBuffer 1 (tolerant of singles) takes the higher z tile (index 1)
  const resBuff1 = search(tGame, tState, actions, { trayBuffer: 1, depth: 1 });

  assert.equal(resBuff2.path[0], 0, 'trayBuffer 2 forces pair recovery to prevent stranded single');
  assert.equal(resBuff1.path[0], 1, 'trayBuffer 1 tolerates tray growth and follows higher z tiebreaker');
  console.log('  [PASS] TrayBuffer causal isolation: trayBuffer 2 (pair recovery) vs trayBuffer 1 (tray growth tolerance)');
}

// ============================================================================
// 2. MEMORY DECAY CAUSAL ISOLATION: OBSERVATION RETENTION ACROSS TAPS
// ============================================================================
{
  const board = 'causal_board_decay';
  const campaign = 'causal_camp_decay';
  const size = 6;
  const ev = { kind: 'causal-evidence', sha256: 'a'.repeat(64) };

  // Case A: decay = 0.0 (perfect retention across taps)
  const memRetain = createObservedMemory({
    size,
    campaign,
    board,
    seed: 12345,
    decay: 0.0,
    retryRetention: 0.0
  });
  memRetain.beginAttempt({ campaign, board, size, attempt: 1 });

  // Tap 1: inspect tile 2
  const obs1 = memRetain.observe({
    physicalTaps: 1,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, 42, null, null, null],
    evidence: [null, null, ev, null, null, null]
  });
  assert.equal(obs1.pictures[2], 42, 'Tile 2 must be recorded on tap 1');

  // Tap 2: next tap where tile 2 is face-down and not currently peeked
  const obs2 = memRetain.observe({
    physicalTaps: 2,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, null, null, null, null], // tile 2 is face-down now
    evidence: [null, null, null, null, null, null]
  });
  assert.equal(obs2.pictures[2], 42, 'decay=0.0 must retain observation of tile 2 on subsequent tap');

  // Case B: decay = 1.0 (certain forgetting on next tap)
  const memDecay = createObservedMemory({
    size,
    campaign: campaign + '_decay',
    board,
    seed: 12345,
    decay: 1.0,
    retryRetention: 0.0
  });
  memDecay.beginAttempt({ campaign: campaign + '_decay', board, size, attempt: 1 });

  memDecay.observe({
    physicalTaps: 1,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, 42, null, null, null],
    evidence: [null, null, ev, null, null, null]
  });

  const obsDecay2 = memDecay.observe({
    physicalTaps: 2,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, null, null, null, null],
    evidence: [null, null, null, null, null, null]
  });
  assert.equal(obsDecay2.pictures[2], null, 'decay=1.0 must forget unobserved face-down tile 2 on subsequent tap');
  console.log('  [PASS] Memory decay causal isolation: decay 0.0 (retained) vs decay 1.0 (forgotten across taps)');
}

// ============================================================================
// 3. RETRY RETENTION CAUSAL ISOLATION: ATTEMPT-TO-ATTEMPT MEMORY CARRYOVER
// ============================================================================
{
  const board = 'causal_board_retry';
  const campaign = 'causal_camp_retry';
  const size = 6;
  const ev = { kind: 'causal-evidence', sha256: 'b'.repeat(64) };

  // Case A: retryRetention = 1.0 (100% carryover across retries)
  const memLearn = createObservedMemory({
    size,
    campaign: campaign + '_learn',
    board,
    seed: 54321,
    decay: 0.0,
    retryRetention: 1.0
  });

  memLearn.beginAttempt({ campaign: campaign + '_learn', board, size, attempt: 1 });
  memLearn.observe({
    physicalTaps: 1,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, null, 99, null, null],
    evidence: [null, null, null, ev, null, null]
  });
  memLearn.endAttempt({ type: 'productionPhysicalEnd-v1', why: 'tray', win: false, state: { alive: [1, 1, 1, 1, 1, 1], physicalTaps: 1 } });

  // Attempt 2 begins:
  memLearn.beginAttempt({ campaign: campaign + '_learn', board, size, attempt: 2 });
  const startObsLearn = memLearn.observe({
    physicalTaps: 0,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, null, null, null, null],
    evidence: [null, null, null, null, null, null]
  });
  assert.equal(startObsLearn.pictures[3], 99, 'retryRetention=1.0 must carry over attempt 1 observation to attempt 2');

  // Case B: retryRetention = 0.0 (0% carryover across retries)
  const memNoLearn = createObservedMemory({
    size,
    campaign: campaign + '_nolearn',
    board,
    seed: 54321,
    decay: 0.0,
    retryRetention: 0.0
  });

  memNoLearn.beginAttempt({ campaign: campaign + '_nolearn', board, size, attempt: 1 });
  memNoLearn.observe({
    physicalTaps: 1,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, null, 99, null, null],
    evidence: [null, null, null, ev, null, null]
  });
  memNoLearn.endAttempt({ type: 'productionPhysicalEnd-v1', why: 'tray', win: false, state: { alive: [1, 1, 1, 1, 1, 1], physicalTaps: 1 } });

  // Attempt 2 begins:
  memNoLearn.beginAttempt({ campaign: campaign + '_nolearn', board, size, attempt: 2 });
  const startObsNoLearn = memNoLearn.observe({
    physicalTaps: 0,
    alive: [1, 1, 1, 1, 1, 1],
    pictures: [null, null, null, null, null, null],
    evidence: [null, null, null, null, null, null]
  });
  assert.equal(startObsNoLearn.pictures[3], null, 'retryRetention=0.0 must NOT carry over attempt 1 observation to attempt 2');
  console.log('  [PASS] Retry retention causal isolation: retryRetention 1.0 (carried over) vs 0.0 (no cross-attempt recall)');
}

console.log('PASS all component causal isolation verifications completed successfully');
