'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { canReachWithin, fullTrayFailure, winningFullTrayFailure, trayOnWay, LAYOUTS } = require('../tools/builder/builder');
const E = require('../tools/builder/engine');
const { build } = require('../tools/builder/trap_mixes');
const { compact } = require('../tools/builder/compact_footprint');
const { design: centerCover } = require('../analysis/builder/hand/round999/a-center-cover.json');
const { design: twoClockRoutes } = require('../analysis/builder/hand/round999/b-two-clock-routes.json');

test('chained opening acceptance rejects winning shortcuts and permits a losing early clock', () => {
  const { openingFailure } = require('../tools/builder/bank/choice_checks');
  const { design: early } = require('../analysis/builder/bank/repeat-pressure-300/level-320.json');
  const { design: sweep } = require('../analysis/builder/bank/earned-tray/keys.json');
  assert.equal(openingFailure(early, { requireWinningFullTray: true }), null);
  assert.equal(openingFailure(twoClockRoutes, { requireWinningFullTray: true }), 'lowPressureWinningRoute');
  assert.equal(openingFailure(sweep, { rejectOpeningSweep: true }), 'winningOpeningSweep');
  assert.equal(openingFailure(sweep, {}), null);
});

test('clock forks distinguish visible decoys from a second winning action', () => {
  const { auditClockForks, openingFailure } = require('../tools/builder/bank/choice_checks');
  const design = {
    tiles: [[0,0,0], [2,0,0], [1,0,1], [0,4,0], [6,0,0], [6,4,0]],
    faces: [0,2,0,1,1,2], down: [], clock: { i: 0, n: 3 }, solution: [2,0,4,3,1,5],
  };
  const report = auditClockForks(design);
  assert.equal(report.fail, 'clockForkMultipleWins');
  assert.ok(report.steps.find(step => step.winning.length > 1));
  assert.equal(openingFailure(design, { clockForks: true }), 'clockForkMultipleWins');
});

test('a winning peek pair counts as another choice in the clock route audit', () => {
  const { auditClockForks } = require('../tools/builder/bank/choice_checks');
  const design = {
    tiles: [[0,0,0], [4,0,0]], faces: [0,0], down: [1],
    clock: { i: 0, n: 1 }, solution: [0,1],
  };
  const report = auditClockForks(design);
  assert.equal(report.fail, 'clockForkMultipleWins');
  assert.deepEqual(report.steps[0].winning, [0, { pair: [0,1] }]);
});

test('the finish sample can start after a certified post-clock obstacle has been cleared', () => {
  const { expert } = require('../tools/builder/bank/feel');
  const { resolutionTiles, targetFor, meets } = require('../tools/builder/chained_finish_profiles');
  const { design } = require('../analysis/builder/bank/repeat-pressure-300/level-328.json');
  const opts = { playouts: 16, seed: 9, wrong: false };
  assert.equal(meets(targetFor('existing'), expert(design, opts)), false);

  const tile = design.solution.at(-4);
  const afterTiles = resolutionTiles({ effects: [
    { tile: design.clock.i, by: 'clockRoute' }, { tile, by: 'tailFork' },
  ] });
  assert.deepEqual(afterTiles, [tile]);
  const late = expert(design, { ...opts, afterTiles });
  assert.equal(late.games, opts.playouts);
  assert.ok(late.decisions <= 3);
  assert.equal(late.lostGames, 0);
});

test('a declared second act sets the finish checkpoint even when its effect is also on the clock', () => {
  const { measure } = require('../tools/builder/chained_finish_profiles');
  const { design, card } = require('../analysis/builder/bank/variety-v1/examples/secondActIce-L36-s1-p1.json');
  const effects = card.trap.effects.map(effect => ({ ...effect, by: 'clockRoute' }));
  const { finishVerification } = measure(design, { ...card.trap, effects }, true);
  assert.deepEqual(finishVerification.afterTiles, [card.trap.mechanism.added]);
  assert.equal(finishVerification.afterMove, design.solution.indexOf(card.trap.mechanism.added) + 1);
  assert.ok(finishVerification.afterMove > design.solution.indexOf(design.clock.i) + 1);
});

test('the catalogue checks distinguish a fitted ten from unsupported stock geometry', () => {
  const F = require('../tools/builder/footprint');
  const { design } = require('../analysis/builder/bank/repeat-pressure-300/level-330.json');
  const brief = { targets: { bigTileFloor: true, ordinaryTileFloor: true, requireSupportedLayout: true } };
  assert.equal(F.measureForBuild(design, brief).ok, true);
  assert.equal(F.layoutFailure(design, brief), null);
  const unsupported = structuredClone(design);
  unsupported.tiles.find(tile => tile[2] > 0)[2] = 7;
  assert.equal(F.layoutFailure(unsupported, brief), 'unsupportedLayout');
});

test('a covered badge must become readable on the intended route', () => {
  const { readableOnRoute } = require('../tools/builder/bank/choice_checks');
  const { visibility } = require('../tools/builder/loop/obvious');
  const design = {
    tiles: [[0,0,0], [4,0,0], [0,0,1], [4,0,1]],
    faces: [0,0,1,1], down: [], clock: { i: 0, n: 4 }, solution: [2,3,0,1],
  };
  const g = E.game(design);
  assert.equal(visibility(g, E.start(g))[0].role, false);
  assert.equal(readableOnRoute(g, 0), true);
  assert.equal(readableOnRoute(g, 0, () => false), false);
  assert.equal(readableOnRoute(E.game({ ...design, down: [0] }), 0), false);
});

test('a cover that thaws the ice as it is lifted never reveals an ice badge', () => {
  const { readableOnRoute } = require('../tools/builder/bank/choice_checks');
  const design = {
    tiles: [[0,0,0], [4,0,0], [0,0,1], [4,0,1]],
    faces: [0,0,1,1], down: [], obst: { ice: { 0: 1 } },
    clock: { i: 1, n: 4 }, solution: [2,3,0,1],
  };
  const g = E.game(design);
  assert.ok(g.iceNb[0].includes(2));
  assert.equal(readableOnRoute(g, 0), false);
});

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
