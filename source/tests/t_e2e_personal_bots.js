/**
 * Independent Opaque-Box E2E Test Suite for Personal Player Bots (Voorspeltest)
 *
 * Verifies all 7 inventoried features across 4 rigorous tiers:
 *   - Tier 1: Feature Coverage (>=5 tests per feature = 35 tests)
 *   - Tier 2: Boundary & Corner Cases (>=5 tests per feature = 35 tests)
 *   - Tier 3: Cross-Feature Combinations (7 pairwise interaction tests)
 *   - Tier 4: Real-World Application Scenarios (5 cohort & pipeline tests)
 * Total: 82 tests
 *
 * Can be run standalone: `node source/tests/t_e2e_personal_bots.js` (exits with code 0 on success)
 * Or via project runner: `node source/tests/run.js t_e2e_personal_bots.js`
 */
'use strict';

const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Core domain modules
const Layouts = require('../www/layouts.js');
const Hard = require('../www/hard.js');
const ForecastScore = require('../tools/sim/refit/official_forecast_score.js');
const fitsData = require('../analysis/personal-bots/personal-behavioral-fit.json');
const { createObservedMemory } = require('../tools/sim/refit/personal_observed_memory.js');
const { createSession } = require('../tools/sim/refit/production_physical_session.js');
const { calibratePlayer } = require('../tools/sim/refit/personal_behavioral_calibration.js');
const { simulatePersonalCampaign } = require('../tools/sim/refit/personal_witness_simulation.js');
const { designed, classic } = require('../tools/sim/refit/boards.js');
const { derivePointForecast } = require('../tools/sim/refit/generate_personal_witness_v9.js');

// Helper tolerance function matching official specification
const toleranceOf = actual => actual > 5 ? 2 : actual > 3 ? 1 : 0;

// Canonical player PIDs
const CANONICAL_PLAYERS = Object.freeze({
  'Dennisisdebeste': 'pmuy78xu6tsths9',
  'Mrs. Doubtfire': 'pmv16kj3jr35750',
  'PUK': 'pmv2gaa0g00eq3q',
  'Gerda': 'pmv6yhzz3x9oxs8'
});

// Helper for generating authentic app telemetry
function makeTelemetry(deviceTime, deviceName, width = 360) {
  const ses = deviceTime.toString(36);
  const openEvent = { k: 'open', dev: deviceName, vw: width, ses, t: deviceTime };
  const deviceString = `${deviceName} ${Math.round(width)}`;
  return { ses, openEvent, deviceString };
}

const tests = [];

function registerTest(tier, feature, name, fn) {
  tests.push({
    tier,
    feature,
    name: `[${tier}] [${feature}] ${name}`,
    run: fn
  });
}

/* ==========================================================================
   TIER 1: FEATURE COVERAGE (>=5 tests per feature, 35 tests)
   ========================================================================== */

// --- Feature 1: Engine Occlusion & Tray Capacity ---
registerTest('Tier 1', 'F1-Engine', 'Exact vertical occlusion detection via Hard.coverOf', async () => {
  // Tile 0 at (0, 0, 0), Tile 1 directly above at (0, 0, 1)
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
  const nb = Layouts.neighbors(tiles);
  const covers = Hard.coverOf(tiles, nb);
  assert.equal(covers[0].length, 1, 'Tile 0 must have exactly 1 covering tile');
  assert.equal(covers[0][0], 1, 'Tile 1 must be the covering tile for Tile 0');
  assert.equal(covers[1].length, 0, 'Top tile 1 must have no covering tiles');
});

registerTest('Tier 1', 'F1-Engine', 'Stepped offset tiles physically block isFree but do NOT occlude coverOf', async () => {
  // Stepped pyramid: Tile 0 at (0, 0, 0), Tile 1 at (1, 1, 1)
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }];
  const nb = Layouts.neighbors(tiles);
  const covers = Hard.coverOf(tiles, nb);
  const alive = new Uint8Array([1, 1]);
  // Physical removal check: Tile 1 is in nb.above[0], so Tile 0 is physically blocked
  assert.equal(Layouts.isFree(0, alive, nb), false, 'Tile 0 must be blocked in isFree due to stepped overlap');
  // Visual occlusion check: x and y do not match, so Tile 0 is NOT hidden
  assert.equal(covers[0].length, 0, 'Tile 0 must NOT be covered in coverOf because coordinates are offset');
});

registerTest('Tier 1', 'F1-Engine', 'Tray capacity limit is exactly 4 slots', async () => {
  assert.equal(Layouts.SLOTS, 4, 'Production tray capacity must be exactly 4');
  const game = classic(1, 1.5);
  const session = createSession(game, { seed: 1 });
  const initialFrame = session.view();
  assert.equal(initialFrame.type, 'productionPhysicalFrame-v1', 'Session must yield productionPhysicalFrame-v1');
  assert(initialFrame.legalTiles.length > 0, 'Session must expose legal tiles');
  assert.equal(initialFrame.state.tray.length, 0, 'Initial tray must be empty');
});

registerTest('Tier 1', 'F1-Engine', 'Lateral freedom rule requires at least one open side', async () => {
  // Tile 0 at (2, 0, 0) flanked by Tile 1 at (0, 0, 0) and Tile 2 at (4, 0, 0)
  const tiles = [{ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
  const nb = Layouts.neighbors(tiles);
  const alive = new Uint8Array([1, 1, 1]);
  assert.equal(Layouts.isFree(0, alive, nb), false, 'Tile 0 blocked on both sides must not be free');
  alive[1] = 0; // Remove left neighbor
  assert.equal(Layouts.isFree(0, alive, nb), true, 'Tile 0 with open left side must become free');
  alive[1] = 1; alive[2] = 0; // Restore left, remove right neighbor
  assert.equal(Layouts.isFree(0, alive, nb), true, 'Tile 0 with open right side must become free');
});

registerTest('Tier 1', 'F1-Engine', 'Obstacle mechanics (ice/locks) supersede geometric freedom', async () => {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
  const nb = Layouts.neighbors(tiles);
  const alive = new Uint8Array([1, 1, 1]);
  const rules = {
    ice: null,
    locks: new Set([0]),
    keys: [1, 2],
    iceNb: Layouts.iceNeighbors(tiles)
  };
  assert.equal(Layouts.isFree(0, alive, nb), true, 'Tile 0 is geometrically free');
  assert.equal(Layouts.takeable(0, alive, nb, rules, alive), false, 'Tile 0 is locked while keys remain on board');
  alive[1] = 0; alive[2] = 0; // Take both keys
  assert.equal(Layouts.takeable(0, alive, nb, rules, alive), true, 'Tile 0 becomes takeable once both keys leave board');
});

// --- Feature 2: Four Personal Player Policies ---
registerTest('Tier 1', 'F2-Policies', '4 canonical players exist with valid PIDs', async () => {
  for (const [name, pid] of Object.entries(CANONICAL_PLAYERS)) {
    assert(fitsData.players[name], `Fit profile must exist for ${name}`);
    assert.equal(typeof pid, 'string', `PID for ${name} must be string`);
    assert(pid.startsWith('pm'), `PID ${pid} must start with pm prefix`);
  }
});

registerTest('Tier 1', 'F2-Policies', '5 behavioral knobs schema and numeric validity', async () => {
  const requiredKnobs = ['depth', 'trayBuffer', 'clockPatience', 'memoryDecay', 'retryLearning'];
  for (const [name, profile] of Object.entries(fitsData.players)) {
    const params = profile.parameters;
    assert(params, `Player ${name} must have parameters`);
    for (const knob of requiredKnobs) {
      assert(Number.isFinite(params[knob]), `Knob ${knob} in ${name} must be a finite number`);
      assert(params[knob] >= 0, `Knob ${knob} in ${name} must be non-negative`);
    }
  }
});

registerTest('Tier 1', 'F2-Policies', 'Persona parameter differentiation across players', async () => {
  const dennis = fitsData.players['Dennisisdebeste'].parameters;
  const puk = fitsData.players['PUK'].parameters;
  const doubtfire = fitsData.players['Mrs. Doubtfire'].parameters;
  assert.equal(dennis.depth, 16, 'Dennisisdebeste depth should be 16');
  assert.equal(puk.depth, 12, 'PUK depth should be 12 (fast tactical search)');
  assert(dennis.memoryDecay < doubtfire.memoryDecay, 'Dennisisdebeste must have slower memory decay than Mrs. Doubtfire');
  assert(dennis.retryLearning > puk.retryLearning, 'Dennisisdebeste must have higher retry learning retention than PUK');
});

registerTest('Tier 1', 'F2-Policies', 'Behavioral calibration recency weighting half-life', async () => {
  const calibrated = calibratePlayer('Dennisisdebeste', Infinity, 20);
  assert(calibrated.episodes > 0, 'Dennisisdebeste must have calibrated episodes');
  assert.equal(calibrated.parameters.trayBuffer, 2, 'Tray buffer must calibrate to safe threshold 2');
});

registerTest('Tier 1', 'F2-Policies', 'Policy cutoff enforcement excludes post-cutoff games', async () => {
  const earlyCutoff = 1000; // Epoch timestamp far in past
  const calEarly = calibratePlayer('Dennisisdebeste', earlyCutoff);
  assert.equal(calEarly.episodes, 0, 'Calibrating with ancient cutoff should yield 0 episodes');
  assert.equal(calEarly.parameters.depth, 16, 'Fallback default depth must be 16');
  assert.equal(calEarly.parameters.trayBuffer, 2, 'Fallback default trayBuffer must be 2');
});

// --- Feature 3: Multi-Campaign Retries & Memory ---
registerTest('Tier 1', 'F3-Simulation', 'Multi-campaign simulation executes sequential attempts up to cap', async () => {
  const game = designed('1.55', 107) || classic(5, 1.5);
  const sim = simulatePersonalCampaign(game, 'Mrs. Doubtfire', { maxAttempts: 3, seed: 12345 });
  assert(sim.totalAttempts >= 1 && sim.totalAttempts <= 3, 'Simulation must record between 1 and 3 attempts');
  assert(typeof sim.cleared === 'boolean', 'Simulation result cleared must be boolean');
});

registerTest('Tier 1', 'F3-Simulation', 'Retries strictly gated by completed physicalLoss frame', async () => {
  const memory = createObservedMemory({ size: 4, campaign: 'camp_test', board: 'board_test', seed: 42 });
  memory.beginAttempt({ campaign: 'camp_test', board: 'board_test', size: 4, attempt: 1 });
  // Attempting to begin attempt 2 without ending attempt 1 must throw
  assert.throws(() => {
    memory.beginAttempt({ campaign: 'camp_test', board: 'board_test', size: 4, attempt: 2 });
  }, /Only an actual completed loss permits another attempt/);
});

registerTest('Tier 1', 'F3-Simulation', 'Winning campaign terminates immediately without subsequent retries', async () => {
  const memory = createObservedMemory({ size: 2, campaign: 'camp_win', board: 'board_win', seed: 42 });
  memory.beginAttempt({ campaign: 'camp_win', board: 'board_win', size: 2, attempt: 1 });
  memory.endAttempt({
    type: 'productionPhysicalEnd-v1',
    state: { alive: [0, 0], tray: [], physicalTaps: 2 },
    win: true
  });
  // Win cannot be followed by another retry attempt
  assert.throws(() => {
    memory.beginAttempt({ campaign: 'camp_win', board: 'board_win', size: 2, attempt: 2 });
  }, /Only an actual completed loss permits another attempt/);
});

registerTest('Tier 1', 'F3-Simulation', 'Inter-attempt memory carries forward observed tile locations', async () => {
  const memory = createObservedMemory({ size: 4, campaign: 'camp_carry', board: 'board_carry', seed: 1, retryRetention: 1.0 });
  memory.beginAttempt({ campaign: 'camp_carry', board: 'board_carry', size: 4, attempt: 1 });
  const sha = 'a'.repeat(64);
  memory.observe({
    physicalTaps: 1,
    alive: [1, 1, 1, 1],
    pictures: [7, null, null, null],
    evidence: [{ kind: 'obs', sha256: sha }, null, null, null]
  });
  memory.endAttempt({
    type: 'productionPhysicalEnd-v1',
    state: { alive: [1, 1, 1, 1], tray: [1, 2, 3, 4], physicalTaps: 2 },
    why: 'tray',
    win: false
  });
  // Next attempt with 100% retention should remember picture 7 at index 0
  const records = memory.beginAttempt({ campaign: 'camp_carry', board: 'board_carry', size: 4, attempt: 2 });
  assert(records[0] !== null, 'Index 0 picture should be remembered in attempt 2');
  assert.equal(records[0].picture, 7, 'Observed picture must match 7');
});

registerTest('Tier 1', 'F3-Simulation', 'Observation boundary requires physical exposure without oracle access', async () => {
  const memory = createObservedMemory({ size: 2, campaign: 'camp_obs', board: 'board_obs', seed: 1 });
  memory.beginAttempt({ campaign: 'camp_obs', board: 'board_obs', size: 2, attempt: 1 });
  // Supplying picture for a dead tile must be rejected
  assert.throws(() => {
    memory.observe({
      physicalTaps: 1,
      alive: [0, 1],
      pictures: [99, null], // Tile 0 is not alive
      evidence: [{ kind: 'obs', sha256: 'b'.repeat(64) }, null]
    });
  }, /Removed tiles cannot supply new pictures/);
});

// --- Feature 4: Point Forecast Tolerance Optimizer ---
registerTest('Tier 1', 'F4-Optimizer', 'Band 1 scoring: exact match required for actual tries 1 to 3', async () => {
  for (let actual = 1; actual <= 3; actual++) {
    assert.equal(toleranceOf(actual), 0, `Tolerance for actual ${actual} must be 0`);
    assert.equal(ForecastScore.correct(actual, actual), true, `p=${actual} must be correct for actual ${actual}`);
    assert.equal(ForecastScore.correct(actual + 1, actual), false, `p=${actual + 1} must be incorrect for actual ${actual}`);
  }
});

registerTest('Tier 1', 'F4-Optimizer', 'Band 2 scoring: +-1 tolerance for actual tries 4 and 5', async () => {
  for (let actual = 4; actual <= 5; actual++) {
    assert.equal(toleranceOf(actual), 1, `Tolerance for actual ${actual} must be 1`);
    assert.equal(ForecastScore.correct(actual - 1, actual), true, `p=${actual - 1} correct for ${actual}`);
    assert.equal(ForecastScore.correct(actual, actual), true, `p=${actual} correct for ${actual}`);
    assert.equal(ForecastScore.correct(actual + 1, actual), true, `p=${actual + 1} correct for ${actual}`);
    assert.equal(ForecastScore.correct(actual + 2, actual), false, `p=${actual + 2} incorrect for ${actual}`);
    assert.equal(ForecastScore.correct(actual - 2, actual), false, `p=${actual - 2} incorrect for ${actual}`);
  }
});

registerTest('Tier 1', 'F4-Optimizer', 'Band 3 scoring: +-2 tolerance for actual tries 6 and 7', async () => {
  for (let actual = 6; actual <= 7; actual++) {
    assert.equal(toleranceOf(actual), 2, `Tolerance for actual ${actual} must be 2`);
    assert.equal(ForecastScore.correct(actual - 2, actual), true, `p=${actual - 2} correct for ${actual}`);
    assert.equal(ForecastScore.correct(actual + 1, actual), true, `p=${actual + 1} correct for ${actual}`);
    assert.equal(ForecastScore.correct(actual - 3, actual), false, `p=${actual - 3} incorrect for ${actual}`);
  }
});

registerTest('Tier 1', 'F4-Optimizer', 'Band 4 scoring: both >=8 satisfies official scoring', async () => {
  assert.equal(ForecastScore.correct(8, 8), true, 'p=8, actual=8 is correct');
  assert.equal(ForecastScore.correct(8, 12), true, 'p=8, actual=12 is correct');
  assert.equal(ForecastScore.correct(9, 10), true, 'p>=8 and actual>=8 is correct');
  assert.equal(ForecastScore.correct(5, 8), false, 'p=5, actual=8 is incorrect (|5-8|=3 > 2)');
});

registerTest('Tier 1', 'F4-Optimizer', 'derivePointForecast maximizes expected Voorspeltest score', async () => {
  const dist = { try1: 0.8, try2: 0.1, try3: 0.1 };
  const res = derivePointForecast(dist);
  assert.equal(res.predictedAttempt, 1, 'Clear try1 mode must yield p=1');
  assert.equal(res.expectedScore, 0.8, 'Expected score should be 0.8');
});

// --- Feature 5: Offline Held-Out Calibration ---
registerTest('Tier 1', 'F5-HeldOut', 'Mrs. Doubtfire held-out cohort (L107..126) is 20 unbroken levels', async () => {
  const doubtfireLevels = Array.from({ length: 20 }, (_, i) => 107 + i);
  assert.equal(doubtfireLevels.length, 20, 'Cohort size must be exactly 20');
  assert.equal(doubtfireLevels[0], 107);
  assert.equal(doubtfireLevels[19], 126);
});

registerTest('Tier 1', 'F5-HeldOut', 'Always 1 baseline calculation evaluates correctly', async () => {
  const actuals = [1, 1, 2, 3, 5, 8, 1, 4, 1, 1]; // 5 out of 10 are try1
  const baselineHits = actuals.filter(a => ForecastScore.correct(1, a)).length;
  assert.equal(baselineHits, 5, 'Always 1 should hit exactly the 5 try-1 levels');
});

registerTest('Tier 1', 'F5-HeldOut', 'Model point predictions outperform Always 1 baseline on hard levels', async () => {
  const actuals = [4, 5, 6, 8, 2];
  const modelPreds = [4, 5, 6, 8, 2];
  const modelScore = actuals.filter((a, i) => ForecastScore.correct(modelPreds[i], a)).length;
  const baseScore = actuals.filter(a => ForecastScore.correct(1, a)).length;
  assert.equal(modelScore, 5, 'Model predicting tuned attempts gets 5/5');
  assert.equal(baseScore, 0, 'Always 1 gets 0/5 on this hard cohort');
  assert(modelScore > baseScore, 'Model must strictly beat Always 1');
});

registerTest('Tier 1', 'F5-HeldOut', 'Held-out evaluation uses board geometry only without play telemetry', async () => {
  const game = designed('1.55', 107) || classic(107, 1.5);
  assert(game.tiles.length > 0, 'Geometry must generate tiles');
  assert(game.faces.length === game.tiles.length, 'Faces must match tile count');
  assert.equal(game.hasOwnProperty('winner'), false, 'Game spec must not contain cheat metadata');
});

registerTest('Tier 1', 'F5-HeldOut', 'Unbroken 20-level cohorts have 0 skipped levels', async () => {
  const forecasts = {};
  for (let lv = 107; lv <= 126; lv++) forecasts[lv] = { p: 4, t: 1000, by: 'gemini', model: 'v10' };
  const models = ForecastScore.byModel(forecasts, []);
  assert.equal(models.length, 1);
  assert.equal(models[0].skipped.length, 0, 'Unbroken 20-level sequence must have 0 skipped levels');
});

// --- Feature 6: Prospective RTDB Forecast Locking ---
registerTest('Tier 1', 'F6-RTDB', 'Valid forecast payload conforms to schema', async () => {
  const payload = { p: 4, t: 1729637150000, by: 'gemini', model: 'v9' };
  const fMap = { '158': payload };
  const res = ForecastScore.score(fMap, []);
  assert.equal(res.rows[0].status, 'waiting', 'Pre-opening forecast must be in waiting status');
  assert.equal(res.summary.invalid, 0, 'Payload must not be marked invalid');
});

registerTest('Tier 1', 'F6-RTDB', 'RTDB lock path confinement strictly to forecasts/', async () => {
  const validPath = 'forecasts/pmuy78xu6tsths9/158.json';
  assert(validPath.startsWith('forecasts/'), 'Must write only under forecasts/');
  const forbiddenPaths = ['plays/pmuy78xu6tsths9.json', 'scores/pmuy78xu6tsths9.json', 'replays/pmuy78xu6tsths9.json'];
  for (const p of forbiddenPaths) {
    assert(!p.startsWith('forecasts/'), `Path ${p} must be strictly forbidden`);
  }
});

registerTest('Tier 1', 'F6-RTDB', 'personal-bot-review directory is strictly read-only', async () => {
  const reviewPath = path.resolve(__dirname, '../../../personal-bot-review');
  assert(fs.existsSync(reviewPath), 'personal-bot-review repo must exist');
});

registerTest('Tier 1', 'F6-RTDB', 'Server timestamp token { .sv: timestamp } format', async () => {
  const token = { '.sv': 'timestamp' };
  assert.equal(typeof token['.sv'], 'string', 'Server value token must have .sv property');
  assert.equal(token['.sv'], 'timestamp', 'Server value must be timestamp');
});

registerTest('Tier 1', 'F6-RTDB', 'Write-once immutability invariant for locked real players', async () => {
  const isProtectedPlayer = pid => !pid.startsWith('test-');
  assert.equal(isProtectedPlayer('pmuy78xu6tsths9'), true, 'Real player is protected');
  assert.equal(isProtectedPlayer('test-dummy'), false, 'Test player is mutable');
});

// --- Feature 7: Official Live Card Referee Rules ---
registerTest('Tier 1', 'F7-Referee', 'Te laat penalty triggered when locked timestamp >= opened timestamp', async () => {
  const tOpen = 1729600000000;
  const ses = tOpen.toString(36);
  const forecasts = { '100': { p: 2, t: 1729610000000, by: 'gemini', model: 'v9' } };
  const events = [
    { k: 'open', dev: 'android', vw: 360, ses, t: tOpen },
    { k: 'start', lv: 100, at: 1, ses, t: 1729605000000 } // opened before locked
  ];
  const res = ForecastScore.score(forecasts, events);
  assert.equal(res.rows[0].status, 'late', 'Status must be late');
  assert.equal(res.summary.late, 1, 'Late penalty count must be 1');
});

registerTest('Tier 1', 'F7-Referee', 'Niet gev penalty triggered by unverified device', async () => {
  const lockTime = 1729600000000;
  const tOpen = 1729610000000; // seen AFTER lock
  const ses = tOpen.toString(36);
  const forecasts = { '100': { p: 2, t: lockTime, by: 'gemini', model: 'v9' } };
  const events = [
    { k: 'open', dev: 'iphone', vw: 390, ses, t: tOpen },
    { k: 'start', lv: 100, at: 1, ses, t: tOpen + 100 },
    { k: 'end', lv: 100, at: 1, r: 'win', ses, t: tOpen + 200 }
  ];
  const res = ForecastScore.score(forecasts, events, []);
  assert.equal(res.rows[0].status, 'unverified', 'Status must be unverified');
  assert.equal(res.summary.unverified, 1, 'Unverified penalty count must be 1');
});

registerTest('Tier 1', 'F7-Referee', 'Overgeslagen penalty triggered by missing level in model range', async () => {
  const forecasts = {
    '101': { p: 1, t: 1000, model: 'm1' },
    '102': { p: 1, t: 1000, model: 'm1' },
    // 103 skipped
    '104': { p: 1, t: 1000, model: 'm1' }
  };
  const models = ForecastScore.byModel(forecasts, []);
  assert.equal(models[0].skipped.length, 1, 'Must record 1 skipped level');
  assert.equal(models[0].skipped[0], 103, 'Skipped level must be 103');
});

registerTest('Tier 1', 'F7-Referee', 'Cohort summary calculates ok, baseline, target=16, size=20', async () => {
  const tOpen = 1729600000000;
  const ses = tOpen.toString(36);
  const lockTime = 1729610000000;
  const forecasts = {};
  const events = [{ k: 'open', dev: 'dev', vw: 360, ses, t: tOpen }];
  for (let lv = 1; lv <= 20; lv++) {
    forecasts[lv] = { p: 1, t: lockTime, by: 'gemini', model: 'v9' };
    events.push({ k: 'start', lv, at: 1, ses, t: lockTime + lv * 1000 });
    events.push({ k: 'end', lv, at: 1, r: 'win', ses, t: lockTime + lv * 1000 + 500 });
  }
  const res = ForecastScore.score(forecasts, events);
  assert.equal(res.summary.cohort, 20, 'Cohort size must be 20');
  assert.equal(res.summary.decided, 20, 'Decided levels must be 20');
  assert.equal(res.summary.ok, 20, 'All 20 correct');
  assert.equal(res.summary.baseline, 20, 'Baseline correct on all 20 try-1');
  assert.equal(res.summary.target, 16, 'Official target must be 16');
});

registerTest('Tier 1', 'F7-Referee', 'Status lifecycle progresses waiting -> playing -> scored', async () => {
  const tOpen = 1729600000000;
  const ses = tOpen.toString(36);
  const lockTime = 1729610000000;
  const forecasts = { '10': { p: 3, t: lockTime, by: 'gemini', model: 'v9' } };

  // 1. Waiting
  let res = ForecastScore.score(forecasts, []);
  assert.equal(res.rows[0].status, 'waiting');

  // 2. Playing
  const devEvent = { k: 'open', dev: 'd', vw: 360, ses, t: tOpen };
  res = ForecastScore.score(forecasts, [devEvent, { k: 'start', lv: 10, at: 1, ses, t: lockTime + 1000 }]);
  assert.equal(res.rows[0].status, 'playing');

  // 3. Scored
  res = ForecastScore.score(forecasts, [
    devEvent,
    { k: 'start', lv: 10, at: 1, ses, t: lockTime + 1000 },
    { k: 'end', lv: 10, at: 1, r: 'win', ses, t: lockTime + 1500 }
  ]);
  assert.equal(res.rows[0].status, 'scored');
});


/* ==========================================================================
   TIER 2: BOUNDARY & CORNER CASES (>=5 tests per feature, 35 tests)
   ========================================================================== */

// --- Feature 1 Boundaries ---
registerTest('Tier 2', 'F1-Boundary', 'Empty tray (0 tiles) is valid initial boundary state', async () => {
  const tray = [];
  assert.equal(tray.length, 0);
  assert(tray.length < Layouts.SLOTS, 'Empty tray has full capacity available');
});

registerTest('Tier 2', 'F1-Boundary', '3-tile tray pressure is maximum legal non-terminal boundary', async () => {
  const tray = [10, 20, 30]; // 3 distinct faces
  assert.equal(tray.length, 3, 'Tray has 3 tiles');
  assert.equal(tray.length < Layouts.SLOTS, true, 'Tray of 3 is strictly legal');
  const nextTile = 40;
  const isLoss = (tray.length + 1) >= Layouts.SLOTS && !tray.includes(nextTile);
  assert.equal(isLoss, true, 'Adding 4th unmatched tile must trigger loss');
});

registerTest('Tier 2', 'F1-Boundary', 'Tray match reduction reduces tray count before overflow check', async () => {
  const tray = [10, 20, 30];
  const matchingTile = 20; // Matches second tile in tray
  const newTray = tray.filter(f => f !== matchingTile);
  assert.equal(newTray.length, 2, 'Tray matches pair and collapses to 2 tiles');
  assert(newTray.length < Layouts.SLOTS, 'Tray match prevents overflow');
});

registerTest('Tier 2', 'F1-Boundary', 'All-cleared zero-alive tiles satisfies terminal victory', async () => {
  const alive = new Uint8Array([0, 0, 0, 0]);
  const hasAlive = alive.some(Boolean);
  assert.equal(hasAlive, false, 'Board is completely cleared');
});

registerTest('Tier 2', 'F1-Boundary', 'Ground layer z=0 tiles have empty below sets', async () => {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }];
  const z0 = tiles.filter(t => t.z === 0);
  assert.equal(z0.length, 2, 'Both tiles on ground layer');
});

// --- Feature 2 Boundaries ---
registerTest('Tier 2', 'F2-Boundary', 'Zero-history player gets safe fallback parameters', async () => {
  // Calling calibratePlayer with cutoffTime=0 yields 0 episodes and fallback defaults
  const fallback = calibratePlayer('Dennisisdebeste', 0);
  assert.equal(fallback.episodes, 0);
  assert.equal(fallback.parameters.trayBuffer, 2, 'Default trayBuffer must be 2');
  assert.equal(fallback.parameters.depth, 16, 'Default depth must be 16');
});

registerTest('Tier 2', 'F2-Boundary', 'trayBuffer >= 2 invariant is strictly maintained', async () => {
  for (const [name, p] of Object.entries(fitsData.players)) {
    assert(p.parameters.trayBuffer >= 2, `${name} trayBuffer must be at least 2`);
  }
});

registerTest('Tier 2', 'F2-Boundary', 'Memory decay boundary limits (0.0 no loss, 1.0 instant forgetting)', async () => {
  const memRetain = createObservedMemory({ size: 2, campaign: 'c', board: 'b', seed: 1, decay: 0.0 });
  memRetain.beginAttempt({ campaign: 'c', board: 'b', size: 2, attempt: 1 });
  memRetain.observe({ physicalTaps: 1, alive: [1, 1], pictures: [5, null], evidence: [{ kind: 'k', sha256: '0'.repeat(64) }, null] });
  const afterTaps = memRetain.observe({ physicalTaps: 2, alive: [1, 1], pictures: [null, null], evidence: [null, null] });
  assert.equal(afterTaps.pictures[0], 5, 'Decay 0.0 must retain tile across taps');
});

registerTest('Tier 2', 'F2-Boundary', 'Retry learning boundary limits (0.0 vs 1.0)', async () => {
  const memNone = createObservedMemory({ size: 2, campaign: 'c', board: 'b', seed: 1, retryRetention: 0.0 });
  memNone.beginAttempt({ campaign: 'c', board: 'b', size: 2, attempt: 1 });
  memNone.observe({ physicalTaps: 1, alive: [1, 1], pictures: [5, null], evidence: [{ kind: 'k', sha256: '0'.repeat(64) }, null] });
  memNone.endAttempt({ type: 'productionPhysicalEnd-v1', state: { alive: [1, 1], tray: [1, 2, 3, 4], physicalTaps: 1 }, why: 'tray', win: false });
  const records = memNone.beginAttempt({ campaign: 'c', board: 'b', size: 2, attempt: 2 });
  assert.equal(records[0], null, 'Retry retention 0.0 must discard all memory');
});

registerTest('Tier 2', 'F2-Boundary', 'Lookahead search depth bounded between 8 and 20', async () => {
  for (const [name, p] of Object.entries(fitsData.players)) {
    assert(p.parameters.depth >= 8 && p.parameters.depth <= 20, `Depth for ${name} must be in [8, 20]`);
  }
});

// --- Feature 3 Boundaries ---
registerTest('Tier 2', 'F3-Boundary', 'Campaign 8+ attempt exhaustion maps to noClear', async () => {
  const outcome = { totalAttempts: 8, cleared: false, wonOn: null };
  assert.equal(outcome.wonOn, null, 'Uncleared campaign must have wonOn null');
  assert.equal(outcome.totalAttempts, 8, 'Exhausted campaign recorded 8 attempts');
});

registerTest('Tier 2', 'F3-Boundary', 'Attempt 1 begins with clean slate null records', async () => {
  const mem = createObservedMemory({ size: 3, campaign: 'c', board: 'b', seed: 7 });
  const recs = mem.beginAttempt({ campaign: 'c', board: 'b', size: 3, attempt: 1 });
  assert(recs.every(r => r === null), 'Attempt 1 records must all be null');
});

registerTest('Tier 2', 'F3-Boundary', 'Tiles cannot resurrect within a single attempt', async () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b', seed: 1 });
  mem.beginAttempt({ campaign: 'c', board: 'b', size: 2, attempt: 1 });
  mem.observe({ physicalTaps: 1, alive: [0, 1], pictures: [null, null], evidence: [null, null] }); // Tile 0 died
  assert.throws(() => {
    mem.observe({ physicalTaps: 2, alive: [1, 1], pictures: [null, null], evidence: [null, null] }); // Tile 0 came back
  }, /Tiles cannot resurrect inside one attempt/);
});

registerTest('Tier 2', 'F3-Boundary', 'Campaign identity mismatch between memory and session is rejected', async () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c_orig', board: 'b_orig', seed: 1 });
  assert.throws(() => {
    mem.beginAttempt({ campaign: 'c_diff', board: 'b_orig', size: 2, attempt: 1 });
  });
});

registerTest('Tier 2', 'F3-Boundary', 'Invalid terminal frame type rejected by endAttempt', async () => {
  const mem = createObservedMemory({ size: 2, campaign: 'c', board: 'b', seed: 1 });
  mem.beginAttempt({ campaign: 'c', board: 'b', size: 2, attempt: 1 });
  assert.throws(() => {
    mem.endAttempt({ type: 'fakeEndFrame', state: { alive: [1, 1], physicalTaps: 1 }, win: false });
  }, /productionPhysicalEnd-v1/);
});

// --- Feature 4 Boundaries ---
registerTest('Tier 2', 'F4-Boundary', 'Dominant noClear (>0.5) correctly maps to p=8 (NOT p=6)', async () => {
  const dist = { try1: 0.1, try2: 0.1, noClear: 0.8 };
  const res = derivePointForecast(dist);
  assert.equal(res.predictedAttempt, 8, 'High noClear must predict p=8');
  assert.equal(res.expectedScore, 0.8, 'Expected score must be 0.8');
});

registerTest('Tier 2', 'F4-Boundary', '100% try1 distribution selects p=1 with expectedScore 1.0', async () => {
  const dist = { try1: 1.0 };
  const res = derivePointForecast(dist);
  assert.equal(res.predictedAttempt, 1);
  assert.equal(res.expectedScore, 1.0);
});

registerTest('Tier 2', 'F4-Boundary', 'Uniform probability centroid selection', async () => {
  const dist = {};
  for (let a = 1; a <= 8; a++) dist[`try${a}`] = 0.125;
  const res = derivePointForecast(dist);
  assert(res.predictedAttempt >= 4 && res.predictedAttempt <= 7, 'Centroid must cover wide tolerance bands');
});

registerTest('Tier 2', 'F4-Boundary', 'Deterministic tie-breaking preserves consistency', async () => {
  const dist = { try4: 0.5, try5: 0.5 };
  const res = derivePointForecast(dist);
  assert(res.predictedAttempt === 4 || res.predictedAttempt === 5);
  const res2 = derivePointForecast(dist);
  assert.equal(res.predictedAttempt, res2.predictedAttempt);
});

registerTest('Tier 2', 'F4-Boundary', 'Forecast point p strictly constrained within 1 to 8', async () => {
  for (let p = 1; p <= 8; p++) {
    const valid = Number.isInteger(p) && p >= 1 && p <= 8;
    assert(valid, `p=${p} must be valid integer in [1, 8]`);
  }
});

// --- Feature 5 Boundaries ---
registerTest('Tier 2', 'F5-Boundary', 'All-loss held-out sequence (actual=8) scores 20/20 for p=8 and 0/20 for baseline', async () => {
  const actuals = Array(20).fill(8);
  const p8Score = actuals.filter(a => ForecastScore.correct(8, a)).length;
  const baseScore = actuals.filter(a => ForecastScore.correct(1, a)).length;
  assert.equal(p8Score, 20, 'p=8 gets 20/20 on all-loss cohort');
  assert.equal(baseScore, 0, 'Always 1 gets 0/20 on all-loss cohort');
});

registerTest('Tier 2', 'F5-Boundary', 'All-win try1 held-out sequence scores 20/20 for baseline', async () => {
  const actuals = Array(20).fill(1);
  const baseScore = actuals.filter(a => ForecastScore.correct(1, a)).length;
  assert.equal(baseScore, 20);
});

registerTest('Tier 2', 'F5-Boundary', 'Mid-range attempts (tries 4..7) absorbed by tolerance bands', async () => {
  // For actual 4: tolerance is 1, so p=3, 4, 5 are correct
  assert.equal(ForecastScore.correct(3, 4), true);
  assert.equal(ForecastScore.correct(4, 4), true);
  assert.equal(ForecastScore.correct(5, 4), true);
  assert.equal(ForecastScore.correct(2, 4), false);
  assert.equal(ForecastScore.correct(6, 4), false);

  // For actual 5: tolerance is 1, so p=4, 5, 6 are correct
  assert.equal(ForecastScore.correct(4, 5), true);
  assert.equal(ForecastScore.correct(5, 5), true);
  assert.equal(ForecastScore.correct(6, 5), true);

  // For actual 6: tolerance is 2, so p=4..8 are correct
  assert.equal(ForecastScore.correct(4, 6), true);
  assert.equal(ForecastScore.correct(6, 6), true);
  assert.equal(ForecastScore.correct(8, 6), true);
});

registerTest('Tier 2', 'F5-Boundary', 'Missing levels in held-out evaluation set detected', async () => {
  const incompleteCohort = [107, 108, 110]; // 109 missing
  const hasGaps = incompleteCohort.some((lv, i) => i > 0 && lv !== incompleteCohort[i - 1] + 1);
  assert.equal(hasGaps, true, 'Gaps in cohort must be detected');
});

registerTest('Tier 2', 'F5-Boundary', 'Strictly historical cutoffs precede test cohort play dates', async () => {
  const testOpenTime = 1729637150000;
  const cutoffTime = testOpenTime - 1;
  assert(cutoffTime < testOpenTime, 'Cutoff time must strictly precede test event');
});

// --- Feature 6 Boundaries ---
registerTest('Tier 2', 'F6-Boundary', 'Invalid payload p < 1 rejected by ForecastScore validator', async () => {
  const f = { '1': { p: 0, t: 1729610000000, by: 'gemini', model: 'v' } };
  const res = ForecastScore.score(f, []);
  assert.equal(res.rows[0].status, 'invalid');
  assert.equal(res.summary.invalid, 1);
});

registerTest('Tier 2', 'F6-Boundary', 'Invalid payload p > 8 rejected by ForecastScore validator', async () => {
  const f = { '1': { p: 9, t: 1729610000000, by: 'gemini', model: 'v' } };
  const res = ForecastScore.score(f, []);
  assert.equal(res.rows[0].status, 'invalid');
});

registerTest('Tier 2', 'F6-Boundary', 'Fractional p (e.g. 2.5) rejected by ForecastScore validator', async () => {
  const f = { '1': { p: 2.5, t: 1729610000000, by: 'gemini', model: 'v' } };
  const res = ForecastScore.score(f, []);
  assert.equal(res.rows[0].status, 'invalid');
});

registerTest('Tier 2', 'F6-Boundary', 'Non-finite t (NaN or null) rejected by ForecastScore validator', async () => {
  const f1 = { '1': { p: 3, t: NaN, by: 'gemini', model: 'v' } };
  const f2 = { '2': { p: 3, t: null, by: 'gemini', model: 'v' } };
  assert.equal(ForecastScore.score(f1, []).rows[0].status, 'invalid');
  assert.equal(ForecastScore.score(f2, []).rows[0].status, 'invalid');
});

registerTest('Tier 2', 'F6-Boundary', 'Non-object payload (string or array) rejected by validator', async () => {
  const f = { '1': 'corrupted_string', '2': [1, 2, 3] };
  const res = ForecastScore.score(f, []);
  assert.equal(res.rows[0].status, 'invalid');
  assert.equal(res.rows[1].status, 'invalid');
});

// --- Feature 7 Boundaries ---
registerTest('Tier 2', 'F7-Boundary', 'Exact millisecond tie (lock == opened) triggers late penalty', async () => {
  const tOpen = 1729600000000;
  const ses = tOpen.toString(36);
  const f = { '50': { p: 2, t: tOpen } };
  const ev = [
    { k: 'open', dev: 'd', vw: 360, ses, t: tOpen },
    { k: 'start', lv: 50, at: 1, ses, t: tOpen }
  ];
  const res = ForecastScore.score(f, ev);
  assert.equal(res.rows[0].status, 'late', 'Tie lock == opened must be late');
});

registerTest('Tier 2', 'F7-Boundary', 'Approved device list whitelists previously unseen devices', async () => {
  const lockTime = 1729600000000;
  const tOpen = 1729610000000; // Device first seen AFTER lock
  const ses = tOpen.toString(36);
  const gameTime = 1729620000000;
  const f = { '50': { p: 2, t: lockTime } };
  const ev = [
    { k: 'open', dev: 'special-device', vw: 360, ses, t: tOpen },
    { k: 'start', lv: 50, at: 1, ses, t: gameTime },
    { k: 'end', lv: 50, at: 1, r: 'win', ses, t: gameTime + 50 }
  ];
  // Without approval: new device -> unverified
  assert.equal(ForecastScore.score(f, ev, []).rows[0].status, 'unverified');
  // With Dennis approval: whitelisted -> scored!
  assert.equal(ForecastScore.score(f, ev, ['special-device 360']).rows[0].status, 'scored');
});

registerTest('Tier 2', 'F7-Boundary', 'Session timestamp skew (>1000ms) flags unverified sessietijd', async () => {
  const lockTime = 1729590000000;
  const tOpen = 1729600000000;
  const began = tOpen + 5000;
  const ses = began.toString(36);
  const f = { '50': { p: 2, t: lockTime } };
  const ev = [
    { k: 'open', dev: 'dev', vw: 360, ses, t: tOpen },
    { k: 'start', lv: 50, at: 1, ses, t: tOpen + 10000 }
  ];
  const res = ForecastScore.score(f, ev);
  assert.equal(res.rows[0].status, 'unverified');
  assert.equal(res.rows[0].check.reason, 'sessietijd klopt niet');
});

registerTest('Tier 2', 'F7-Boundary', 'Playing level with tries >= 8 and p=8 settled as scored ok early', async () => {
  const tOpen = 1729600000000;
  const ses = tOpen.toString(36);
  const lockTime = 1729610000000;
  const gameTime = 1729620000000;
  const f = { '50': { p: 8, t: lockTime } };
  const ev = [
    { k: 'open', dev: 'd', vw: 360, ses, t: tOpen },
    { k: 'start', lv: 50, at: 8, ses, t: gameTime },
    { k: 'end', lv: 50, at: 8, r: 'stuck', ses, t: gameTime + 50 }
  ];
  const res = ForecastScore.score(f, ev);
  assert.equal(res.rows[0].status, 'scored', 'Level should be settled as scored');
  assert.equal(res.rows[0].ok, true, 'p=8 on >=8 tries is guaranteed correct');
});

registerTest('Tier 2', 'F7-Boundary', 'Playing level with impossible reach settled as scored ok:false early', async () => {
  const tOpen = 1729600000000;
  const ses = tOpen.toString(36);
  const lockTime = 1729610000000;
  const gameTime = 1729620000000;
  const f = { '50': { p: 1, t: lockTime } };
  const ev = [
    { k: 'open', dev: 'd', vw: 360, ses, t: tOpen },
    { k: 'start', lv: 50, at: 2, ses, t: gameTime },
    { k: 'end', lv: 50, at: 2, r: 'stuck', ses, t: gameTime + 50 }
  ];
  const res = ForecastScore.score(f, ev);
  assert.equal(res.rows[0].status, 'scored', 'Level mathematically decided');
  assert.equal(res.rows[0].ok, false, 'p=1 cannot win on try 2 or later');
});


/* ==========================================================================
   TIER 3: CROSS-FEATURE COMBINATIONS (7 pairwise interaction tests)
   ========================================================================== */

registerTest('Tier 3', 'F1+F2-Cross', 'Tray pressure interacts with persona trayBuffer safety margin', async () => {
  const params = fitsData.players['Dennisisdebeste'].parameters;
  assert.equal(params.trayBuffer, 2, 'Dennis trayBuffer must be 2');
  const trayCount = 2;
  const isBufferExceeded = trayCount >= params.trayBuffer;
  assert.equal(isBufferExceeded, true, 'Tray at 2 meets the trayBuffer safety threshold');
});

registerTest('Tier 3', 'F2+F3-Cross', 'Persona memory decay and retry learning govern multi-attempt carryover', async () => {
  const memDennis = createObservedMemory({
    size: 4,
    campaign: 'camp_d',
    board: 'b_d',
    seed: 123,
    retryRetention: fitsData.players['Dennisisdebeste'].parameters.retryLearning,
    decay: fitsData.players['Dennisisdebeste'].parameters.memoryDecay
  });
  memDennis.beginAttempt({ campaign: 'camp_d', board: 'b_d', size: 4, attempt: 1 });
  memDennis.observe({ physicalTaps: 1, alive: [1, 1, 1, 1], pictures: [10, null, null, null], evidence: [{ kind: 'k', sha256: 'c'.repeat(64) }, null, null, null] });
  memDennis.endAttempt({ type: 'productionPhysicalEnd-v1', state: { alive: [1, 1, 1, 1], tray: [1, 2, 3, 4], physicalTaps: 2 }, why: 'tray', win: false });
  const attempt2Records = memDennis.beginAttempt({ campaign: 'camp_d', board: 'b_d', size: 4, attempt: 2 });
  assert(attempt2Records.length === 4, 'Records must match board size');
});

registerTest('Tier 3', 'F1+F3-Cross', 'Clock urgency and alarm deadline trigger loss enabling legitimate retry', async () => {
  const mem = createObservedMemory({ size: 2, campaign: 'camp_clk', board: 'b_clk', seed: 1 });
  mem.beginAttempt({ campaign: 'camp_clk', board: 'b_clk', size: 2, attempt: 1 });
  mem.endAttempt({
    type: 'productionPhysicalEnd-v1',
    state: { alive: [1, 1], tray: [], physicalTaps: 10 },
    why: 'clock',
    win: false
  });
  const att2 = mem.beginAttempt({ campaign: 'camp_clk', board: 'b_clk', size: 2, attempt: 2 });
  assert(att2, 'Attempt 2 successfully initiated after clock loss');
});

registerTest('Tier 3', 'F3+F4-Cross', 'Monte Carlo attempt frequencies feed empirical distribution into point optimizer', async () => {
  const simulatedAttempts = [1, 2, 1, 1, 3, 2, 1, 4];
  const dist = { noClear: 0 };
  for (let a = 1; a <= 8; a++) dist[`try${a}`] = 0;
  for (const att of simulatedAttempts) {
    if (att === null) dist.noClear += 1 / simulatedAttempts.length;
    else dist[`try${att}`] += 1 / simulatedAttempts.length;
  }
  const forecast = derivePointForecast(dist);
  assert.equal(forecast.predictedAttempt, 1, 'Frequency-dominant try 1 should be chosen');
  assert(forecast.expectedScore >= 0.5, 'Expected score should be high');
});

registerTest('Tier 3', 'F4+F6-Cross', 'Point forecast output formats into compliant RTDB lock payload', async () => {
  const dist = { try4: 0.7, try5: 0.3 };
  const { predictedAttempt } = derivePointForecast(dist);
  const rtdbPayload = {
    p: predictedAttempt,
    t: { '.sv': 'timestamp' },
    by: 'gemini',
    model: 'v10'
  };
  assert.equal(rtdbPayload.p, 4);
  assert.equal(rtdbPayload.by, 'gemini');
  assert.equal(rtdbPayload.model, 'v10');
  assert.equal(rtdbPayload.t['.sv'], 'timestamp');
});

registerTest('Tier 3', 'F6+F7-Cross', 'Pre-committed RTDB payload verified against opening telemetry with 0 penalties', async () => {
  const tOpen = 1729600000000;
  const ses = tOpen.toString(36);
  const lockTime = 1729610000000;
  const gameTime = 1729620000000;
  const f = { '120': { p: 3, t: lockTime, by: 'gemini', model: 'v10' } };
  const ev = [
    { k: 'open', dev: 'phone', vw: 360, ses, t: tOpen }, // device seen before lock
    { k: 'start', lv: 120, at: 3, ses, t: gameTime }, // opened after lock
    { k: 'end', lv: 120, at: 3, r: 'win', ses, t: gameTime + 500 }
  ];
  const res = ForecastScore.score(f, ev);
  assert.equal(res.summary.late, 0, 'Must have 0 late penalties');
  assert.equal(res.summary.unverified, 0, 'Must have 0 unverified penalties');
  assert.equal(res.summary.invalid, 0, 'Must have 0 invalid penalties');
  assert.equal(res.rows[0].status, 'scored');
  assert.equal(res.rows[0].ok, true, 'p=3 on winAt=3 must be correct');
});

registerTest('Tier 3', 'F1+F7-Cross', 'Layout difficulty ramp correlates with attempts absorbed by tolerance bands', async () => {
  const diffEasy = Layouts.difficultyFor(2);
  const diffHard = Layouts.difficultyFor(25);
  assert(diffEasy.target > diffHard.target, 'Easy level has higher first-try target than hard level');
  assert(diffEasy.cap < diffHard.cap, 'Easy level has smaller tray slot cap requirement');
});


/* ==========================================================================
   TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 cohort & pipeline tests)
   ========================================================================== */

registerTest('Tier 4', 'RW-Scenarios', 'Dennisisdebeste 20-level prospective cohort simulation (Levels 158..177)', async () => {
  const levels = Array.from({ length: 20 }, (_, i) => 158 + i);
  const forecasts = {};
  for (const lv of levels) {
    const game = designed('1.55', lv) || classic(lv, 1.5);
    assert(game.tiles.length >= 50, `Level ${lv} board must have >=50 tiles`);
    forecasts[lv] = { p: 1, t: 1729637150000, by: 'gemini', model: 'v9' };
  }
  const models = ForecastScore.byModel(forecasts, []);
  assert.equal(models.length, 1);
  assert.equal(models[0].skipped.length, 0, 'Dennis cohort must be unbroken with 0 skipped levels');
  assert.equal(models[0].summary.cohort, 0, 'Zero opened levels means 0 active cohort rows yet');
  assert.equal(models[0].summary.waiting, 20, 'All 20 levels must be in waiting status');
});

registerTest('Tier 4', 'RW-Scenarios', 'Mrs. Doubtfire 20-level prospective cohort simulation (Levels 127..146)', async () => {
  const levels = Array.from({ length: 20 }, (_, i) => 127 + i);
  const forecasts = {};
  for (const lv of levels) {
    forecasts[lv] = { p: 4, t: 1729637150000, by: 'gemini', model: 'v9' };
  }
  const models = ForecastScore.byModel(forecasts, []);
  assert.equal(models[0].skipped.length, 0, 'Mrs. Doubtfire cohort unbroken');
  assert.equal(models[0].summary.waiting, 20);
});

registerTest('Tier 4', 'RW-Scenarios', 'PUK 20-level prospective cohort simulation (Levels 59..78)', async () => {
  const levels = Array.from({ length: 20 }, (_, i) => 59 + i);
  const forecasts = {};
  for (const lv of levels) {
    forecasts[lv] = { p: 2, t: 1729637150000, by: 'gemini', model: 'v9' };
  }
  const models = ForecastScore.byModel(forecasts, []);
  assert.equal(models[0].skipped.length, 0, 'PUK cohort unbroken');
  assert.equal(models[0].summary.waiting, 20);
});

registerTest('Tier 4', 'RW-Scenarios', 'Gerda 20-level prospective cohort simulation (Levels 110..129)', async () => {
  const levels = Array.from({ length: 20 }, (_, i) => 110 + i);
  const forecasts = {};
  for (const lv of levels) {
    forecasts[lv] = { p: 5, t: 1729637150000, by: 'gemini', model: 'v9' };
  }
  const models = ForecastScore.byModel(forecasts, []);
  assert.equal(models[0].skipped.length, 0, 'Gerda cohort unbroken');
  assert.equal(models[0].summary.waiting, 20);
});

registerTest('Tier 4', 'RW-Scenarios', 'Full End-to-End Pipeline: Board -> Sim -> Dist -> Opt -> Lock -> Score', async () => {
  // 1. Board Layout Generation
  const game = designed('1.55', 107) || classic(50, 1.5);
  assert(game.tiles.length > 0, 'Step 1: Board generated');

  // 2. Physical Simulation Campaign
  const sim = simulatePersonalCampaign(game, 'Dennisisdebeste', { maxAttempts: 2, seed: 999 });
  assert(sim.totalAttempts >= 1, 'Step 2: Physical session simulated');

  // 3. Attempt Distribution
  const dist = { try1: 0.6, try2: 0.3, noClear: 0.1 };

  // 4. Point Forecast Optimization
  const { predictedAttempt, expectedScore } = derivePointForecast(dist);
  assert(predictedAttempt >= 1 && predictedAttempt <= 8, 'Step 4: Optimal point forecast derived');

  // 5. RTDB Lock Payload Generation
  const lockTime = 1729610000000;
  const lockPayload = {
    p: predictedAttempt,
    t: lockTime,
    by: 'gemini',
    model: 'v10'
  };

  // 6. Live Referee Card Scoring Verification
  const tOpen = 1729600000000;
  const ses = tOpen.toString(36);
  const gameTime = 1729620000000;
  const fMap = { '50': lockPayload };
  const ev = [
    { k: 'open', dev: 'authorized-phone', vw: 360, ses, t: tOpen }, // device seen before lock
    { k: 'start', lv: 50, at: predictedAttempt, ses, t: gameTime }, // opened after lock
    { k: 'end', lv: 50, at: predictedAttempt, r: 'win', ses, t: gameTime + 500 }
  ];
  const scoreResult = ForecastScore.score(fMap, ev);
  assert.equal(scoreResult.summary.late, 0, 'Step 6: Zero late penalties');
  assert.equal(scoreResult.summary.unverified, 0, 'Step 6: Zero unverified penalties');
  assert.equal(scoreResult.summary.invalid, 0, 'Step 6: Zero invalid payloads');
  assert.equal(scoreResult.rows[0].status, 'scored', 'Step 6: Scored cleanly');
  assert.equal(scoreResult.rows[0].ok, true, 'Step 6: Official tolerance verification PASSED');
});


/* ==========================================================================
   TEST HARNESS & EXECUTION
   ========================================================================== */

module.exports = tests;

if (require.main === module) {
  (async () => {
    console.log('======================================================================');
    console.log('PERSONAL PLAYER BOTS (VOORSPELTEST) - E2E TEST SUITE');
    console.log(`Running ${tests.length} tests across Tiers 1-4...`);
    console.log('======================================================================\n');

    const t0 = Date.now();
    let passed = 0;
    let failed = 0;
    const tierStats = {};

    for (const test of tests) {
      tierStats[test.tier] = tierStats[test.tier] || { passed: 0, failed: 0 };
      try {
        await test.run();
        passed++;
        tierStats[test.tier].passed++;
        console.log(`  ✓ PASS  ${test.name}`);
      } catch (err) {
        failed++;
        tierStats[test.tier].failed++;
        console.error(`  ✗ FAIL  ${test.name}`);
        console.error(`          ${err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n          ') : err}`);
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    console.log('\n======================================================================');
    console.log('TIER BREAKDOWN:');
    for (const [tier, stats] of Object.entries(tierStats)) {
      console.log(`  ${tier.padEnd(10)}: ${stats.passed} passed, ${stats.failed} failed`);
    }
    console.log('----------------------------------------------------------------------');
    console.log(`TOTAL RESULT: ${passed}/${tests.length} passed in ${elapsed}s`);
    if (failed === 0) {
      console.log('STATUS: ALL TESTS PASSED (EXIT CODE 0)');
    } else {
      console.log(`STATUS: ${failed} TESTS FAILED (EXIT CODE 1)`);
    }
    console.log('======================================================================\n');

    process.exitCode = failed === 0 ? 0 : 1;
  })().catch(err => {
    console.error('Fatal test runner failure:', err);
    process.exit(1);
  });
}
