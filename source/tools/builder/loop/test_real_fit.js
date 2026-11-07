// Tests for real_ledger.js and real_fit.js:  node --test source/tools/builder/loop/test_real_fit.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const RL = require('./real_ledger.js');
const F = require('./real_fit.js');

const T0 = Date.UTC(2026, 9, 20);
let clock = 0;
const ev = (k, lv, o = {}) => ({ k, lv, t: T0 + (clock += 1000), v: '1.62', ...o });

test('sequenceOf: resumed try, restart, abandoned try, re-log, first win, replays dropped', () => {
  const s = RL.sequenceOf([
    ev('start', 150, { aid: 'a', at: 1 }), ev('start', 150, { aid: 'a', at: 1 }), ev('end', 150, { aid: 'a', at: 1, r: 'stuck' }), // resumed then lost
    ev('start', 150, { aid: 'b', at: 1 }), ev('end', 150, { aid: 'b', at: 1, r: 'stuck' }), // re-log of the same loss (at did not go up)
    ev('start', 150, { aid: 'c', at: 2 }), ev('end', 150, { aid: 'c', at: 2, r: 'restart' }), // restart = loss
    ev('start', 150, { aid: 'd', at: 3 }), // abandoned, no end
    ev('start', 150, { aid: 'e', at: 4 }), ev('end', 150, { aid: 'e', at: 4, r: 'win' }),
    ev('start', 150, { aid: 'f', at: 5 }), ev('end', 150, { aid: 'f', at: 5, r: 'stuck' }), // replay after the win
  ]);
  assert.deepStrictEqual(s.res, [0, 0, 0, 1]);
  assert.strictEqual(s.won, true);
  assert.strictEqual(s.open, false);
});

test('sequenceOf: an unfinished last try is censored, not a loss', () => {
  const s = RL.sequenceOf([ev('start', 176, { aid: 'a', at: 1 }), ev('end', 176, { aid: 'a', at: 1, r: 'stuck' }), ev('start', 176, { aid: 'b', at: 2 })]);
  assert.deepStrictEqual(s.res, [0]);
  assert.strictEqual(s.won, false);
  assert.strictEqual(s.open, true);
});

test('onCurrentBoard: version gate and board signature', () => {
  const sig = { 150: { n: 96, ck: 7 }, 88: { n: 80, ck: 9 } };
  assert.strictEqual(RL.onCurrentBoard({ k: 'end', lv: 150, v: '1.53', n: 96 }, sig), false); // before the 1.54 reorder
  assert.strictEqual(RL.onCurrentBoard({ k: 'end', lv: 150, v: '1.55', n: 96 }, sig), true);
  assert.strictEqual(RL.onCurrentBoard({ k: 'end', lv: 150, v: '1.62', n: 90 }, sig), false); // other tile count
  assert.strictEqual(RL.onCurrentBoard({ k: 'start', lv: 150, v: '1.62', n: 96, ck: 8 }, sig), false); // other clock
  assert.strictEqual(RL.onCurrentBoard({ k: 'end', lv: 88, v: '1.50', n: 80 }, sig), true); // 85-89 unchanged since 1.48
  assert.strictEqual(RL.verNum('1.10') > RL.verNum('1.9'), true);
});

test('ledger: current board only, replay after an old-board win left out, test and care accounts excluded', () => {
  const sig = { 150: { n: 96, ck: 7 }, 151: { n: 80, ck: 9 } };
  const D = 'pmuy78xu6tsths9', G = 'pmv6yhzz3x9oxs8';
  const exp = {
    [D]: {
      a: ev('start', 150, { aid: 'x', at: 1, v: '1.53', n: 96 }), b: ev('end', 150, { aid: 'x', at: 1, v: '1.53', n: 96, r: 'win' }), // won on the old board
      c: ev('start', 150, { aid: 'y', at: 2, n: 96, ck: 7 }), d: ev('end', 150, { aid: 'y', at: 2, n: 96, r: 'stuck' }),
      e: ev('start', 151, { aid: 'z', at: 1, n: 80, ck: 9 }), f: ev('end', 151, { aid: 'z', at: 1, n: 80, r: 'win' }),
      g: { k: 'start', lv: 151, m: 'd', t: T0, v: '1.62' }, // daily puzzle: ignored
    },
    [G]: { a: ev('start', 150, { aid: 'q', at: 1, n: 96, ck: 7 }), b: ev('end', 150, { aid: 'q', at: 1, n: 96, r: 'stuck' }), c: ev('start', 150, { aid: 'r', at: 2, n: 96, ck: 7 }), d: ev('end', 150, { aid: 'r', at: 2, n: 96, r: 'win' }) },
    pmuxw2uqkzcnbgx: { a: ev('end', 150, { aid: 't', n: 96, r: 'win' }) },
    pmuy4wmdp17hbws: { a: ev('end', 150, { aid: 'o', n: 96, r: 'win' }) },
  };
  const L = RL.ledger(exp, { from: 150, to: 151, sig });
  assert.strictEqual(L.skipped.replayAfterOldWin, 1);
  assert.deepStrictEqual(L.sequences.map(s => [s.who, s.lv, s.tries, s.won]), [['Dennis', 151, 1, true], ['Gerda', 150, 2, true]]);
  assert.strictEqual(L.frontier.Dennis.highestWon, 151);
  assert.ok(!L.sequences.some(s => s.who === 'OmaHanny'));
});

test('yardstick: (2 Dennis + Gerda + 2 MrsD)/5, capped at 20, unwon counts tries + 1', () => {
  const seq = (who, lv, tries, won) => ({ who, lv, tries, won, res: [] });
  const Y = RL.yardstick([seq('Dennis', 100, 1, true), seq('Gerda', 100, 40, true), seq('MrsD', 100, 4, false), seq('Dennis', 101, 1, true)]);
  assert.deepStrictEqual(Object.keys(Y), ['100']); // 101: not all three
  assert.strictEqual(Y[100].Y, (2 * 1 + 20 + 2 * 5) / 5);
  assert.strictEqual(Y[100].censored, true);
});

test('cholesky solve', () => {
  const A = new Float64Array([4, 2, 0.6, 2, 5, 1, 0.6, 1, 3]);
  const x = F.cholSolve(F.cholesky(A, 3), 3, new Float64Array([1, 2, 3]));
  const b = [0, 1, 2].map(i => A[i * 3] * x[0] + A[i * 3 + 1] * x[1] + A[i * 3 + 2] * x[2]);
  b.forEach((v, i) => assert.ok(Math.abs(v - (i + 1)) < 1e-10));
});

test('prepare: tries after the 12th are dropped (censored at 12)', () => {
  const res = new Array(15).fill(0); res[14] = 1;
  const d = F.prepare([{ who: 'Gerda', lv: 120, res, won: true }, { who: 'Dennis', lv: 120, res: [1], won: true }], { size: 20 });
  const g = d.rows.find(r => r.who === 'Gerda');
  assert.strictEqual(g.N, 12);
  assert.strictEqual(g.W, 0);
});

// a synthetic world with known skills and one window step
function world(seed, { step = 0.8, levels = 100, sdSeq = 0, sdLevel = 0 } = {}) {
  const R = F.rng(seed), seqs = [], skill = { A: 0.5, B: -0.5, C: -1.5 }, shared = {};
  for (let lv = 100; lv < 100 + levels; lv++) shared[lv] = sdLevel * R.normal();
  for (const who of Object.keys(skill)) for (let lv = 100; lv < 100 + levels; lv++) {
    const z = skill[who] - (lv >= 140 ? step : 0) - shared[lv] - sdSeq * R.normal(), p = 1 / (1 + Math.exp(-z)), res = [];
    while (res.length < 30) { const w = R.next() < p ? 1 : 0; res.push(w); if (w) break; }
    seqs.push({ who, lv, res, won: res[res.length - 1] === 1 });
  }
  return seqs;
}

test('fit recovers skills and a planted window step', () => {
  const d = F.prepare(world(1), { size: 20, from: 100, to: 199 });
  const f = F.fit(d, { tau: 2, sdLevel: 0.3 });
  assert.ok(f.converged);
  assert.ok(Math.abs(f.skill.A - f.skill.C - 2) < 0.4, 'skill gap ' + (f.skill.A - f.skill.C));
  const s = f.steps[1]; // 120-139 | 140-159
  assert.ok(Math.abs(s.est - 0.8) < 3 * s.se, `step ${s.est} +- ${s.se}`);
  assert.ok(f.steps.filter((x, i) => i !== 1).every(x => Math.abs(x.est) < 3 * x.se + 0.05));
});

test('censoring: an unfinished level only adds losses, so it lowers the skill', () => {
  const base = [{ who: 'A', lv: 100, res: [1], won: true }, { who: 'A', lv: 101, res: [0, 1], won: true }];
  const d1 = F.prepare(base, { size: 20, from: 100, to: 119 });
  const d2 = F.prepare([...base, { who: 'A', lv: 102, res: [0, 0, 0], won: false }], { size: 20, from: 100, to: 119 });
  assert.ok(F.fit(d2).skill.A < F.fit(d1).skill.A);
});

test('fit with player-level effects converges and the evidence prefers them when they exist', () => {
  const d = F.prepare(world(3, { sdSeq: 1.2, step: 0 }), { size: 20, from: 100, to: 199 });
  const ch = F.chooseSdSeq(d, {}, [0, 1.2]);
  assert.strictEqual(ch.best, 1.2);
  assert.ok(F.fit(d, { sdSeq: 1.2 }).converged);
});

test('stepTest: one player cannot confirm a step; big planted steps are detected, null rarely flagged', () => {
  const one = F.prepare(world(4).filter(s => s.who === 'A'), { size: 20, from: 100, to: 199 });
  assert.ok(F.stepTest(one).every(b => !b.lopoAgree && !b.pass2se));
  const d = F.prepare(world(5), { size: 20, from: 100, to: 199 });
  const f = F.fit(d);
  const pw = F.power(d, f, { deltas: [1.5], simsNull: 15, simsPer: 6, seed: 11 });
  const det = pw.planted.reduce((a, c) => a + c.pass2se, 0) / pw.planted.reduce((a, c) => a + c.n, 0);
  const fa = pw.nullCounts.reduce((a, c) => a + c.pass2se, 0) / pw.nullCounts.reduce((a, c) => a + c.n, 0);
  assert.ok(det > 0.8, 'detection ' + det);
  assert.ok(fa < 0.15, 'false alarms ' + fa);
});

test('real export (if present): ledger reproduces known positions', { skip: !fs.existsSync(path.resolve(__dirname, '../../../analysis/archive/plays-2026-11-07.json')) }, () => {
  const exp = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/archive/plays-2026-11-07.json'), 'utf8'));
  const L = RL.ledger(exp);
  assert.strictEqual(L.frontier.Dennis.highestWon, 199);
  assert.ok(L.diag.outcomeAgree >= 0.95 * (L.diag.outcomeAgree + L.diag.outcomeDiffer.length));
  assert.ok(!L.sequences.some(s => s.pid === 'pmuxw2uqkzcnbgx' || s.who === 'OmaHanny'));
});

test('expectedTriesCapped: geometric mean below the cap, cap respected, mixture raises it', () => {
  // p = 0.5: E[min(T,20)] = (1 - 0.5^20) / 0.5, about 2
  assert.ok(Math.abs(F.expectedTriesCapped(0, 0, 0, 20) - 2) < 1e-4);
  assert.ok(F.expectedTriesCapped(-6, 0, 0, 20) <= 20 && F.expectedTriesCapped(-6, 0, 0, 20) > 19);
  assert.ok(F.expectedTriesCapped(0, 0, 1, 20) > F.expectedTriesCapped(0, 0, 0, 20));
  assert.ok(F.expectedTriesCapped(1, 0, 0.5, 20) < F.expectedTries(1, 0, 0.5)); // capping only lowers
});

test('summarisePower: pooled rates and the kill rule', () => {
  const pw = {
    coverage: [['Dennis', 'Gerda', 'MrsD'], ['Dennis', 'Gerda']],
    nullCounts: [{ n: 100, pass2se: 2, pass2seNoLopo: 3 }, { n: 100, pass2se: 12, pass2seNoLopo: 12 }],
    planted: [{ delta: 0.35, boundary: 1, n: 50, pass2se: 40, pass2seNoLopo: 40, estMean: 0.3 }, { delta: 0.35, boundary: 2, n: 50, pass2se: 10, pass2seNoLopo: 10, estMean: 0.2 }],
  };
  const s = F.summarisePower(pw);
  assert.strictEqual(s.detection[0].pooledAll, 0.5);
  assert.strictEqual(s.detection[0].pooledThreePlayers, 0.8);
  assert.strictEqual(s.falseAlarm.worstWindow, 0.12);
  assert.strictEqual(s.kill.killed, true); // detection 0.8 passes, but one window has 12% false alarms
});

test('evidence (with the level-prior normaliser) tells shared level effects from player-by-level ones', () => {
  const shared = F.chooseSds(F.prepare(world(21, { sdLevel: 1.0, step: 0 }), { size: 20, from: 100, to: 199 }), {}, [0.3, 1.0], [0, 1.0]);
  assert.deepStrictEqual([shared.sdLevel, shared.sdSeq], [1.0, 0]);
  const own = F.chooseSds(F.prepare(world(22, { sdSeq: 1.0, step: 0 }), { size: 20, from: 100, to: 199 }), {}, [0.3, 1.0], [0, 1.0]);
  assert.strictEqual(own.sdSeq, 1.0);
});

test('power: the simulated world follows truth, not the fit setting; fits are counted', () => {
  const d = F.prepare(world(5), { size: 20, from: 100, to: 199 }), f = F.fit(d);
  const a = F.power(d, f, { deltas: [], simsNull: 2, simsPer: 0, opts: { sdSeq: 0, sdLevel: 0.3 }, truth: { sdSeq: 1.0 } });
  assert.deepStrictEqual(a.truth, { sdLevel: 0.3, sdSeq: 1.0 });
  const b = F.power(d, f, { deltas: [], simsNull: 2, simsPer: 0, opts: { sdSeq: 0.5, sdLevel: 0.6 } });
  assert.deepStrictEqual(b.truth, { sdLevel: 0.6, sdSeq: 0.5 });
  assert.strictEqual(b.fits, 2 * 4);
  assert.strictEqual(b.notConverged, 0);
});

test('expectedTries: levelSpread adds the shared level spread (Jensen: more tries than sdSeq alone)', () => {
  const o = { sdLevel: 0.3, sdSeq: 0.5 };
  assert.ok(Math.abs(F.levelSpread(o) - Math.sqrt(0.34)) < 1e-12);
  assert.ok(Math.abs(F.expectedTries(-1.72, 0, F.levelSpread(o)) - (1 + Math.exp(1.72 + 0.17))) < 1e-9);
  assert.ok(F.expectedTriesCapped(-1.72, 0, F.levelSpread(o)) > F.expectedTriesCapped(-1.72, 0, 0.5));
});

test('careLedger: an unwon level counts tries + 1, as in Y', () => {
  const O = 'pmuy4wmdp17hbws';
  const exp = { [O]: { a: ev('start', 121, { aid: 'a', at: 1 }), b: ev('end', 121, { aid: 'a', at: 1, r: 'win' }),
    c: ev('start', 122, { aid: 'b', at: 1 }), d: ev('end', 122, { aid: 'b', at: 1, r: 'stuck' }), e: ev('start', 122, { aid: 'c', at: 2 }), f: ev('end', 122, { aid: 'c', at: 2, r: 'stuck' }) } };
  const c = RL.careLedger(exp);
  assert.deepStrictEqual(c.bands['121-130'], { levels: 2, firstTry: 1, notWon: 1, firstTryRate: 0.5, meanTries: (1 + 3) / 2 });
});
