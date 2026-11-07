'use strict';

/**
 * Task G2 Part B — Unit & integration tests for `proxyRate(designs)`.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { proxyRate, closeProxyWorker } = require('./proxy_rate.js');

const ROOT = path.resolve(__dirname, '../..');
const KNOBS_PATH = path.join(ROOT, 'analysis/builder/knobs-v1/boards.json');
const QUAL_PATH = path.join(ROOT, 'analysis/builder/data/qualified-200-225.jsonl');

test('proxyRate scores candidate batches via persistent GPU worker, is deterministic, and ranks easy < hard', async t => {
  t.after(async () => {
    await closeProxyWorker();
  });

  // 1. Empty batch
  const empty = await proxyRate([]);
  assert.deepEqual(empty, []);

  // 2. Load known easy (<= 4 tries), in-band (10..13), and hard (>= 19 tries) builder boards
  const knobBoards = JSON.parse(fs.readFileSync(KNOBS_PATH, 'utf8'))
    .filter(r => r.design && r.family && !r.fail);
  const qualBoards = fs.readFileSync(QUAL_PATH, 'utf8').trim().split('\n').map(JSON.parse);

  const easyBoards = knobBoards.filter(r => r.family.exp <= 3.5).slice(0, 8);
  const inBandBoards = knobBoards.filter(r => r.family.exp >= 10 && r.family.exp <= 13).slice(0, 6);
  const hardBoards = knobBoards.filter(r => r.family.exp >= 19.5).slice(0, 8);
  const batch = [...easyBoards, ...inBandBoards, ...hardBoards, ...qualBoards.slice(0, 6)];

  const scores1 = await proxyRate(batch, { seed: 4711, campaigns: 64 });
  assert.equal(scores1.length, batch.length);
  for (const s of scores1) {
    assert.equal(typeof s, 'number');
    assert.ok(Number.isFinite(s) && s >= 1 && s <= 20, `Score out of [1, 20]: ${s}`);
  }
  assert.equal(scores1.details.length, batch.length);
  assert.ok(scores1.timing.kernelMs > 0, 'Expected positive GPU kernel time');

  // 3. Second warm call on same persistent worker must be deterministic for same seed and fast
  const scores2 = await proxyRate(batch, { seed: 4711, campaigns: 64 });
  assert.deepEqual(scores2, scores1, 'Same seed on persistent GPU worker must be bit-for-bit deterministic');

  // 4. Detailed mode returns per-board breakdown objects
  const detailed = await proxyRate(batch.slice(0, 4), { seed: 4711, campaigns: 64, detailed: true });
  assert.equal(detailed.length, 4);
  for (let i = 0; i < 4; i++) {
    assert.equal(detailed[i].score, scores1[i]);
    assert.ok(detailed[i].expectedTries >= 1 && detailed[i].expectedTries <= 20);
    assert.ok(detailed[i].firstTryRate >= 0 && detailed[i].firstTryRate <= 1);
    assert.ok(detailed[i].clearRate >= 0 && detailed[i].clearRate <= 1);
  }

  // 5. Easy group mean score must be substantially lower than hard group mean score
  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const easyMean = mean(scores1.slice(0, easyBoards.length));
  const hardOffset = easyBoards.length + inBandBoards.length;
  const hardMean = mean(scores1.slice(hardOffset, hardOffset + hardBoards.length));
  assert.ok(
    hardMean > easyMean + 4.0,
    `Expected hard boards mean (${hardMean.toFixed(2)}) > easy boards mean (${easyMean.toFixed(2)}) + 4.0`
  );
});
