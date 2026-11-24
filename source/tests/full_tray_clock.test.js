'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { canReachWithin, fullTrayFailure, winningFullTrayFailure, trayOnWay, LAYOUTS } = require('../tools/builder/builder');
const E = require('../tools/builder/engine');
const { build } = require('../tools/builder/trap_mixes');
const { compact } = require('../tools/builder/compact_footprint');
const { design: centerCover } = require('../analysis/builder/hand/round999/a-center-cover.json');
const { design: twoClockRoutes } = require('../analysis/builder/hand/round999/b-two-clock-routes.json');

test('the full-tray check detects the bypass even when the stored route fills the tray', () => {
  assert.equal(trayOnWay(twoClockRoutes, twoClockRoutes.solution).max, 3);
  assert.equal(fullTrayFailure(twoClockRoutes), 'lowPressureClockRoute');
});

test('the full-tray check accepts a proven need and identifies exhausted proof', () => {
  assert.equal(fullTrayFailure(centerCover), null);
  assert.equal(fullTrayFailure(centerCover, 0), 'fullTrayUnproven');
});

test('an on-time clock can hide a loss even when the tray has room', () => {
  const { design } = require('../analysis/builder/bank/repeat-pressure-300/level-320.json');
  const game = E.game(design);
  const earlyClock = E.step(game, E.start(game), design.clock.i);
  assert.equal(earlyClock.clockTaken, true);
  assert.equal(earlyClock.tray.length, 1);
  assert.equal(E.winnable(game, earlyClock).result, 'lose');
  assert.equal(E.replay(design, design.solution).ok, true);
  assert.equal(fullTrayFailure(design), 'lowPressureClockRoute');
  assert.equal(winningFullTrayFailure(design), null);
  assert.equal(winningFullTrayFailure(design, 8), 'fullTrayUnproven');
  assert.equal(winningFullTrayFailure(twoClockRoutes), 'lowPressureWinningRoute');
});

test('the winning-route proof budget is independent of earlier searches', () => {
  const { design } = require('../analysis/builder/bank/repeat-pressure-300/level-320.json');
  const board = { ...design };
  const limited = winningFullTrayFailure(board, 1800);
  assert.equal(limited, 'fullTrayUnproven');
  assert.equal(winningFullTrayFailure(board), null);
  assert.equal(winningFullTrayFailure(board, 1800), limited);
});

test('the win-aware search permits a clock pair that starts on the last move', () => {
  const design = {
    tiles: [[0, 0, 0], [4, 0, 0]], faces: [0, 0], down: [1], clock: { i: 1, n: 1 },
  };
  assert.equal(canReachWithin(design, 0, 20, { requireWin: true }), 'yes');
  assert.equal(canReachWithin({ ...design, down: [] }, 0, 20, { requireWin: true }), 'no');
});

test('the chained builder can use the existing six-wide layout catalogue', () => {
  assert.equal(build('pairedFalseMelt', { layout: 1006 }, { tries: 0 }).fail, 'noProvenMix');
});

test('a layout above the ordinary tile-size floor can keep its original geometry', () => {
  const design = { tiles: LAYOUTS[23].tiles };
  const result = compact({ design, brief: { targets: { ordinaryTileFloor: true } } }, { wallMs: -1 });
  assert.equal(result.footprint.ok, true);
  assert.equal(result.footprint.changed, false);
  assert.strictEqual(result.design, design);
});
