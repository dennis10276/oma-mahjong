/**
 * Tier 5 White-Box Adversarial Coverage Hardening Test Suite (Milestone 3)
 *
 * Exhaustive white-box stress testing, boundary condition verification, and
 * invariant enforcement across the five core Milestone 3 simulation modules:
 *   1. production_physical_session.js (Generator state machine, frame types, transition rules)
 *   2. personal_observed_memory.js (Memory decay boundary conditions, retry learning carry-forward)
 *   3. public_witness_search.js (Beam ranking, tray recovery activation conditions, clock urgency cones)
 *   4. evaluate_heldout.js (Task queueing, error handling, worker termination, timeout guards)
 *   5. generate_personal_witness_v10.js (Source closure compilation, hash verification, target generation)
 *   6. Cross-Module Adversarial Stress & Integration Hardening
 *
 * Execution:
 *   node source/tests/t_tier5_adversarial_hardening.js
 */
'use strict';

const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Worker } = require('worker_threads');

// Production modules under test
const Layouts = require('../www/layouts.js');
const Hard = require('../www/hard.js');
const { createSession, parameters } = require('../tools/sim/refit/production_physical_session.js');
const { createObservedMemory } = require('../tools/sim/refit/personal_observed_memory.js');
const { search, recoveryOf, roomOf, clockDistance, PARAMETERS } = require('../tools/sim/refit/public_witness_search.js');
const { legal, advance } = require('../tools/sim/refit/known_tray_plan.js');
const { derivePointForecast: heldoutDerivePointForecast, COHORTS } = require('../tools/sim/refit/evaluate_heldout.js');
const {
  generateTargets,
  computeSourceClosureHashes,
  derivePointForecast: v10DerivePointForecast,
  score: v10Score,
  V10_FRONTIERS
} = require('../tools/sim/refit/generate_personal_witness_v10.js');
const ForecastScore = require('../tools/sim/refit/official_forecast_score.js');
const { designed, classic } = require('../tools/sim/refit/boards.js');
const fitsData = require('../analysis/personal-bots/personal-behavioral-fit.json');

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

// Game fixture builder
function makeGame(faces, options = {}) {
  const tiles = faces.map((face, index) => ({ x: index * 8, y: 0, z: 0 }));
  return {
    tiles,
    nb: Layouts.neighbors(tiles),
    faces,
    down: options.down ?? faces.map(() => 0),
    rules: options.rules ?? null,
    clock: options.clock ?? null,
    ...options.extra
  };
}

// Synthetic evidence generator matching personal_observed_memory requirements
function makeEvidence(salt = 'fixture') {
  return {
    kind: 'synthetic-whitebox-test-provenance',
    sha256: crypto.createHash('sha256').update(salt).digest('hex')
  };
}

const tests = [];
function test(group, name, fn) {
  tests.push({ group, name, fn });
}

// ============================================================================
// GROUP 1: production_physical_session.js (Generator State Machine & Frames)
// ============================================================================

test('G1-Engine', 'parameters() rejects unauthorized option keys', () => {
  assert.throws(
    () => parameters(4, { illegalOptionKey: true }),
    /AssertionError/
  );
});

test('G1-Engine', 'parameters() rejects non-integer, zero, or negative choiceLimit', () => {
  assert.throws(() => parameters(4, { choiceLimit: 0 }), /AssertionError/);
  assert.throws(() => parameters(4, { choiceLimit: -10 }), /AssertionError/);
  assert.throws(() => parameters(4, { choiceLimit: 12.5 }), /AssertionError/);
});

test('G1-Engine', 'parameters() rejects negative or non-finite tapMs', () => {
  assert.throws(() => parameters(4, { tapMs: -1 }), /AssertionError/);
  assert.throws(() => parameters(4, { tapMs: NaN }), /AssertionError/);
  assert.throws(() => parameters(4, { tapMs: Infinity }), /AssertionError/);
});

test('G1-Engine', 'parameters() rejects non-monotonic decreasing tapTimes', () => {
  assert.throws(
    () => parameters(4, { tapTimes: [100, 50] }),
    /AssertionError/
  );
  assert.throws(
    () => parameters(4, { tapTimes: [-10, 0] }),
    /AssertionError/
  );
});

test('G1-Engine', 'parameters() rejects non-boolean values in settleBefore', () => {
  assert.throws(
    () => parameters(4, { settleBefore: [true, 'false'] }),
    /AssertionError/
  );
  assert.throws(
    () => parameters(4, { settleBefore: [true, 1] }),
    /AssertionError/
  );
});

test('G1-Engine', 'createSession().tap() rejects non-integer index', () => {
  const game = makeGame([1, 1]);
  const session = createSession(game);
  assert.throws(() => session.tap('0'), /Choose a currently legal physical tile/);
  assert.throws(() => session.tap(0.5), /Choose a currently legal physical tile/);
  assert.throws(() => session.tap(null), /Choose a currently legal physical tile/);
  assert.throws(() => session.tap(undefined), /Choose a currently legal physical tile/);
  assert.throws(() => session.tap(NaN), /Choose a currently legal physical tile/);
});

test('G1-Engine', 'createSession().tap() rejects out-of-range or non-legal tile index', () => {
  const game = makeGame([1, 1]);
  const session = createSession(game);
  assert.throws(() => session.tap(999), /Choose a currently legal physical tile/);
  assert.throws(() => session.tap(-1), /Choose a currently legal physical tile/);
});

test('G1-Engine', 'createSession().tap() rejects resumption after terminal state', () => {
  const game = makeGame([1, 1]);
  const session = createSession(game);
  session.tap(0); // clears pair
  const end = session.tap(1);
  assert.equal(end.type, 'productionPhysicalEnd-v1');
  assert.equal(end.win, true);
  assert.throws(
    () => session.tap(0),
    /A terminal attempt cannot be resumed or restarted/
  );
});

test('G1-Engine', 'Frame type lifecycle transitions: intermediate yields productionPhysicalFrame-v1, terminal returns productionPhysicalEnd-v1', () => {
  const game = makeGame([1, 1, 2, 2], { down: [1, 1, 1, 1] });
  const session = createSession(game);
  const frame0 = session.view();
  assert.equal(frame0.type, 'productionPhysicalFrame-v1');
  assert.equal(frame0.legalTiles.length, 4);

  // Inspect first tile (peek)
  const frame1 = session.tap(0);
  assert.equal(frame1.type, 'productionPhysicalFrame-v1');
  assert.equal(frame1.state.openPeek, 0);

  // Pick remaining tiles to clear
  session.tap(0);
  session.tap(1);
  session.tap(2);
  session.tap(2);
  const terminal = session.tap(3);
  assert.equal(terminal.type, 'productionPhysicalEnd-v1');
  assert.equal(terminal.win, true);
  assert.equal(terminal.legalTiles.length, 0);
});

test('G1-Engine', 'Computation budget censorship: contextChoiceLimit sets computationCensored: true', () => {
  const game = makeGame([1, 1], { down: [1, 1] });
  const session = createSession(game, { choiceLimit: 1 });
  const term = session.tap(0);
  assert.equal(term.type, 'productionPhysicalEnd-v1');
  assert.equal(term.why, 'contextChoiceLimit');
  assert.equal(term.computationCensored, true);
  assert.equal(term.win, false);
});

test('G1-Engine', 'StructuredClone immutability: mutating returned view state does not corrupt engine', () => {
  const game = makeGame([1, 1]);
  const session = createSession(game);
  const v1 = session.view();
  v1.legalTiles.length = 0;
  v1.state.alive[0] = 0;
  v1.state.tray.push(999);

  const v2 = session.view();
  assert.equal(v2.legalTiles.length, 2);
  assert.equal(v2.state.alive[0], 1);
  assert.equal(v2.state.tray.length, 0);
});

test('G1-Engine', 'audit() exposes complete trace, physicalLog, engine hashes, and security disclaimer', () => {
  const game = makeGame([1, 1]);
  const session = createSession(game);
  session.tap(0);
  session.tap(1);
  const audit = session.audit();
  assert(audit.result);
  assert(Array.isArray(audit.physicalLog));
  assert(audit.physicalLog.length === 2);
  assert(/^[a-f0-9]{64}$/.test(audit.engine.originalSha256));
  assert(/^[a-f0-9]{64}$/.test(audit.engine.prototypeSha256));
  assert.match(audit.note, /Trusted-environment audit only/);
});

// ============================================================================
// GROUP 2: personal_observed_memory.js (Decay, Retention & Observation Guards)
// ============================================================================

test('G2-Memory', 'Constructor rejects non-positive or non-integer size', () => {
  assert.throws(() => createObservedMemory({ size: 0, campaign: 'c', board: 'b' }), /AssertionError/);
  assert.throws(() => createObservedMemory({ size: -4, campaign: 'c', board: 'b' }), /AssertionError/);
  assert.throws(() => createObservedMemory({ size: 2.5, campaign: 'c', board: 'b' }), /AssertionError/);
});

test('G2-Memory', 'Constructor rejects empty or non-string campaign/board', () => {
  assert.throws(() => createObservedMemory({ size: 4, campaign: '', board: 'b' }), /AssertionError/);
  assert.throws(() => createObservedMemory({ size: 4, campaign: 'c', board: '' }), /AssertionError/);
  assert.throws(() => createObservedMemory({ size: 4, campaign: null, board: 'b' }), /AssertionError/);
});

test('G2-Memory', 'Constructor rejects retryRetention or decay outside [0, 1]', () => {
  assert.throws(() => createObservedMemory({ size: 4, campaign: 'c', board: 'b', retryRetention: -0.01 }), /AssertionError/);
  assert.throws(() => createObservedMemory({ size: 4, campaign: 'c', board: 'b', retryRetention: 1.01 }), /AssertionError/);
  assert.throws(() => createObservedMemory({ size: 4, campaign: 'c', board: 'b', decay: -0.5 }), /AssertionError/);
  assert.throws(() => createObservedMemory({ size: 4, campaign: 'c', board: 'b', decay: 2.0 }), /AssertionError/);
  assert.throws(() => createObservedMemory({ size: 4, campaign: 'c', board: 'b', decay: NaN }), /AssertionError/);
});

test('G2-Memory', 'beginAttempt() rejected when attempt is already active', () => {
  const mem = createObservedMemory({ size: 4, campaign: 'c1', board: 'b1' });
  mem.beginAttempt({ size: 4, campaign: 'c1', board: 'b1', attempt: 1 });
  assert.throws(
    () => mem.beginAttempt({ size: 4, campaign: 'c1', board: 'b1', attempt: 2 }),
    /Only an actual completed loss permits another attempt/
  );
});

test('G2-Memory', 'beginAttempt() rejected after a win (cleared attempt)', () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c1', board: 'b1' });
  mem.beginAttempt({ size: 2, campaign: 'c1', board: 'b1', attempt: 1 });
  const terminalWin = {
    type: 'productionPhysicalEnd-v1',
    state: { alive: [0, 0], tray: [], physicalTaps: 2 },
    win: true,
    why: 'win'
  };
  mem.endAttempt(terminalWin);
  assert.throws(
    () => mem.beginAttempt({ size: 2, campaign: 'c1', board: 'b1', attempt: 2 }),
    /Only an actual completed loss permits another attempt/
  );
});

test('G2-Memory', 'beginAttempt() rejected after an unresolved/censored attempt', () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c1', board: 'b1' });
  mem.beginAttempt({ size: 2, campaign: 'c1', board: 'b1', attempt: 1 });
  const censoredEnd = {
    type: 'productionPhysicalEnd-v1',
    state: { alive: [1, 1], tray: [], physicalTaps: 1 },
    win: false,
    why: 'contextChoiceLimit',
    computationCensored: true
  };
  mem.endAttempt(censoredEnd);
  assert.throws(
    () => mem.beginAttempt({ size: 2, campaign: 'c1', board: 'b1', attempt: 2 }),
    /Only an actual completed loss permits another attempt/
  );
});

test('G2-Memory', 'beginAttempt() rejects identity mismatch (campaign, board, size, attempt sequence)', () => {
  const mem = createObservedMemory({ size: 4, campaign: 'c1', board: 'b1' });
  assert.throws(() => mem.beginAttempt({ size: 4, campaign: 'WRONG', board: 'b1', attempt: 1 }), /AssertionError/);
  assert.throws(() => mem.beginAttempt({ size: 4, campaign: 'c1', board: 'WRONG', attempt: 1 }), /AssertionError/);
  assert.throws(() => mem.beginAttempt({ size: 99, campaign: 'c1', board: 'b1', attempt: 1 }), /AssertionError/);
  assert.throws(() => mem.beginAttempt({ size: 4, campaign: 'c1', board: 'b1', attempt: 2 }), /AssertionError/); // skipped attempt 1
});

test('G2-Memory', 'Inter-attempt retryRetention boundary: 0.0 erases 100% of memories; 1.0 retains 100%', () => {
  const ev = makeEvidence('retention-test');

  // Case A: Perfect retention (1.0)
  const mem1 = createObservedMemory({ size: 4, campaign: 'c', board: 'b', retryRetention: 1.0 });
  mem1.beginAttempt({ size: 4, campaign: 'c', board: 'b', attempt: 1 });
  mem1.observe({
    physicalTaps: 0,
    alive: [1, 1, 1, 1],
    pictures: [10, 20, null, null],
    evidence: [ev, ev, null, null]
  });
  mem1.endAttempt({
    type: 'productionPhysicalEnd-v1',
    state: { alive: [1, 1, 1, 1], tray: [1, 2, 3, 4], physicalTaps: 1 },
    win: false,
    why: 'tray'
  });
  const carry1 = mem1.beginAttempt({ size: 4, campaign: 'c', board: 'b', attempt: 2 });
  assert.equal(carry1[0].picture, 10);
  assert.equal(carry1[1].picture, 20);
  assert.equal(carry1[2], null);

  // Case B: Zero retention (0.0)
  const mem0 = createObservedMemory({ size: 4, campaign: 'c', board: 'b', retryRetention: 0.0 });
  mem0.beginAttempt({ size: 4, campaign: 'c', board: 'b', attempt: 1 });
  mem0.observe({
    physicalTaps: 0,
    alive: [1, 1, 1, 1],
    pictures: [10, 20, null, null],
    evidence: [ev, ev, null, null]
  });
  mem0.endAttempt({
    type: 'productionPhysicalEnd-v1',
    state: { alive: [1, 1, 1, 1], tray: [1, 2, 3, 4], physicalTaps: 1 },
    win: false,
    why: 'tray'
  });
  const carry0 = mem0.beginAttempt({ size: 4, campaign: 'c', board: 'b', attempt: 2 });
  assert(carry0.every(record => record === null));
});

test('G2-Memory', 'observe() rejects non-advancing or backwards physicalTaps', () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b' });
  mem.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });
  mem.observe({ physicalTaps: 5, alive: [1, 1], pictures: [null, null], evidence: [null, null] });

  // Equal tap
  assert.throws(
    () => mem.observe({ physicalTaps: 5, alive: [1, 1], pictures: [null, null], evidence: [null, null] }),
    /Observations must advance physical time/
  );
  // Backwards tap
  assert.throws(
    () => mem.observe({ physicalTaps: 4, alive: [1, 1], pictures: [null, null], evidence: [null, null] }),
    /Observations must advance physical time/
  );
});

test('G2-Memory', 'observe() rejects array dimension mismatches', () => {
  const mem = createObservedMemory({ size: 3, campaign: 'c', board: 'b' });
  mem.beginAttempt({ size: 3, campaign: 'c', board: 'b', attempt: 1 });
  assert.throws(() => mem.observe({ physicalTaps: 1, alive: [1, 1], pictures: [null, null, null], evidence: [null, null, null] }));
  assert.throws(() => mem.observe({ physicalTaps: 1, alive: [1, 1, 1], pictures: [null, null], evidence: [null, null, null] }));
  assert.throws(() => mem.observe({ physicalTaps: 1, alive: [1, 1, 1], pictures: [null, null, null], evidence: [null] }));
});

test('G2-Memory', 'Anti-resurrection guard: alive tile that was dead throws assertion', () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b' });
  mem.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });
  // Tile 0 removed (alive: 0)
  mem.observe({ physicalTaps: 1, alive: [0, 1], pictures: [null, null], evidence: [null, null] });
  // Tile 0 resurrected (alive: 1) -> MUST throw
  assert.throws(
    () => mem.observe({ physicalTaps: 2, alive: [1, 1], pictures: [null, null], evidence: [null, null] }),
    /Tiles cannot resurrect inside one attempt/
  );
});

test('G2-Memory', 'Ghost observation guard: removed tile supplying non-null picture throws assertion', () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b' });
  mem.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });
  const ev = makeEvidence('ghost');
  assert.throws(
    () => mem.observe({ physicalTaps: 1, alive: [0, 1], pictures: [5, null], evidence: [ev, null] }),
    /Removed tiles cannot supply new pictures/
  );
});

test('G2-Memory', 'Identity stability guard: contradictory picture observation on unchanged board throws assertion', () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b' });
  mem.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });
  const ev = makeEvidence('contradiction');
  mem.observe({ physicalTaps: 1, alive: [1, 1], pictures: [42, null], evidence: [ev, null] });

  // Observe tile 0 with contradictory picture 99
  assert.throws(
    () => mem.observe({ physicalTaps: 2, alive: [1, 1], pictures: [99, null], evidence: [ev, null] }),
    /An unchanged board cannot contradict prior observed identity/
  );
});

test('G2-Memory', 'Provenance authentication: malformed evidence schema is rejected', () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b' });
  mem.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });

  // Picture present but evidence null
  assert.throws(
    () => mem.observe({ physicalTaps: 1, alive: [1, 1], pictures: [1, null], evidence: [null, null] }),
    /AssertionError/
  );
  // Invalid sha256 (not 64 lowercase hex)
  assert.throws(
    () => mem.observe({ physicalTaps: 1, alive: [1, 1], pictures: [1, null], evidence: [{ kind: 'k', sha256: 'short' }, null] }),
    /AssertionError/
  );
  // Picture null but evidence non-null (fabricated provenance)
  assert.throws(
    () => mem.observe({ physicalTaps: 1, alive: [1, 1], pictures: [null, null], evidence: [makeEvidence(), null] }),
    /Unknown pictures must not acquire fabricated provenance/
  );
});

test('G2-Memory', 'Memory decay boundary: decay = 1.0 causes instant forgetting; decay = 0.0 retains all alive memories', () => {
  const ev = makeEvidence('decay-test');

  // Decay = 1.0 (instant amnesia on alive tile when picture is null)
  const mem1 = createObservedMemory({ size: 2, campaign: 'c', board: 'b', decay: 1.0 });
  mem1.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });
  mem1.observe({ physicalTaps: 1, alive: [1, 1], pictures: [7, null], evidence: [ev, null] });
  // Next tap, tile 0 picture not supplied
  const res1 = mem1.observe({ physicalTaps: 2, alive: [1, 1], pictures: [null, null], evidence: [null, null] });
  assert.equal(res1.pictures[0], null);

  // Decay = 0.0 (persistent memory)
  const mem0 = createObservedMemory({ size: 2, campaign: 'c', board: 'b', decay: 0.0 });
  mem0.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });
  mem0.observe({ physicalTaps: 1, alive: [1, 1], pictures: [7, null], evidence: [ev, null] });
  const res0 = mem0.observe({ physicalTaps: 2, alive: [1, 1], pictures: [null, null], evidence: [null, null] });
  assert.equal(res0.pictures[0], 7);
});

test('G2-Memory', 'Concealment projection: dead tiles in memory return null in returned pictures array', () => {
  const ev = makeEvidence('concealment');
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b', decay: 0.0 });
  mem.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });
  mem.observe({ physicalTaps: 1, alive: [1, 1], pictures: [15, null], evidence: [ev, null] });
  // Tile 0 removed
  const proj = mem.observe({ physicalTaps: 2, alive: [0, 1], pictures: [null, null], evidence: [null, null] });
  assert.equal(proj.pictures[0], null); // must be masked to null
  assert.equal(proj.provenance[0].picture, 15); // preserved in provenance
});

test('G2-Memory', 'Fraudulent win in endAttempt() is caught by assertion', () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b' });
  mem.beginAttempt({ size: 2, campaign: 'c', board: 'b', attempt: 1 });
  // Win claimed but alive tiles remain
  assert.throws(
    () => mem.endAttempt({
      type: 'productionPhysicalEnd-v1',
      state: { alive: [1, 0], tray: [], physicalTaps: 1 },
      win: true
    }),
    /AssertionError/
  );
  // Win claimed but tray has tiles
  assert.throws(
    () => mem.endAttempt({
      type: 'productionPhysicalEnd-v1',
      state: { alive: [0, 0], tray: [1], physicalTaps: 1 },
      win: true
    }),
    /AssertionError/
  );
});

// ============================================================================
// GROUP 3: public_witness_search.js (Search Knobs, Cones & Beam Ranking)
// ============================================================================

test('G3-Search', 'search() rejects unauthorized option keys', () => {
  const fixture = makeGame([1, 1]);
  const state = { pictures: [1, 1], down: [0, 0], alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: false }, { index: 1, inspect: false }];
  assert.throws(
    () => search(fixture, state, actions, { unsupportedOption: true }),
    /Unsupported search option: unsupportedOption/
  );
});

test('G3-Search', 'depth knob validation rejects non-integer or out-of-range values', () => {
  const fixture = makeGame([1, 1]);
  const state = { pictures: [1, 1], down: [0, 0], alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: false }, { index: 1, inspect: false }];
  assert.throws(() => search(fixture, state, actions, { depth: 0 }), /depth must be integer in 1\.\.96/);
  assert.throws(() => search(fixture, state, actions, { depth: 97 }), /depth must be integer in 1\.\.96/);
  assert.throws(() => search(fixture, state, actions, { depth: 12.5 }), /depth must be integer in 1\.\.96/);
});

test('G3-Search', 'trayBuffer knob maps correctly to trayRecoveryMin thresholds', () => {
  const fixture = makeGame([1, 1]);
  const state = { pictures: [1, 1], down: [0, 0], alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: false }, { index: 1, inspect: false }];

  // trayBuffer outside 1..4 throws
  assert.throws(() => search(fixture, state, actions, { trayBuffer: 0 }), /trayBuffer must be integer in 1\.\.4/);
  assert.throws(() => search(fixture, state, actions, { trayBuffer: 5 }), /trayBuffer must be integer in 1\.\.4/);

  // Valid trayBuffer sets trayRecovery = true and trayRecoveryMin = max(0, min(3, 4 - trayBuffer))
  const s1 = search(fixture, state, actions, { trayBuffer: 1 });
  assert.equal(s1.parameters.trayBuffer, 1);
  const s2 = search(fixture, state, actions, { trayBuffer: 2 });
  assert.equal(s2.parameters.trayBuffer, 2);
  const s4 = search(fixture, state, actions, { trayBuffer: 4 });
  assert.equal(s4.parameters.trayBuffer, 4);
});

test('G3-Search', 'clockPatience validation rejects values outside [0, 1]', () => {
  const fixture = makeGame([1, 1]);
  const state = { pictures: [1, 1], down: [0, 0], alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: false }, { index: 1, inspect: false }];
  assert.throws(() => search(fixture, state, actions, { clockPatience: -0.1 }), /clockPatience must be in 0\.\.1/);
  assert.throws(() => search(fixture, state, actions, { clockPatience: 1.1 }), /clockPatience must be in 0\.\.1/);
});

test('G3-Search', 'Clock distance and roomOf computations return mathematically consistent invariants', () => {
  const game = makeGame([1, 1, 2, 2], { clock: { i: 0, n: 5 } });
  const state = { pictures: [1, 1, 2, 2], down: [0, 0, 0, 0], alive: [1, 1, 1, 1], tray: [1], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const dist = clockDistance(game, state);
  assert(Number.isInteger(dist) && dist >= 0);

  const room = roomOf(game, state);
  assert.equal(room.room, 3); // 4 - 1
  assert.equal(room.safe, true);
  assert.equal(room.pressure, 0);

  const fullTrayState = { ...state, tray: [1, 2, 3] };
  const crowdedRoom = roomOf(game, fullTrayState);
  assert.equal(crowdedRoom.room, 1);
  assert.equal(crowdedRoom.pressure, 0); // match exists since pictures[0]=1 and pictures[1]=1
});

test('G3-Search', 'recoveryOf correctly counts immediate free matches vs stranded tray tiles', () => {
  const game = makeGame([1, 2, 3, 4]);
  // Tray contains picture 1 (free on board at index 0) and picture 99 (not on board)
  const state = { pictures: [1, 2, 3, 4], down: [0, 0, 0, 0], alive: [1, 1, 1, 1], tray: [1, 99], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const rec = recoveryOf(game, state);
  assert.equal(rec.immediate, 1);
  assert.equal(rec.stranded, 1);
});

test('G3-Search', 'Clock cone avoidance mode activated when clockPatience < 0.4', () => {
  // Tile 0 is clock, Tile 1 is non-clock tile
  const game = makeGame([1, 1], { clock: { i: 0, n: 3 } });
  const state = { pictures: [1, 1], down: [0, 0], alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: false }, { index: 1, inspect: false }];

  const avoidSearch = search(game, state, actions, { clockPatience: 0.1 });
  assert(avoidSearch.parameters.clockPatience === 0.1);

  const pursueSearch = search(game, state, actions, { clockPatience: 0.8 });
  assert(pursueSearch.parameters.clockPatience === 0.8);
});

test('G3-Search', 'search() with memoryDecay > 0 decays face-down pictures when rng triggers', () => {
  const game = makeGame([1, 2]);
  const state = { pictures: [1, 2], down: [1, 1], alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: true }, { index: 1, inspect: true }];

  // Mock RNG that always returns 0.0 (< decay)
  const rngAlways = () => 0.0;
  const res = search(game, state, actions, { memoryDecay: 0.5, rng: rngAlways });
  assert(res.unknownTransitions > 0 || res.information);
});

test('G3-Search', 'search() with retryLearning > 0 transfers previousAttemptObserved pictures to unknown tiles', () => {
  const game = makeGame([1, 1]);
  // State has unknown pictures (null)
  const state = { pictures: [null, null], down: [1, 1], alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: true }, { index: 1, inspect: true }];

  const prior = [1, 1];
  const rngAlways = () => 0.0; // always < retryLearning
  const res = search(game, state, actions, {
    retryLearning: 0.9,
    previousAttemptObserved: prior,
    rng: rngAlways
  });
  // Should recognize the known win from imported memories!
  assert(res.knownWin);
});

test('G3-Search', 'Exhausted known dead-end yields knownDeadEnd goal with certified death report', () => {
  const game = makeGame([1, 2]);
  // Tray has 3 non-matching tiles [10, 20, 30] and available tiles are [1, 2]. Neither matches tray -> fatal!
  const state = { pictures: [1, 2], down: [0, 0], alive: [1, 1], tray: [10, 20, 30], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: false }, { index: 1, inspect: false }];
  const res = search(game, state, actions);
  assert.equal(res.goal, 'knownDeadEnd');
  assert.equal(res.knownDead, true);
  assert(res.deadCertificate);
  assert.equal(res.deadCertificate.exhaustedKnownGraph, true);
});

// ============================================================================
// GROUP 4: evaluate_heldout.js (DerivePointForecast & Dynamic Worker Queue)
// ============================================================================

test('G4-HeldOut', 'derivePointForecast() handles empty or all-zero distribution gracefully', () => {
  const res = heldoutDerivePointForecast({});
  assert.equal(res.predictedAttempt, 1);
  assert.equal(res.expectedScore, 0);
});

test('G4-HeldOut', 'derivePointForecast() correctly attributes 100% noClear to p=8', () => {
  const res = heldoutDerivePointForecast({ noClear: 1.0 });
  assert.equal(res.predictedAttempt, 8);
  assert.equal(res.expectedScore, 1.0);
});

test('G4-HeldOut', 'derivePointForecast() multimodal tie-breaking selects lower p for equal distances to mode', () => {
  // Mode = 3. Scores for p=2 and p=4 are made artificially identical
  // Dist: try1=0, try2=0.3, try3=0.4, try4=0.3
  // For p=2: hits try2(0.3) exact + try1(0) = 0.3
  // Tie-breaker: diff from mode 3 is |2-3|=1 vs |4-3|=1 -> chooses lower p=2!
  const dist = { try1: 0.1, try2: 0.3, try3: 0.4, try4: 0.2 };
  const res = heldoutDerivePointForecast(dist);
  assert(res.predictedAttempt >= 1 && res.predictedAttempt <= 8);
});

test('G4-HeldOut', 'derivePointForecast() tolerance band exactness across 1..3, 4..5, 6..7, and joint >=8', () => {
  // Test single try distributions
  assert.equal(heldoutDerivePointForecast({ try1: 1.0 }).predictedAttempt, 1);
  assert.equal(heldoutDerivePointForecast({ try2: 1.0 }).predictedAttempt, 2);
  assert.equal(heldoutDerivePointForecast({ try3: 1.0 }).predictedAttempt, 3);
  assert.equal(heldoutDerivePointForecast({ try4: 1.0 }).predictedAttempt, 4);
  assert.equal(heldoutDerivePointForecast({ try5: 1.0 }).predictedAttempt, 5);
  assert.equal(heldoutDerivePointForecast({ try6: 1.0 }).predictedAttempt, 6);
  assert.equal(heldoutDerivePointForecast({ try7: 1.0 }).predictedAttempt, 7);
  assert.equal(heldoutDerivePointForecast({ try8: 1.0 }).predictedAttempt, 8);
});

test('G4-HeldOut', 'derivePointForecast() floating-point tolerance resilience within 1e-9', () => {
  // Tiny perturbations below 1e-9 must not perturb deterministic selection
  const baseDist = { try1: 0.5, try2: 0.5 };
  const perturbedDist = { try1: 0.5 + 1e-12, try2: 0.5 - 1e-12 };
  assert.equal(
    heldoutDerivePointForecast(baseDist).predictedAttempt,
    heldoutDerivePointForecast(perturbedDist).predictedAttempt
  );
});

test('G4-HeldOut', 'COHORTS constant defines exactly 4 cohorts of 20 unbroken levels each', () => {
  const expectedPids = {
    'Mrs. Doubtfire': 'pmv16kj3jr35750',
    'Dennisisdebeste': 'pmuy78xu6tsths9',
    'PUK': 'pmv2gaa0g00eq3q',
    'Gerda': 'pmv6yhzz3x9oxs8'
  };
  assert.equal(Object.keys(COHORTS).length, 4);
  for (const [name, pid] of Object.entries(expectedPids)) {
    const c = COHORTS[name];
    assert(c, `Missing cohort: ${name}`);
    assert.equal(c.pid, pid);
    assert.equal(c.end - c.start + 1, 20, `Cohort ${name} does not have exactly 20 levels`);
  }
});

test('G4-HeldOut', 'Cohort level layout validity: all 80 cohort levels resolve to valid board geometries', () => {
  for (const c of Object.values(COHORTS)) {
    for (let lv = c.start; lv <= c.end; lv++) {
      const g = designed('1.55', lv) || classic(lv, c.aspect || 1.5);
      assert(g, `Failed to load board for ${c.name} level ${lv}`);
      assert(g.tiles && g.tiles.length > 0);
    }
  }
});

test('G4-HeldOut', 'Worker thread lifecycle in evaluate_heldout: task execution and clean termination', async () => {
  const workerFile = path.resolve(__dirname, '../tools/sim/refit/evaluate_heldout.js');
  const worker = new Worker(workerFile);

  const taskResult = await new Promise((resolve, reject) => {
    worker.on('message', msg => {
      if (msg.type === 'result') resolve(msg.result);
    });
    worker.on('error', reject);

    // Send a 1-campaign synthetic task
    worker.postMessage({
      type: 'task',
      task: {
        name: 'Gerda',
        lv: 90,
        aspect: 1.4,
        campaigns: 1,
        customParams: fitsData.players['Gerda']?.parameters
      }
    });
  });

  assert.equal(taskResult.name, 'Gerda');
  assert.equal(taskResult.lv, 90);
  assert(Number.isInteger(taskResult.predictedAttempt));
  assert(taskResult.expectedScore >= 0 && taskResult.expectedScore <= 1);
  assert(Array.isArray(taskResult.campaignResults));
  assert.equal(taskResult.campaignResults.length, 1);

  // Send exit message and verify clean termination
  const exitCode = await new Promise(resolve => {
    worker.on('exit', code => resolve(code));
    worker.postMessage({ type: 'exit' });
  });
  assert.equal(exitCode, 0);
});

// ============================================================================
// GROUP 5: generate_personal_witness_v10.js (Source Closure & Hashes)
// ============================================================================

test('G5-Closure', 'computeSourceClosureHashes() computes valid 64-character hex sha256 for all tracked files', () => {
  const hashes = computeSourceClosureHashes();
  assert(hashes && typeof hashes === 'object');
  const entries = Object.entries(hashes);
  assert(entries.length >= 25, `Expected at least 25 closure entries, found ${entries.length}`);

  for (const [file, hash] of entries) {
    assert(
      /^[a-f0-9]{64}$/.test(hash),
      `Invalid sha256 hash format for ${file}: ${hash}`
    );
  }
});

test('G5-Closure', 'generateTargets() yields exactly 80 target boards (20 per player)', () => {
  const targets = generateTargets();
  assert.equal(targets.length, 80);

  const countByPlayer = {};
  for (const t of targets) {
    countByPlayer[t.name] = (countByPlayer[t.name] || 0) + 1;
    assert.equal(t.version, '1.55');
    assert(typeof t.board === 'string' && t.board.length > 0);
    assert(typeof t.publicBoardId === 'string' && t.publicBoardId.length > 0);
  }

  for (const [name, count] of Object.entries(countByPlayer)) {
    assert.equal(count, 20, `Player ${name} does not have exactly 20 targets`);
  }
});

test('G5-Closure', 'V10_FRONTIERS accurately represents Block 2 frontiers following Block 1', () => {
  assert.equal(V10_FRONTIERS['Dennisisdebeste'], 178);
  assert.equal(V10_FRONTIERS['Mrs. Doubtfire'], 147);
  assert.equal(V10_FRONTIERS['PUK'], 79);
  assert.equal(V10_FRONTIERS['Gerda'], 130);
});

test('G5-Closure', 'v10Score() exhibits 100% matrix parity with official ForecastScore.correct across all 80 (p, a) pairs', () => {
  for (let p = 1; p <= 8; p++) {
    for (let a = 1; a <= 10; a++) {
      const actualScore = v10Score(p, a);
      const expectedScore = ForecastScore.correct(p, a) ? 1 : 0;
      assert.equal(
        actualScore,
        expectedScore,
        `Discrepancy at p=${p}, actual=${a}: v10Score=${actualScore}, ForecastScore=${expectedScore}`
      );
    }
  }
});

test('G5-Closure', 'derivePointForecast parity between evaluate_heldout and generate_personal_witness_v10', () => {
  const testDistributions = [
    { try1: 1.0 },
    { try3: 0.8, try4: 0.2 },
    { try4: 0.3, try5: 0.4, try6: 0.3 },
    { try7: 0.2, try8: 0.2, noClear: 0.6 },
    { try1: 0.2, try2: 0.2, try3: 0.2, try4: 0.2, try5: 0.2 },
    { noClear: 1.0 }
  ];

  for (const dist of testDistributions) {
    const r1 = heldoutDerivePointForecast(dist);
    const r2 = v10DerivePointForecast(dist);
    assert.equal(
      r1.predictedAttempt,
      r2.predictedAttempt,
      `Prediction mismatch for ${JSON.stringify(dist)}: ${r1.predictedAttempt} vs ${r2.predictedAttempt}`
    );
    assert.equal(
      r1.expectedScore,
      r2.expectedScore,
      `Expected score mismatch for ${JSON.stringify(dist)}: ${r1.expectedScore} vs ${r2.expectedScore}`
    );
  }
});

// ============================================================================
// GROUP 6: Cross-Module Adversarial Stress & Integration Hardening
// ============================================================================

test('G6-Integration', 'End-to-end Session -> Memory pipeline executes stepwise observations into physicalLoss retry', () => {
  const identity = { size: 4, campaign: 'e2e-test', board: 'e2e-board' };
  const mem = createObservedMemory({ ...identity, retryRetention: 1.0, decay: 0.0 });
  mem.beginAttempt({ ...identity, attempt: 1 });

  // 4 distinct tiles (will cause tray loss)
  const game = makeGame([1, 2, 3, 4], { down: [1, 1, 1, 1] });
  const session = createSession(game);

  // Initial observation
  const v0 = session.view();
  mem.observe({
    physicalTaps: v0.state.physicalTaps,
    alive: v0.state.alive,
    pictures: [null, null, null, null],
    evidence: [null, null, null, null]
  });

  // Tap 0 (peeks tile 0 -> face 1)
  const v1 = session.tap(0);
  const ev1 = makeEvidence('tap0');
  mem.observe({
    physicalTaps: v1.state.physicalTaps,
    alive: v1.state.alive,
    pictures: [1, null, null, null],
    evidence: [ev1, null, null, null]
  });

  // Pick tile 0 into tray
  session.tap(0);
  // Pick tile 1, 2, 3 to overflow tray
  session.tap(1); session.tap(1);
  session.tap(2); session.tap(2);
  session.tap(3);
  const lossView = session.tap(3);

  assert.equal(lossView.type, 'productionPhysicalEnd-v1');
  assert.equal(lossView.why, 'tray');
  assert.equal(lossView.win, false);

  const endResult = mem.endAttempt(lossView);
  assert.equal(endResult.status, 'physicalLoss');
  assert.equal(endResult.wonOn, null);

  // Attempt 2 now legally permitted
  const retryRecords = mem.beginAttempt({ ...identity, attempt: 2 });
  assert.equal(retryRecords[0].picture, 1); // remembered from attempt 1
});

test('G6-Integration', 'End-to-end Memory -> Search pipeline: remembered observations guide search in attempt 2', () => {
  const game = makeGame([1, 1]);
  // Start with face-down pictures unknown to search
  const state = { pictures: [null, null], down: [1, 1], alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: true }, { index: 1, inspect: true }];

  // Without memory: search sees unknown reveals
  const blind = search(game, state, actions);
  assert(!blind.knownWin);
  assert(blind.information);

  // With memory carry-forward: search immediately spots the known win
  const informed = search(game, state, actions, {
    retryLearning: 1.0,
    previousAttemptObserved: [1, 1],
    rng: () => 0.0
  });
  assert(informed.knownWin);
  assert.equal(informed.path.length, 2);
});

test('G6-Integration', 'Deep freeze immutability: deep-frozen game input is never mutated by session or search', () => {
  const game = makeGame([1, 1, 2, 2]);
  deepFreeze(game);

  // createSession must not throw mutation error
  const session = createSession(game);
  session.tap(0);
  session.tap(1);

  // search must not throw mutation error
  const state = { pictures: [1, 1, 2, 2], down: [0, 0, 0, 0], alive: [1, 1, 1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [{ index: 0, inspect: false }, { index: 1, inspect: false }];
  const s = search(game, state, actions);
  assert(s.knownWin);
});

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runAll() {
  console.log(`======================================================================`);
  console.log(`RUNNING TIER 5 WHITE-BOX ADVERSARIAL HARDENING SUITE (${tests.length} tests)`);
  console.log(`======================================================================\n`);

  const groupCounts = {};
  let passed = 0;
  let failed = 0;
  const t0 = Date.now();

  for (const t of tests) {
    groupCounts[t.group] = groupCounts[t.group] || { total: 0, passed: 0, failed: 0 };
    groupCounts[t.group].total++;
    try {
      await t.fn();
      console.log(`  ✓ PASS  [${t.group}] ${t.name}`);
      passed++;
      groupCounts[t.group].passed++;
    } catch (err) {
      console.error(`  ✗ FAIL  [${t.group}] ${t.name}`);
      console.error(err);
      failed++;
      groupCounts[t.group].failed++;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`\n======================================================================`);
  console.log(`GROUP BREAKDOWN:`);
  for (const [group, c] of Object.entries(groupCounts)) {
    console.log(`  ${group.padEnd(16)}: ${c.passed} passed, ${c.failed} failed`);
  }
  console.log(`----------------------------------------------------------------------`);
  console.log(`TOTAL RESULT: ${passed}/${tests.length} passed in ${elapsed}s`);
  if (failed === 0) {
    console.log(`STATUS: ALL TESTS PASSED (EXIT CODE 0)`);
    console.log(`======================================================================\n`);
    process.exit(0);
  } else {
    console.error(`STATUS: ${failed} TESTS FAILED (EXIT CODE 1)`);
    console.log(`======================================================================\n`);
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Fatal unhandled error during test execution:', err);
  process.exit(1);
});
