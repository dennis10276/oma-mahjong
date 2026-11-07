'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const slowBot = require('../sim/refit/human_bot_key_memory_v1.js');
const fastBot = require('../sim/refit/human_bot_key_memory_v1_fast.js');
const { createFastFactoryController } = require('../sim/refit/human_key_memory_measure_fast.js');
const { createFactoryController } = require('../sim/refit/human_key_memory_controller.js');
const { campaign, campaignFast } = require('../sim/refit/human_style_environment.js');
const { normalizeBoard } = require('../sim/refit/public_board_input.js');
const kmRelease = require('../sim/refit/human_key_memory_release.js');
const { createMeter, BOT_VERSIONS, FAMILY_CACHE_MIGRATIONS, digest, boardOf, atomicJson } = require('./meter.js');

const ladderPath = path.join(__dirname, '../../analysis/builder/why-hard-v1/v3-reference/ladder/plan.json');
const ladderPlan = JSON.parse(fs.readFileSync(ladderPath, 'utf8'));
const hiddenKeyBoard = ladderPlan.boards.find(b => b.id === 'clockInSight-L2-w10-s1-p1').design;

test('fast key-memory bot matches slow key-memory bot on every move, rating, and output field across hidden-key retries', () => {
  for (const setting of ['family', 'family-key-memory-v1', 'planner-reference-v1']) {
    const opts = { runs: 3, seeds: 2, seed: 4711, setting, capture: true };
    const ref = slowBot.measureHuman(hiddenKeyBoard, opts);
    const fast = fastBot.measureHuman(hiddenKeyBoard, { ...opts, auditRate: 0 });

    assert.equal(fast.valid, true);
    assert.equal(fast.version, 'human-g6.3-key-memory-candidate1');
    assert.equal(fast.version, ref.version);
    assert.equal(fast.calibrationStatus, ref.calibrationStatus);
    assert.equal(fast.profileName, ref.profileName);
    assert.equal(fast.expectedTries, ref.expectedTries);
    assert.equal(fast.firstTryRate, ref.firstTryRate);
    assert.equal(fast.averageTries, ref.averageTries);
    assert.deepEqual(fast.lossPhase, ref.lossPhase);
    assert.deepEqual(fast.lossTiming, ref.lossTiming);
    if (setting === 'planner-reference-v1') {
      assert.equal(fast.profileName, 'planner-reference-v1');
      assert.deepEqual(fast.plannerStyles, ref.plannerStyles);
    } else {
      assert.equal(fast.profileName, 'family-key-memory-v1');
    }

    assert.equal(fast.results.length, ref.results.length);
    for (let r = 0; r < ref.results.length; r++) {
      assert.equal(fast.results[r].wonOn, ref.results[r].wonOn);
      assert.equal(fast.results[r].attempts.length, ref.results[r].attempts.length);
      for (let a = 0; a < ref.results[r].attempts.length; a++) {
        const ra = ref.results[r].attempts[a], fa = fast.results[r].attempts[a];
        assert.deepEqual(fa.actions, ra.actions, `${setting} run ${r} attempt ${a} moves must match bit-for-bit`);
        assert.equal(fa.win, ra.win);
        assert.equal(fa.why, ra.why);
        assert.equal(fa.censored, ra.censored);
        assert.equal(fa.phase, ra.phase);
        assert.equal(fa.clockLeft, ra.clockLeft);
        assert.equal(fa.left, ra.left);
        assert.deepEqual(fa.terminal, ra.terminal);
        assert.deepEqual(fa.decisions, ra.decisions);
      }
    }
  }
});

test('createFastFactoryController handles Uint8Array alive state and preserves rememberedKeyRoleEvidence', () => {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
  const ctrl = createFastFactoryController(tiles, kmRelease.profiles.family, 4711);
  ctrl.beginAttempt();
  ctrl.observe(
    { alive: new Uint8Array([1, 1]), tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 },
    { roles: ['key', 'none'], pictures: [0, 0], down: [0, 0], takeable: [true, true], clock: null }
  );
  assert.equal(ctrl.rememberedKeyRoleEvidence().length, 1);
  assert.equal(ctrl.rememberedKeyRoleEvidence()[0].index, 0);
});

test('fast key-memory campaign audit passes on multi-try hidden-key campaigns and fails loudly on mismatches', () => {
  const encoded = normalizeBoard(hiddenKeyBoard);
  const profile = kmRelease.profiles.family;

  const ref = campaign(encoded, profile, 4711, {
    maxAttempts: 5,
    capture: true,
    controllerFactory: createFactoryController,
  });
  const audited = campaignFast(encoded, profile, 4711, {
    maxAttempts: 5,
    capture: true,
    auditRate: 1,
    controllerFactory: createFastFactoryController,
  });

  assert.ok(audited.verifiedTaps > 0);
  assert.equal(audited.verifiedTaps, ref.verifiedTaps);
  assert.equal(audited.wonOn, ref.wonOn);
  assert.deepEqual(
    audited.attempts.map(a => a.actions),
    ref.attempts.map(a => a.actions)
  );

  assert.throws(() => {
    campaignFast(encoded, profile, 4711, {
      maxAttempts: 2,
      auditRate: 1,
      controllerFactory: createFastFactoryController,
      _auditMutator(snap) { snap.state.moves += 1; },
    });
  }, /Fast-mode audit failed/);

  assert.throws(() => {
    campaignFast(encoded, profile, 4711, {
      maxAttempts: 2,
      auditRate: 1,
      controllerFactory: createFastFactoryController,
      _auditMutator(snap) { snap.actions[0] = -999; },
    });
  }, /Fast-mode audit failed/);
});

test('meter registers family-key-memory-v1-fast and migrates only slow key-memory family caches', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oma-km-fast-meter-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  assert.ok(BOT_VERSIONS['family-key-memory-v1-fast']);

  const refMeter = createMeter({ cacheDir: false });
  const slowKmMeter = createMeter({ botVersion: 'family-key-memory-v1', cacheDir: false });
  const fastKmMeter = createMeter({ botVersion: 'family-key-memory-v1-fast', cacheDir: false });
  const fastKmSlowFallback = createMeter({ botVersion: 'family-key-memory-v1-fast', fast: false, cacheDir: false });

  assert.notEqual(fastKmMeter.fingerprint, refMeter.fingerprint);
  assert.notEqual(fastKmMeter.fingerprint, slowKmMeter.fingerprint);
  assert.equal(fastKmMeter.fingerprint, fastKmSlowFallback.fingerprint);

  // Slow key-memory candidate itself must keep no cache migrations so reference caches never leak in.
  assert.equal(FAMILY_CACHE_MIGRATIONS[slowKmMeter.fingerprint], undefined);
  const priors = FAMILY_CACHE_MIGRATIONS[fastKmMeter.fingerprint];
  assert.ok(Array.isArray(priors) && priors.includes(slowKmMeter.fingerprint));
  assert.ok(priors.includes('d362e85fba3d61523c54bc53a92745458e4467fb4a59624aad1312e9d9003ae3'));
  assert.ok(!priors.includes(refMeter.fingerprint));

  const d = {
    tiles: [[0, 0, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0]],
    faces: [0, 0, 1, 1],
    down: [2],
    obst: { ice: {}, locks: [3], keys: [0, 1] },
    clock: { i: 3, n: 4 },
    solution: [0, 1, 2, 3],
  };

  for (const setting of ['family', 'planner']) {
    const a = fastKmMeter.measure(d, { runs: 3, seeds: 2, seed: 4711, setting, capture: 'tail' });
    const b = slowKmMeter.measure(d, { runs: 3, seeds: 2, seed: 4711, setting, capture: 'tail' });
    const c = fastKmSlowFallback.measure(d, { runs: 3, seeds: 2, seed: 4711, setting, capture: 'tail' });
    const strip = ({ minutes: _m, minutesPerBoard: _mp, slowestMove: _s, verifiedTaps: _v, ...rest }) => rest;
    assert.deepEqual(strip(a), strip(b));
    assert.deepEqual(strip(a), strip(c));
  }

  // 1. Reference human_bot.js cache must NOT be reused by family-key-memory-v1-fast.
  const settings = { runs: 20, seeds: 2, seed: 4711, setting: 'family' };
  atomicJson(
    path.join(dir, digest({ fingerprint: refMeter.fingerprint, input: boardOf(d), settings }) + '.json'),
    { valid: true, expectedTries: 19.99, results: [] }
  );
  const mRefCheck = createMeter({ botVersion: 'family-key-memory-v1-fast', cacheDir: dir });
  assert.notEqual(mRefCheck.measure(d, { runs: 1, seeds: 1, seed: 4711, setting: 'family' }).expectedTries, 19.99);
  assert.equal(mRefCheck.stats.familyReused, 0);

  // 2. Slow family-key-memory-v1 cache MUST be migrated by family-key-memory-v1-fast for family, but NOT for planner.
  atomicJson(
    path.join(dir, digest({ fingerprint: slowKmMeter.fingerprint, input: boardOf(d), settings }) + '.json'),
    { valid: true, expectedTries: 6.75, results: [] }
  );
  const mMigrate = createMeter({ botVersion: 'family-key-memory-v1-fast', cacheDir: dir });
  assert.equal(mMigrate.measure(d, settings).expectedTries, 6.75);
  assert.equal(mMigrate.stats.calls, 0);
  assert.equal(mMigrate.stats.familyReused, 1);

  const plannerSettings = { runs: 1, seeds: 1, seed: 4711, setting: 'planner' };
  atomicJson(
    path.join(dir, digest({ fingerprint: slowKmMeter.fingerprint, input: boardOf(d), settings: plannerSettings }) + '.json'),
    { valid: true, expectedTries: 18.88, results: [] }
  );
  assert.notEqual(mMigrate.measure(d, plannerSettings).expectedTries, 18.88);
  assert.equal(mMigrate.stats.calls, 1);

  // 3. Pre-G2 Task 11 slow key-memory cache (d362e85f...) MUST also migrate cleanly.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'oma-km-pre-g2-'));
  t.after(() => fs.rmSync(dir2, { recursive: true, force: true }));
  atomicJson(
    path.join(dir2, digest({ fingerprint: 'd362e85fba3d61523c54bc53a92745458e4467fb4a59624aad1312e9d9003ae3', input: boardOf(d), settings }) + '.json'),
    { valid: true, expectedTries: 8.25, results: [] }
  );
  const mPreG2 = createMeter({ botVersion: 'family-key-memory-v1-fast', cacheDir: dir2 });
  assert.equal(mPreG2.measure(d, settings).expectedTries, 8.25);
  assert.equal(mPreG2.stats.calls, 0);
  assert.equal(mPreG2.stats.familyReused, 1);
});
