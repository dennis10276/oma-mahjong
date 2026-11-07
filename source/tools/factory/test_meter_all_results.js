'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const M = require('./meter.js');
const Y = require('../builder/loop/yardstick.js');

const QUAL_PATH = path.resolve(__dirname, '../../analysis/builder/data/qualified-200-225.jsonl');
const sampleBoard = JSON.parse(fs.readFileSync(QUAL_PATH, 'utf8').trim().split(/\r?\n/)[0]).design;

test('Part B: non-opt-in calls preserve exact fingerprints, cache keys, ratings, and 1st-sub-block results', () => {
  const pins = Y.loadPins();
  const refMeter = M.createMeter({ cacheDir: false });
  const kmMeter = M.createMeter({ cacheDir: false, botVersion: 'family-key-memory-v1' });
  const kmFastMeter = M.createMeter({ cacheDir: false, botVersion: 'family-key-memory-v1-fast' });

  assert.equal(refMeter.fingerprint, pins.reference.fingerprint);
  assert.equal(kmMeter.fingerprint, pins.family.fingerprint);
  assert.equal(kmFastMeter.fingerprint, '63be677ee17677754b17e9c835e8a0f757d1d5ec62738950bf2a2f5e4357413a');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meter-std-'));
  try {
    const meter = M.createMeter({ cacheDir: tmpDir, botVersion: 'family-key-memory-v1-fast' });
    const opts = { setting: 'family', runs: 3, seeds: 2, seed: 4711 };
    const expectedKey = M.digest({
      fingerprint: meter.fingerprint,
      input: M.boardOf(sampleBoard),
      settings: opts,
    });

    const m1 = meter.measure(sampleBoard, opts);
    assert.equal(m1.results.length, 3, 'Default call keeps only first sub-block (runs=3)');
    assert.equal('resultsBySeed' in m1, false, 'Default call does not add resultsBySeed');
    assert.equal(fs.existsSync(path.join(tmpDir, expectedKey + '.json')), true, 'Exact legacy cache key preserved');

    // Passing allResults: false explicitly behaves identically and hits the same cache entry
    const m2 = meter.measure(sampleBoard, { ...opts, allResults: false });
    assert.equal(meter.stats.hits, 1);
    assert.deepEqual(m2, m1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Part B: allResults: true returns wonOn for every campaign of every sub-block without changing ratings', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meter-allres-'));
  try {
    const meter = M.createMeter({ cacheDir: tmpDir, botVersion: 'family-key-memory-v1-fast' });
    const baseOpts = { setting: 'family', runs: 4, seeds: 2, seed: 4711 };

    const mStd = meter.measure(sampleBoard, baseOpts);
    const mSub1 = meter.measure(sampleBoard, { setting: 'family', runs: 4, seeds: 1, seed: (4711 + 7919) | 0 });
    const mAll = meter.measure(sampleBoard, { ...baseOpts, allResults: true });

    // Ratings and s=0 diagnostics are bit-identical
    assert.equal(mAll.expectedTries, mStd.expectedTries);
    assert.equal(mAll.firstTryRate, mStd.firstTryRate);
    assert.equal(mAll.label, mStd.label);
    assert.deepEqual(mAll.lossPhase, mStd.lossPhase);
    assert.equal(mAll.valid, mStd.valid);

    // Every campaign across both sub-blocks (4 * 2 = 8) is visible
    assert.equal(mStd.results.length, 4);
    assert.equal(mAll.results.length, 8);
    assert.deepEqual(mAll.results.slice(0, 4), mStd.results);
    assert.deepEqual(mAll.results.slice(4, 8), mSub1.results);

    // Explicit per-seed sub-block breakdown
    assert.equal(Array.isArray(mAll.resultsBySeed), true);
    assert.equal(mAll.resultsBySeed.length, 2);
    assert.deepEqual(
      mAll.resultsBySeed[0],
      mStd.results.map(r => ({ wonOn: r.wonOn, tries: r.wonOn ?? r.attempts.length }))
    );
    assert.deepEqual(
      mAll.resultsBySeed[1],
      mSub1.results.map(r => ({ wonOn: r.wonOn, tries: r.wonOn ?? r.attempts.length }))
    );

    // Yardstick summarize() sees all 8 campaigns (nVisible === n === 8)
    const sumStd = Y.summarize([mStd], [{ runs: 4, seeds: 2, seed: 4711 }]);
    const sumAll = Y.summarize([mAll], [{ runs: 4, seeds: 2, seed: 4711 }]);
    assert.equal(sumStd.n, 8);
    assert.equal(sumStd.nVisible, 4);
    assert.equal(sumAll.n, 8);
    assert.equal(sumAll.nVisible, 8);
    assert.equal(sumAll.D, sumStd.D);

    // Disk cache stores allResults: true under its own distinct key and serves all 8 campaigns on reload
    const meterReloaded = M.createMeter({ cacheDir: tmpDir, botVersion: 'family-key-memory-v1-fast' });
    const mAllCached = meterReloaded.measure(sampleBoard, { ...baseOpts, allResults: true });
    assert.equal(meterReloaded.stats.hits, 1);
    assert.equal(mAllCached.results.length, 8);
    assert.deepEqual(mAllCached.resultsBySeed, mAll.resultsBySeed);

    const mStdCached = meterReloaded.measure(sampleBoard, baseOpts);
    assert.equal(meterReloaded.stats.hits, 2);
    assert.equal(mStdCached.results.length, 4);
    assert.equal('resultsBySeed' in mStdCached, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Part B: allResults: true works for setting: planner across both styles and seeds', () => {
  const fastPlannerPath = path.resolve(__dirname, '../sim/refit/human_bot_planner_fast.js');
  const meterRef = M.createMeter({ cacheDir: false });
  const meterFast = M.createMeter({ cacheDir: false, bot: fastPlannerPath });
  const opts = { setting: 'planner', runs: 3, seeds: 2, seed: 4711 };

  const std = meterFast.measure(sampleBoard, opts);
  const allFast = meterFast.measure(sampleBoard, { ...opts, allResults: true });
  const allRef = meterRef.measure(sampleBoard, { ...opts, allResults: true });

  assert.equal(std.results.length, 3);
  assert.equal(allFast.results.length, 6);
  assert.equal(allRef.results.length, 6);

  assert.equal(allFast.expectedTries, std.expectedTries);
  assert.equal(allRef.expectedTries, std.expectedTries);
  assert.deepEqual(allFast.plannerStyles, std.plannerStyles);
  assert.deepEqual(allRef.plannerStyles, std.plannerStyles);
  assert.deepEqual(allFast.results, allRef.results);
  assert.deepEqual(allFast.resultsBySeed, allRef.resultsBySeed);
  assert.deepEqual(allFast.plannerResultsBySeed, allRef.plannerResultsBySeed);
});
