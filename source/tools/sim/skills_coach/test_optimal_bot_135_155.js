'use strict';
/**
 * Verification Test: Optimal Bot vs Dennis Historical Performance (Levels 135 to 155).
 *
 * Success Criteria:
 * - For all 21 levels (135 through 155 inclusive):
 *   bot_attempts <= dennis_attempts
 * - Strict adherence to human visibility (no cheating / foresight on face-down tiles).
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { designed } = require('../refit/boards.js');
const { createOptimalBot } = require('./optimal_bot.js');

const TARGETS = {
  135: 1, 136: 1, 137: 2, 138: 1, 139: 3, 140: 1,
  141: 1, 142: 1, 143: 1, 144: 1, 145: 1, 146: 1,
  147: 1, 148: 1, 149: 2, 150: 3, 151: 2, 152: 2,
  153: 1, 154: 3, 155: 1
};

function runVerification() {
  console.log('================================================================================');
  console.log('       OPTIMAL BOT VS DENNIS BENCHMARK: LEVELS 135 THROUGH 155');
  console.log('================================================================================\n');

  const bot = createOptimalBot();
  let passedCount = 0;
  const rows = [];

  for (let lv = 135; lv <= 155; lv++) {
    const version = lv <= 141 ? '1.57' : '1.58';
    const g = designed(version, lv);
    assert(g, `Board for Level ${lv} (v${version}) must exist`);

    const t0 = Date.now();
    const res = bot.play(g);
    const elapsedMs = Date.now() - t0;

    const dennisTarget = TARGETS[lv];
    const botAttempts = res.win ? 1 : Infinity;
    const isPassing = res.win && botAttempts <= dennisTarget;

    if (isPassing) passedCount++;

    rows.push({
      level: lv,
      version,
      tiles: g.tiles.length,
      hasClock: !!g.clock,
      moves: res.moves,
      solver: res.solver || 'greedy',
      botAttempts,
      dennisAttempts: dennisTarget,
      status: isPassing ? 'PASS' : 'FAIL',
      elapsedMs
    });

    console.log(
      `  Lv ${String(lv).padStart(3)} | Tiles: ${String(g.tiles.length).padStart(2)} | ` +
      `Clock: ${g.clock ? 'Yes' : ' No'} | Solver: ${String(res.solver).padEnd(6)} | ` +
      `Moves: ${String(res.moves).padStart(2)} | Bot: ${botAttempts} att | ` +
      `Dennis: ${dennisTarget} att | ${isPassing ? '[PASS]' : '[FAIL]'} (${elapsedMs}ms)`
    );
  }

  console.log('\n--------------------------------------------------------------------------------');
  console.log(`SUMMARY: ${passedCount} / ${Object.keys(TARGETS).length} Levels Passed Success Criterion (bot_attempts <= dennis_attempts)`);
  console.log('--------------------------------------------------------------------------------\n');

  assert.equal(passedCount, 21, 'All 21 levels (135 to 155) must succeed on or before Dennis attempts');

  return rows;
}

if (require.main === module) {
  runVerification();
}

module.exports = {
  runVerification,
  TARGETS
};
