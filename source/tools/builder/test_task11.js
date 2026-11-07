'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), P = require('./task11_plan.js');
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
