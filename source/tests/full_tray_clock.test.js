'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { fullTrayFailure, trayOnWay, LAYOUTS } = require('../tools/builder/builder');
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
