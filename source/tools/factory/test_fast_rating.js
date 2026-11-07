'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { measureHuman, measureHumanFast } = require('../sim/refit/human_bot.js');
const { campaign, campaignFast } = require('../sim/refit/human_style_environment.js');
const { normalizeBoard } = require('../sim/refit/public_board_input.js');
const { createFactoryController } = require('../sim/refit/human_factory_controller.js');
const release = require('../sim/refit/human_release.js');
const { createMeter, FAMILY_CACHE_MIGRATIONS, digest, boardOf, atomicJson } = require('./meter.js');

const qualifiedPath = path.join(__dirname, '../../analysis/builder/data/qualified-200-225.jsonl');
const sampleRows = fs.readFileSync(qualifiedPath, 'utf8').trim().split('\n').slice(0, 2).map(JSON.parse);

test('fast mode produces zero drift vs reference mode on every move and rating for family and planner', () => {
  const board = sampleRows[0].design;
  for (const setting of ['family', 'planner']) {
    const opts = { runs: 3, seeds: 2, seed: 4711, setting, capture: true };
    const ref = measureHuman(board, opts);
    const fast = measureHumanFast(board, { ...opts, auditRate: 0 });
    assert.equal(fast.valid, true);
    assert.equal(fast.expectedTries, ref.expectedTries);
    assert.equal(fast.firstTryRate, ref.firstTryRate);
    assert.equal(fast.averageTries, ref.averageTries);
    assert.deepEqual(fast.lossPhase, ref.lossPhase);
    assert.deepEqual(fast.lossTiming, ref.lossTiming);
    if (setting === 'planner') {
      assert.deepEqual(fast.plannerStyles, ref.plannerStyles);
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

test('fast-mode campaign audit passes on real campaigns and fails loudly on any state or action mismatch', () => {
  const encoded = normalizeBoard(sampleRows[1].design);
  const profile = release.profiles.family;

  const ref = campaign(encoded, profile, 12345, {
    maxAttempts: 5,
    capture: true,
    controllerFactory: createFactoryController,
  });
  const audited = campaignFast(encoded, profile, 12345, {
    maxAttempts: 5,
    capture: true,
    auditRate: 1,
    controllerFactory: createFactoryController,
  });
  assert.ok(audited.verifiedTaps > 0);
  assert.equal(audited.verifiedTaps, ref.verifiedTaps);
  assert.equal(audited.wonOn, ref.wonOn);
  assert.deepEqual(
    audited.attempts.map(a => a.actions),
    ref.attempts.map(a => a.actions)
  );

  // Inject a state mismatch: audit must fail loudly.
  assert.throws(() => {
    campaignFast(encoded, profile, 12345, {
      maxAttempts: 2,
      auditRate: 1,
      controllerFactory: createFactoryController,
      _auditMutator(snap) { snap.state.moves += 1; },
    });
  }, /Fast-mode audit failed/);

  // Inject a win/why mismatch: audit must fail loudly.
  assert.throws(() => {
    campaignFast(encoded, profile, 12345, {
      maxAttempts: 2,
      auditRate: 1,
      controllerFactory: createFactoryController,
      _auditMutator(snap) { snap.win = !snap.win; },
    });
  }, /Fast-mode audit failed/);

  // Inject a tap mismatch: audit must fail loudly.
  assert.throws(() => {
    campaignFast(encoded, profile, 12345, {
      maxAttempts: 2,
      auditRate: 1,
      controllerFactory: createFactoryController,
      _auditMutator(snap) { snap.actions[0] = -999; },
    });
  }, /Fast-mode audit failed/);
});

test('createMeter selects fast mode by default, matches slow mode output, and preserves family cache migrations', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oma-fast-meter-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const d = {
    tiles: [[0, 0, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0]],
    faces: [0, 0, 1, 1],
    down: [2],
    obst: { ice: {}, locks: [3], keys: [0, 1] },
    clock: { i: 3, n: 4 },
    solution: [0, 1, 2, 3],
  };

  const fastMeter = createMeter({ cacheDir: false });
  const slowMeter = createMeter({ cacheDir: false, fast: false });
  assert.equal(fastMeter.fingerprint, slowMeter.fingerprint);

  for (const setting of ['family', 'planner']) {
    const a = fastMeter.measure(d, { runs: 4, seeds: 2, seed: 4711, setting, capture: 'tail' });
    const b = slowMeter.measure(d, { runs: 4, seeds: 2, seed: 4711, setting, capture: 'tail' });
    const { minutes: _m1, minutesPerBoard: _mp1, slowestMove: _s1, verifiedTaps: _v1, ...restA } = a;
    const { minutes: _m2, minutesPerBoard: _mp2, slowestMove: _s2, verifiedTaps: _v2, ...restB } = b;
    assert.deepEqual(restA, restB);
  }

  // Verify FAMILY_CACHE_MIGRATIONS reuses prior family caches under the new fingerprint.
  const m = createMeter({ cacheDir: dir });
  const priors = FAMILY_CACHE_MIGRATIONS[m.fingerprint];
  assert.ok(Array.isArray(priors) && priors.length >= 3);
  const settings = { runs: 20, seeds: 2, seed: 4711, setting: 'family' };
  atomicJson(
    path.join(dir, digest({ fingerprint: priors[0], input: boardOf(d), settings }) + '.json'),
    { valid: true, expectedTries: 11.25, results: [] }
  );
  assert.equal(m.measure(d, settings).expectedTries, 11.25);
  assert.equal(m.stats.calls, 0);
  assert.equal(m.stats.familyReused, 1);
});
