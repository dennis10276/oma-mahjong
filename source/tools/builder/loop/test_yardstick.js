'use strict';
// node --test source/tools/builder/loop/test_yardstick.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const Y = require('./yardstick.js');
const M = require('../../factory/meter.js');

const QUALIFIED = path.resolve(__dirname, '../../../analysis/builder/data/qualified-200-225.jsonl');
const qualified = () => fs.readFileSync(QUALIFIED, 'utf8').trim().split('\n').map(JSON.parse);
const pins = Y.loadPins();

// Fake meter with the real meter's shape: `runs * seeds` campaigns, results[] = first sub-block only,
// expectedTries over all campaigns (rounded like the meter). Tries come from common random numbers
// per campaign seed, so spares are paired exactly like the real bot.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function fakeMeasure(pOf, calls = []) {
  return (board, settings, bot) => {
    calls.push({ bot, settings: { ...settings } });
    const { runs = 20, seeds = 2, seed = 4711 } = settings, p = pOf(board, settings, bot);
    const campaign = s => {
      const u = rng(s)(), tries = Math.ceil(Math.log(1 - u) / Math.log(1 - p));
      return tries <= 20 ? { wonOn: tries, attempts: Array.from({ length: tries }, (_, i) => ({ win: i === tries - 1 })) }
        : { wonOn: null, attempts: Array.from({ length: 20 }, () => ({ win: false })) };
    };
    const results = [], pooled = [];
    for (let s = 0; s < seeds; s++) for (let r = 0; r < runs; r++) {
      const c = campaign(((seed + s * 7919) | 0) + Math.imul(r + 1, 0x9e3779b9) | 0);
      pooled.push(c); if (s === 0) results.push(c);
    }
    const exp = pooled.reduce((t, c) => t + (c.wonOn ?? 20), 0) / pooled.length;
    return { expectedTries: Number(exp.toFixed(2)), firstTryRate: results.filter(c => c.wonOn === 1).length / runs, valid: true,
      lossPhase: { beforeClock: 0.5, mid: 0.3, late: 0.2 }, plannerStyles: settings.setting === 'planner' ? { route: 3, plain: 4 } : undefined, results };
  };
}
const board = n => ({ tiles: [[0, 0, 0], [2, 0, 0]], faces: [0, 0], down: [], obst: { ice: {}, keys: [], locks: [] }, clock: { i: 0, n } });

test('pins: blocks reproduce production pooling and fresh ACCEPT blocks', () => {
  assert.deepEqual(Y.blockCalls(pins, 'CURVE'), [{ runs: 20, seeds: 2, seed: 4711 }, { runs: 20, seeds: 2, seed: 18427 }]);
  assert.deepEqual(Y.blockCalls(pins, 'CURVE', { campaigns: 40 }), [{ runs: 20, seeds: 2, seed: 4711 }]);
  assert.deepEqual(Y.blockCalls(pins, 'SCREEN'), [{ runs: 20, seeds: 1, seed: 4711 }]);
  assert.deepEqual(Y.blockCalls(pins, 'ACCEPT', { campaigns: 160 }).map(c => c.seed), [29717, 45555, 61393, 77231]);
  assert.equal(Y.blockCalls(pins, 'ACCEPT', { campaigns: 40, startBlock: 4 })[0].seed, 29717 + 4 * 15838);
  assert.throws(() => Y.blockCalls(pins, 'ACCEPT', { campaigns: 50 }));
  assert.throws(() => Y.blockCalls(pins, 'CURVE', { campaigns: 60 }));
  // No ACCEPT sub-block seed (seed, seed + 7919) collides with SCREEN/CURVE sub-blocks.
  const used = new Set([4711, 4711 + 7919, 18427, 18427 + 7919]);
  for (const c of Y.blockCalls(pins, 'ACCEPT', { campaigns: 40 * 50 })) for (const s of [c.seed, c.seed + 7919]) { assert(!used.has(s)); used.add(s); }
  assert.equal(pins.family.botVersion, 'family-key-memory-v1-fast');
  assert.equal(pins.family.fingerprint, '63be677ee17677754b17e9c835e8a0f757d1d5ec62738950bf2a2f5e4357413a');
  assert.equal(pins.planner.settings.setting, 'planner');
});

test('pins match the real meter fingerprints (no rating)', () => {
  const ys = Y.createYardstick({ cacheDir: false, ledgerFile: false });
  assert.equal(ys.fingerprint, M.createMeter({ cacheDir: false, botVersion: 'family-key-memory-v1-fast' }).fingerprint);
  assert.equal(ys.fingerprint, pins.family.fingerprint);
  assert.equal(ys.referenceFingerprint, pins.reference.fingerprint);
  assert.deepEqual(ys.mismatch, []);
  // The meter migrates the slow bot's and Codex's ratings to the pinned fast ruler by itself.
  assert.deepEqual([...M.FAMILY_CACHE_MIGRATIONS[pins.family.fingerprint]].sort(), [pins.family.slowFingerprint, pins.family.codexFingerprint].sort());
  assert.equal(M.createMeter({ cacheDir: false, botVersion: 'family-key-memory-v1' }).fingerprint, pins.family.slowFingerprint);
});

test('refuses a changed fingerprint unless allowNewFingerprint', () => {
  const measure = fakeMeasure(() => 0.3);
  assert.throws(() => Y.createYardstick({ measure, fingerprints: { family: 'other' } }), /refuses a changed bot/);
  assert.throws(() => Y.createYardstick({ measure, fingerprints: { reference: 'other' } }), /refuses a changed bot/);
  assert.throws(() => Y.createYardstick({ measure, fingerprints: { planner: 'other' } }), /refuses a changed bot/);
  const ys = Y.createYardstick({ measure, fingerprints: { family: 'other' }, allowNewFingerprint: true });
  const r = ys.rate(board(5));
  assert.equal(r.fingerprint, 'other');
  assert(r.fingerprintMismatch.length === 1);
});

test('rate: D is the equal mean of the two production calls; SE from visible campaigns', () => {
  const calls = [], ys = Y.createYardstick({ measure: fakeMeasure(() => 0.15, calls) });
  const r = ys.rate(board(5));
  assert.deepEqual(calls.map(c => c.settings), [{ setting: 'family', runs: 20, seeds: 2, seed: 4711 }, { setting: 'family', runs: 20, seeds: 2, seed: 18427 }]);
  assert.equal(r.n, 80); assert.equal(r.nVisible, 40); assert.equal(r.perCampaign.length, 40);
  assert.equal(r.D, (r.calls[0].exp + r.calls[1].exp) / 2);
  assert(r.D > 4 && r.D < 9, 'geometric p 0.15 with cap gives about 6.5: ' + r.D);
  const sd = Y.sampleSd(r.perCampaign);
  assert(Math.abs(r.se - sd / Math.sqrt(40)) < 1e-12);
  assert(r.se > 0.3 && r.se < 1.2, 'SE near sqrt(D(D-1)/80): ' + r.se + ' vs ' + r.seGeometric);
  assert(r.pHat > 0.08 && r.pHat < 0.3);
  assert.equal(r.fingerprint, pins.family.fingerprint);
  assert.equal(r.valid, true);
  // A campaign that never wins counts as the cap (also one the bot cut short).
  const cut = Y.summarize([{ expectedTries: 5, valid: false, results: [{ wonOn: null, attempts: [{}, {}] }, { wonOn: 3, attempts: [{}, {}, {}] }] }], [{ runs: 2, seeds: 1 }]);
  assert.deepEqual(cut.perCampaign, [20, 3]); assert.equal(cut.valid, false);
  const hard = Y.createYardstick({ measure: fakeMeasure(() => 0.01) }).rate(board(5));
  assert(hard.perCampaign.every(t => t <= 20)); assert(hard.uncleared > 0);
  assert(hard.perCampaign.filter(t => t === 20).length >= hard.uncleared);
  // SCREEN and the reference counterfactual.
  const calls2 = [], ys2 = Y.createYardstick({ measure: fakeMeasure(() => 0.3, calls2) });
  const s = ys2.rate(board(5), { block: 'SCREEN', bot: 'reference' });
  assert.equal(s.n, 20); assert.equal(s.nVisible, 20); assert.equal(calls2[0].bot, 'reference');
  assert.equal(s.fingerprint, pins.reference.fingerprint);
});

test('accept: sequential rule (160 -> accept / refuse / 320)', () => {
  // D is set per ACCEPT seed so each look returns a known value. A fresh yardstick (in-memory ledger) per case.
  const dOf = new Map();
  const measure = (b, settings) => {
    const D = dOf.get(settings.seed) ?? b.clock.n, results = Array.from({ length: settings.runs }, () => ({ wonOn: D, attempts: Array(D).fill({}) }));
    return { expectedTries: D, firstTryRate: 0, valid: true, results };
  };
  const fresh = () => Y.createYardstick({ measure });
  assert.equal(fresh().tolerance(5), 1); assert.equal(fresh().tolerance(14), 1);
  let a = fresh().accept(board(8), 8.4);
  assert.equal(a.decision, 'accept'); assert.equal(a.stage, 1); assert.equal(a.n, 160); assert.deepEqual(a.blocks, [0, 4]); assert.deepEqual(a.reserved, [0, 8]);
  a = fresh().accept(board(12), 8);
  assert.equal(a.decision, 'refuse'); assert.equal(a.stage, 1);
  // Exactly at the edges: gap 0.6 tol accepts at once, gap 2.5 tol still goes to 320.
  assert.equal(fresh().accept(board(8), 8.6).stage, 1);
  assert.equal(fresh().accept(board(10), 7.5).stage, 2);
  // 160 at 9 (gap 1, between 0.6 and 2.5 tol) -> 320; the second half reads 8 -> pooled 8.5 -> accept.
  for (const c of Y.blockCalls(pins, 'ACCEPT', { campaigns: 320 }).slice(4)) dOf.set(c.seed, 8);
  a = fresh().accept(board(9), 8);
  assert.equal(a.stage, 2); assert.equal(a.n, 320); assert.equal(a.D, 8.5); assert.equal(a.decision, 'accept'); assert.deepEqual(a.blocks, [0, 8]);
  assert.equal(a.history.length, 2); assert.equal(a.history[0].n, 160);
  // Same middle band, but the second half confirms 9 -> gap 1.1 > tol 1 -> refuse.
  dOf.clear();
  a = fresh().accept(board(9), 7.9, 1);
  assert.equal(a.stage, 2); assert.equal(a.decision, 'refuse');
  // Fixed tolerance even above D 10: gap 0.5 accepts early, gap 1 requires the second look.
  a = fresh().accept(board(16), 15.5);
  assert.equal(a.tol, 1); assert.equal(a.decision, 'accept'); assert.equal(a.stage, 1);
  assert.equal(fresh().accept(board(16), 15).stage, 2);
  assert.throws(() => fresh().accept(board(16), 15, 1.55), /at most 1/);
  // Stage 2 does not re-measure stage 1 (8 meter calls in all).
  let calls = 0; const counting = Y.createYardstick({ measure: (b, st) => { calls++; return measure(b, st); } });
  counting.accept(board(9), 8); assert.equal(calls, 8);
});

test('accept ledger: persisted per puzzle (all spares), reserved before measuring, never reused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ys-ledger-')), file = path.join(dir, 'ledger.json');
  try {
    const seeds = [];
    const measure = (b, settings) => { seeds.push(settings.seed); const D = 8; return { expectedTries: D, valid: true, results: Array.from({ length: settings.runs }, () => ({ wonOn: D, attempts: [] })) }; };
    const ys = Y.createYardstick({ measure, ledgerFile: file });
    const d = { ...board(8), solution: [0, 1] };
    let a = ys.accept(d, 8);
    assert.deepEqual(a.blocks, [0, 4]); assert.equal(a.decision, 'accept');
    // Another spare of the same puzzle, and a new process (fresh yardstick): continues after the reservation.
    const ys2 = Y.createYardstick({ measure, ledgerFile: file });
    a = ys2.accept({ ...d, clock: { i: 0, n: 9 } }, 8);
    assert.deepEqual(a.blocks, [8, 12]);
    assert.equal(new Set(seeds).size, seeds.length, 'no ACCEPT seed measured twice');
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = Object.values(saved.puzzles);
    assert.equal(entries.length, 1); assert.equal(entries[0].entries.length, 2);
    assert.deepEqual(entries[0].entries.map(e => [e.status, e.decision, e.reserved]), [['done', 'accept', [0, 8]], ['done', 'accept', [8, 16]]]);
    assert.equal(Y.puzzleKey(d), Y.puzzleKey({ ...d, clock: { i: 0, n: 3 } }));
    assert.notEqual(Y.puzzleKey(d), Y.puzzleKey({ ...d, clock: { i: 1, n: 8 } }));
    // A crash after the reservation still marks the blocks used.
    const boom = Y.createYardstick({ measure: () => { throw Error('crash'); }, ledgerFile: file });
    assert.throws(() => boom.accept(d, 8), /crash/);
    assert.deepEqual(ys.ledger.used(Y.puzzleKey(d)), [[0, 8], [8, 16], [16, 24]]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('splitCall plays the same campaign seeds as the whole call', () => {
  const PHI = 0x9e3779b9, seedsOf = c => Array.from({ length: c.runs }, (_, r) => (c.seed + Math.imul(r + 1, PHI)) | 0);
  const whole = { runs: 20, seeds: 1, seed: 4711 }, parts = Y.splitCall(whole, 5);
  assert.equal(parts.length, 4);
  assert.deepEqual(parts.flatMap(seedsOf), seedsOf(whole));
  assert.throws(() => Y.splitCall({ runs: 20, seeds: 2, seed: 1 }, 5));
  assert.throws(() => Y.splitCall(whole, 3));
});

test('planner: planner-fast-v1 meter, pinned settings, spare via knobs.clockSpare', () => {
  const calls = [], ys = Y.createYardstick({ measure: fakeMeasure(() => 0.4, calls) });
  const d = qualified()[0].design;
  const p = ys.planner(d, { spare: 2 });
  assert.equal(calls[0].bot, 'planner');
  assert.deepEqual(calls[0].settings, { setting: 'planner', runs: 20, seeds: 2, seed: 4711 });
  assert.equal(p.clockN, 5); // board 0: clockShortest k = 3
  assert.deepEqual(p.styles, { route: 3, plain: 4 });
  assert.equal(p.fingerprint, pins.planner.fingerprint);
});

test('cache lookup reuses a production variant (capture:tail at 4711) without measuring', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ys-cache-'));
  try {
    const d = board(6), fp = pins.family.fingerprint;
    const tail = { setting: 'family', runs: 20, seeds: 2, seed: 4711, capture: 'tail' };
    fs.writeFileSync(path.join(dir, M.digest({ fingerprint: fp, input: M.boardOf(d), settings: tail }) + '.json'), '{}');
    const seen = [], fake = fakeMeasure(() => 0.2);
    const meter = (fingerprint, bot) => ({ fingerprint, measure: (b, s) => { seen.push({ bot, s }); return fake(b, s, bot); } });
    const ys = Y.createYardstick({ cacheDir: dir, ledgerFile: false, meters: { family: meter(fp, 'family'), reference: meter(pins.reference.fingerprint, 'reference'), planner: meter(pins.planner.fingerprint, 'planner') } });
    ys.rate(d);
    assert.deepEqual(seen.map(x => x.s), [tail, { setting: 'family', runs: 20, seeds: 2, seed: 18427 }]);
    assert.equal(ys.stats.cachedVariant, 1); assert.equal(ys.stats.calls, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('meter migration: Codex d362e85f ratings serve the fast ruler without a bot run', () => {
  const src = path.resolve(__dirname, '../../../build/factory-cache'), d = qualified()[0].design;
  const files = [4711, 18427].map(seed => M.digest({ fingerprint: pins.family.codexFingerprint, input: M.boardOf(d), settings: { setting: 'family', runs: 20, seeds: 2, seed } }) + '.json');
  if (!files.every(f => fs.existsSync(path.join(src, f)))) return; // cache not present on this machine
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ys-mig-'));
  try {
    for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dir, f));
    const ys = Y.createYardstick({ cacheDir: dir, ledgerFile: false });
    assert(ys.cached(d, 'CURVE'));
    const r = ys.rate(d);
    assert.equal(ys.meters.family.stats.familyReused, 2); assert.equal(ys.meters.family.stats.calls, 0);
    const old = files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).expectedTries);
    assert.equal(r.D, (old[0] + old[1]) / 2); assert.equal(r.n, 80); assert.equal(r.valid, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real smoke: fast key-memory bot, one qualified board, runs 4 (CURVE seeds, 16 campaigns)', () => {
  const ys = Y.createYardstick({ cacheDir: false, ledgerFile: false });
  const d = qualified()[0].design; // level-200 candidate 58a099f8, spare 1 as stored
  const started = Date.now(), r = ys.rate(d, { block: 'CURVE', runs: 4 });
  assert.equal(r.n, 16); assert.equal(r.nVisible, 8); assert.equal(r.valid, true);
  assert(r.D >= 1 && r.D <= 20); assert(r.se >= 0);
  assert.equal(r.fingerprint, pins.family.fingerprint);
  assert(Date.now() - started < 30000, 'smoke rating took ' + (Date.now() - started) + ' ms');
});

test('allResults: SE and pairing use resultsBySeed (every campaign of every sub-block)', () => {
  const m = (b, st) => ({ expectedTries: 3, valid: true, firstTryRate: 0.3, ...(st.allResults ? { resultsBySeed: [[{ wonOn: 1, tries: 1 }, { wonOn: null, tries: 20 }], [{ wonOn: 5, tries: 5 }, { wonOn: 2, tries: 2 }]] } : { results: [{ wonOn: 1, attempts: [{}] }] }) });
  const ys = Y.createYardstick({ measure: m });
  const r = ys.rate(board(5), { block: 'SCREEN', allResults: true });
  assert.deepEqual(r.perCampaign, [1, 20, 5, 2]);
  assert.equal(ys.rate(board(5), { block: 'SCREEN' }).nVisible, 1);
});
