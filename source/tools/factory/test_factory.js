'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { createMeter, boardKey } = require('./meter.js');
const { createSteerer } = require('./steer_design.js');
const { runFile } = require('./run_file.js');
const { targetAt, validatePiles, prepare } = require('./build.js');
const { exactRoute } = require('../lab/exact.js');
const Layouts = require('../../www/layouts.js');

const board = () => ({ tiles: [0, 4, 8, 12].map(x => ({ x, y: 0, z: 0 })), faces: [0, 0, 1, 1],
  down: [], gold: [], obst: { ice: {}, locks: [2], keys: [0, 1] }, clock: { i: 1, n: 3 }, solution: [0, 1, 2, 3] });
const start = () => ({ level: 175, target: 3, recipe: ['lockedPartners'], design: board() });
function fake({ idle = false, holdout = 3, valid = true } = {}) {
  return (d, o) => {
    const exp = o.setting === 'planner' ? 1.5 : !d.clock ? 1 : o.seed === 18427 ? holdout : !idle && !d.obst.locks.length ? 2.3 : 3;
    return { expectedTries: exp, firstTryRate: 0.3, valid, version: 'test', results: [{ wonOn: 3,
      attempts: [{ win: false, censored: false, why: 'clock', left: 3, decisions: [{ index: 0, state: { tray: [0] } }] }] }] };
  };
}
function meter(fn = fake()) { return createMeter({ measureHuman: fn, fingerprint: 'test', cacheDir: false }); }

test('cache keys include physics, setting, seed, capture, bot fingerprint; equivalent JSON shares a key', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oma-factory-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  let calls = 0;
  const fn = (d, o) => { calls++; return fake()(d, o); };
  const a = createMeter({ measureHuman: fn, fingerprint: 'a', cacheDir: dir }), d = board(), o = { setting: 'family' };
  a.measure(d, o); a.measure({ ...d, tiles: d.tiles.map(t => [t.x, t.y, t.z]) }, o);
  assert.equal(calls, 1);
  createMeter({ measureHuman: fn, fingerprint: 'a', cacheDir: dir }).measure(d, o);
  assert.equal(calls, 1, 'cache survives a new process/meter');
  for (const opts of [{ seed: 8 }, { setting: 'planner' }, { capture: 'tail' }, { runs: 6 }]) a.measure(d, { ...o, ...opts });
  a.measure({ ...d, clock: { ...d.clock, n: 4 } }, o);
  createMeter({ measureHuman: fn, fingerprint: 'b', cacheDir: dir }).measure(d, o);
  assert.equal(calls, 7);
  assert.equal(boardKey(d), boardKey({ ...d, tiles: d.tiles.map(t => [t.x, t.y, t.z]) }));
});

test('invalid measurements are retried and never accepted', () => {
  const m = meter(fake({ valid: false }));
  m.measure(board(), { setting: 'family' }); m.measure(board(), { setting: 'family' });
  assert.equal(m.stats.calls, 2);
  assert.equal(createSteerer({ meter: m, steps: 0 }).steer(start()).pass, false);
});

test('a starting board on target still repairs idle specials and checks the holdout', () => {
  const result = createSteerer({ meter: meter(fake({ idle: true })), steps: 2 }).steer(start());
  assert.equal(result.pass, true);
  assert.deepEqual(result.design.obst.locks, []);
  assert.ok(result.log.some(l => l.includes('idle specials removed')));
  assert.equal(result.holdout.seed, 18427);
});

test('a fresh-seed miss is REVIEW even when search passes', () => {
  const result = createSteerer({ meter: meter(fake({ holdout: 5 })), steps: 0 }).steer(start());
  assert.equal(result.searchPass, true);
  assert.equal(result.holdout.exp, 5);
  assert.equal(result.pass, false);
});

test('dontGrab must demonstrate that taking the clock first is worse', () => {
  const result = createSteerer({ meter: meter(), steps: 0 }).steer({ ...start(), concept: 'dontGrab' });
  assert.equal(result.searchPass, true); assert.equal(result.pass, false);
  assert.ok(result.reviewReasons.includes('clockFirstNotWorse'));
});

test('off-curve boards skip skilled planning and special ablations', () => {
  const settings = [], fn = fake();
  const e = createSteerer({ meter: meter((d, o) => { settings.push(o.setting); return fn(d, o); }) });
  const j = e.judge(board(), 10, 0);
  assert.deepEqual(settings, ['family']);
  assert.equal(j.skilled, null); assert.equal(j.pass, false);
});

test('a checkpoint resumes the accepted edit without redoing its measurements', () => {
  const m = meter(fake({ idle: true })), engine = createSteerer({ meter: m, steps: 2 });
  let saved;
  assert.throws(() => engine.steer(start(), null, s => {
    saved = structuredClone(s);
    if (s.step === 1) throw Error('interrupted');
  }), /interrupted/);
  const calls = m.stats.calls;
  const resumed = engine.steer(start(), saved);
  assert.equal(resumed.pass, true);
  assert.equal(m.stats.calls, calls + 1, 'only the held-out seed remains');
});

test('file runner refuses stale input and skips a completed level', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oma-factory-run-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const input = path.join(dir, 'input.jsonl'), output = path.join(dir, 'out.jsonl');
  fs.writeFileSync(input, JSON.stringify(start()) + '\n');
  const options = { fingerprint: 'fake-run', measureHuman: fake(), cacheDir: false, steps: 0 };
  assert.equal(runFile(input, output, options).rows.length, 1);
  assert.equal(runFile(input, output, options).stats.calls, 0);
  fs.writeFileSync(input, JSON.stringify({ ...start(), target: 4 }) + '\n');
  assert.throws(() => runFile(input, output, options), /changed/);
});

test('curve interpolation keeps global anchors and rejects accidental extrapolation', () => {
  const points = [[175, 4.5], [180, 6.2], [199, 7]];
  assert.equal(targetAt(175, points), 4.5); assert.equal(targetAt(180, points), 6.2);
  assert.equal(targetAt(199, points), 7); assert.equal(targetAt(190, points), 6.62);
  assert.throws(() => targetAt(200, points), /outside/);
  assert.throws(() => targetAt(175, [[175, 5], [180, 4]]), /nondecreasing/);
});

test('an exhausted route-search budget cannot certify a loose clock', () => {
  const d = board(), g = { tiles: d.tiles, faces: d.faces, nb: Layouts.neighbors(d.tiles), rules: null };
  assert.equal(exactRoute(g, 1, 20000, 0), null);
  const found = exactRoute(g, 1, 20000, 1000);
  assert.equal(found.k, 1); assert.equal(found.path.length, 4);
});

test('batch validation rejects repeated shapes and misplaced big boards before bot work', () => {
  const piles = JSON.parse(fs.readFileSync(path.join(__dirname, '../../analysis/factory/codex-pilot-piles.json')));
  assert.throws(() => validatePiles([{ level: 175, pile: 924 }, { level: 176, pile: 906 }, { level: 177, pile: 976 }], piles), /resembles/);
  assert.throws(() => validatePiles([{ level: 175, pile: 924 }, { level: 176, pile: 924 }], piles), /repeat/);
  assert.throws(() => validatePiles([{ level: 180, pile: 924 }], piles), /tenth/);
});

test('the builder constructs a fresh trap with a valid full solution', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oma-factory-seed-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({
    piles: path.join(__dirname, '../../analysis/factory/codex-pilot-piles.json'),
    routeMilliseconds: 5000, levels: [{ level: 177, pile: 976, concept: 'iceBeforeKeys', target: 3.6 }]
  }));
  const file = prepare(path.join(dir, 'plan.json'), path.join(dir, 'out.jsonl'));
  const row = JSON.parse(fs.readFileSync(file, 'utf8').trim());
  assert.equal(row.seedSource, 'designed');
  assert.equal(require('../lab/ideas.js').valid(row.design), true);
  assert.equal(row.design.solution.length, row.design.tiles.length);
  assert.ok(Object.keys(row.design.obst.ice).length > 0);
  assert.ok(row.design.obst.locks.length > 0);
  assert.equal(row.origin.kind, 'fresh-design');
});
