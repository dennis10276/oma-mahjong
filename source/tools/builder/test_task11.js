'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), P = require('./task11_plan.js');
test('diagnostic IDs containing variant punctuation become safe distinct checkpoint filenames', () => {
  const { rowName } = require('./task11_openings.js');
  const names = ['iceLockClock-L40:spare', 'iceLockClock-L40', '../variant', 'x/y'].map(rowName);
  assert.equal(new Set(names).size, names.length);
  assert(names.every(n => /^[a-f0-9]{64}\.json$/.test(n)));
  assert.equal(rowName('iceLockClock-L40:spare'), names[0]);
});
test('paired reports compare planner bots separately from approved human skilled wins', () => {
  const { skilledReference } = require('./task11_rerate.js'), board = { botSkilled: 5.15, skilledEvidence: { tries: 5 } };
  assert.deepEqual(skilledReference(board, { group: 'kept20', reference: { skilled: 5 } }), { referencePlannerBot: 5.15, approvedHumanSkilled: 5 });
  assert.deepEqual(skilledReference(board, { group: 'v3-ladder', reference: { skilled: 5.15 } }), { referencePlannerBot: 5.15, approvedHumanSkilled: null });
});
test('loss delay excludes the mistaken removal, including automatic two-tile pairs', () => {
  const A = require('./task11_analyze.js');
  const cases = [
    { d: { tiles: [[0, 0, 0], [0, 0, 1], [8, 0, 0], [12, 0, 0]], faces: [0, 1, 0, 1], down: [], clock: { i: 0, n: 2 }, solution: [1, 0, 2, 3] },
      actions: [2, 1], states: [{ alive: [1, 1, 1, 1], tray: [], moves: 0 }, { alive: [1, 1, 0, 1], tray: [0], moves: 1 }, { alive: [1, 0, 0, 1], tray: [0, 1], moves: 2 }], delay: 1, count: 1 },
    { d: { tiles: Array.from({ length: 6 }, (_, i) => [i * 4, 0, 0]), faces: [0, 1, 1, 0, 2, 2], down: [2], clock: { i: 0, n: 1 }, solution: [0, 3, 1, 2, 4, 5] },
      actions: [2, 1], states: [{ alive: [1, 1, 1, 1, 1, 1], tray: [], moves: 0 }, { alive: [1, 1, 1, 1, 1, 1], tray: [], moves: 0 }, { alive: [1, 0, 0, 1, 1, 1], tray: [], moves: 2 }], delay: 0, count: 2 }
  ];
  for (const x of cases) {
    x.d.obst = { ice: {}, keys: [], locks: [] };
    const decisions = x.actions.map((index, k) => ({ index, state: x.states[k], remembered: x.d.faces, observed: { pictures: x.d.faces, roles: x.d.faces.map(() => null) } }));
    const raw = { profile: 'family', result: { valid: true, results: [{ wonOn: 20, attempts: [{ attempt: 1, actions: x.actions, decisions, terminal: { state: x.states[2] }, win: false, why: 'clock', censored: false }] }] } };
    const r = A.analyzer({ design: x.d }, { nodes: 30000, ms: 60, cap: 12, depthNodes: 1500 }).trace(raw), e = r.profile.attemptProfiles[0].firstError;
    assert.equal(r.profile.engineMismatches, 0); assert.equal(e.errorRemovals, x.count); assert.equal(e.actualDelayToTerminal, x.delay); assert.equal(e.preErrorToTerminalRemovals, 2);
  }
});
test('the diagnostic sample never includes frozen keys and does not invent middle-band coverage', () => {
  const boards = Array.from({ length: 100 }, (_, i) => ({ id: String(i), family: { exp: i < 40 ? 4 : i < 45 ? 10 : 20 }, skilled: { exp: 2 },
    brief: { story: 's' + i % 3 }, design: { tiles: [[i, 0, 0]], clock: { i: 0 }, obst: { keys: [0], ice: i === 42 ? { 0: 1 } : {} } } }));
  const x = P.select(boards);
  assert.equal(x.filter(b => b.band === 'middle').length, 4);
  assert.equal(x.some(b => b.id === '42'), false);
  assert.deepEqual(P.select(boards).map(b => b.id), x.map(b => b.id));
});

test('physical peeking is not scored as a fatal fourth-tile take; tray faces map to removed tile IDs', () => {
  const E = require('./engine.js'), F = require('./task11_physics.js');
  const d = { tiles: Array.from({ length: 8 }, (_, i) => [i * 4, 0, 0]), faces: [10, 11, 12, 13, 10, 11, 12, 13], down: [3, 7], clock: null };
  const g = E.game(d), before = { alive: [0, 0, 0, 1, 1, 1, 1, 1], tray: [10, 11, 12], moves: 3, openPeek: -1 }, after = { ...before, openPeek: 3 };
  const s = F.state(g, before); assert.deepEqual(s.tray, [0, 1, 2]);
  assert.equal(E.step(g, s, 3), null);
  const event = F.event(g, before, after, 3, null); assert.equal(event.kind, 'peek'); assert.equal(event.move, null); assert.equal(F.compareTransition(g, s, event, after), true);
  assert.equal(F.classifySummary(E.classify(g, s)).stateResult, 'win');
  const paired = { ...before, alive: [0, 0, 0, 0, 1, 1, 1, 0], moves: 5, openPeek: -1 };
  const pair = F.event(g, { ...before, openPeek: 7 }, paired, 3, null); assert.equal(pair.kind, 'peek-pair'); assert.equal(F.compareTransition(g, s, pair, paired), true);
});

test('an already doomed state and an unknown outcome are not counted as genuine choices', () => {
  const F = require('./task11_physics.js');
  assert.equal(F.classifySummary([{ result: 'lose' }, { result: 'lose' }]).realFork, false);
  assert.equal(F.classifySummary([{ result: 'lose' }, { result: 'unknown' }]).stateResult, 'unknown');
  assert.equal(F.classifySummary([{ result: 'lose' }, { result: 'unknown' }]).realFork, false);
  assert.equal(F.classifySummary([{ result: 'lose' }, { result: 'win' }]).realFork, true);
});

test('captured production taps map back to engine states without turning peeks into errors', () => {
  const A = require('./task11_analyze.js'), { measureHuman } = require('../sim/refit/human_bot.js');
  const d = { tiles: Array.from({ length: 8 }, (_, i) => [i * 4, 0, 0]), faces: [10, 11, 12, 13, 10, 11, 12, 13], down: [3, 7],
    obst: { ice: {}, keys: [], locks: [] }, clock: null };
  const result = measureHuman(d, { setting: 'family', seed: 4711, runs: 2, seeds: 1, maxAttempts: 3, capture: true });
  const r = A.analyzer({ design: d }, { nodes: 30000, ms: 60, cap: 12, depthNodes: 1500 }).trace({ profile: 'family', result });
  assert.equal(r.moves.length, result.results.reduce((n, c) => n + c.attempts.reduce((n, a) => n + a.decisions.length, 0), 0));
  assert.equal(r.profile.engineMismatches, 0); assert.equal(r.profile.recoveries, 0);
  assert.ok(r.moves.some(m => m.event === 'peek')); assert.ok(r.moves.filter(m => m.event === 'peek').every(m => m.result === 'win'));
});

test('descriptive rank correlations handle capped-rating ties and constant features', () => {
  const { spearman } = require('./task11_report.js');
  assert.equal(spearman([1, 2, 2, 3], [10, 20, 20, 30]), 1);
  assert.equal(spearman([1, 2, 3], [3, 2, 1]), -1);
  assert.equal(spearman([20, 20, 20], [1, 2, 3]), null);
});

test('key visibility distinguishes absent keys, hidden keys and keys that only show after the clock', () => {
  const E = require('./engine.js'), K = require('./task11_keys.js');
  const d = { tiles: [[0, 0, 0], [0, 0, 1], [6, 0, 0], [6, 0, 1], [12, 0, 0], [18, 0, 0]], faces: [0, 1, 0, 1, 2, 2],
    down: [], obst: { keys: [0, 2], locks: [5], ice: {} }, clock: { i: 4, n: 1 }, solution: [4, 1, 3, 0, 2, 5] };
  assert.equal(E.replay(d, d.solution).ok, true);
  const f = K.features(d); assert.equal(f.keysShownAtStart, 0); assert.equal(f.movesUntilBothKeysShow, 3); assert.equal(f.bothShownBeforeClock, false);
  const absent = K.features({ ...d, obst: { keys: [], locks: [], ice: {} } }); assert.equal(absent.hasKeys, false); assert.equal(absent.movesUntilBothKeysShow, null);
});

test('key-audit and main-capture protocols coexist without overwriting each other or accepting drift', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), { freezeProtocol } = require('./task11_capture.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task11-protocol-'));
  try {
    const key = freezeProtocol(dir, 'keys', { runs: 6, profiles: ['family'] }), main = freezeProtocol(dir, 'all', { runs: 2, profiles: ['family', 'planner'] });
    assert.notEqual(key, main); assert.equal(JSON.parse(fs.readFileSync(key)).runs, 6); assert.equal(JSON.parse(fs.readFileSync(main)).runs, 2);
    assert.throws(() => freezeProtocol(dir, 'keys', { runs: 2 }), /changed/);
    freezeProtocol(dir, 'keys', { runs: 6, profiles: ['family'] });
  } finally { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); fs.rmdirSync(dir); }
});

test('a cover of a key is on the stored clock route even when the search-order hint omits it', () => {
  const E = require('./engine.js'), F = require('./task11_physics.js');
  const d = { tiles: [[0, 0, 0], [0, 0, 1], [6, 0, 0], [6, 0, 1], [12, 0, 0], [18, 0, 0]], faces: [0, 1, 0, 1, 2, 2],
    down: [], obst: { keys: [0, 2], locks: [4], ice: {} }, clock: { i: 4, n: 6 }, solution: [1, 3, 0, 2, 4, 5] };
  assert.equal(E.replay(d, d.solution).ok, true);
  const g = E.game(d), s = E.step(g, E.start(g), 1); assert.equal(g.toClock[3], 0);
  assert.equal(F.reason(g, s, 3, 'take'), 'clock-route order');
  assert.equal(F.reason(g, E.start(g), 5, 'take'), 'off stored clock route');
});

test('capture executes the same explicit bot entry point that its fingerprint declares', async () => {
  const { Worker } = require('worker_threads'), M = require('../factory/meter.js'), entry = require.resolve('../sim/refit/human_bot_key_memory_v1.js');
  const bot = M.createMeter({ bot: entry }).fingerprint, worker = new Worker(require.resolve('./task11_capture_worker.js'), { env: { ...process.env, HUMAN_BOT: entry } });
  try {
    const promise = new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    worker.postMessage({ task: 'fixture', board: 'fixture', bot, profile: 'family', runs: 1,
      design: { tiles: [[0, 0, 0], [4, 0, 0]], faces: [0, 0], down: [], obst: { keys: [], locks: [], ice: {} }, clock: null } });
    const r = await promise; assert.equal(r.error, undefined); assert.equal(r.bot, bot); assert.equal(r.result.version, 'human-g6.3-key-memory-candidate1'); assert.equal(r.result.profileName, 'family-key-memory-v1');
  } finally { await worker.terminate(); }
});
