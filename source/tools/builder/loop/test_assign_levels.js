'use strict';
// node --test source/tools/builder/loop/test_assign_levels.js   (synthetic libraries only; no files, no bots)
const test = require('node:test'), assert = require('node:assert/strict');
const A = require('./assign_levels.js');

const STORIES = ['keysFarSide', 'keysOnIsland', 'clockInSight', 'iceLockClock', 'lockBeside', 'roomInTrayLocked', 'roomInTrayFrozen', 'deepClock'];
let uid = 0;
const pair = (D, o = {}) => ({ key: o.key || 'p' + (++uid), spare: o.spare ?? 2, D, S: o.S ?? 4, Strusted: o.Strusted ?? true, story: o.story ?? STORIES[uid % STORIES.length],
  tiles: o.tiles ?? 80, bigBoard: (o.tiles ?? 80) > 88, openingClock: !!o.openingClock, maxTarget: o.maxTarget ?? null, archetype: o.archetype ?? null });
const flat = { T0: 6, L0: 200, g: 1, cap: 14 };
// a pair that lands exactly on the slot target of level L (spare 2, rotating stories)
const exact = (L, trend = flat, o = {}) => { const s = A.slotFor(L, { bigBoard: (o.tiles ?? 80) > 88 }, { trend, shape: A.DEFAULTS.shape }); return pair(s.target, { story: STORIES[L % STORIES.length], ...o }); };
const rng = seed => { let x = seed >>> 0 || 1; return () => (x = (x * 1103515245 + 12345) >>> 0) / 4294967296; };

test('trend, cap and slot shapes', () => {
  const t = { T0: 6, L0: 200, g: 1.01, cap: 14 };
  assert.equal(A.trendAt(200, t), 6);
  assert(Math.abs(A.trendAt(225, t) - 6 * 1.01 ** 25) < 1e-9);
  assert.equal(A.trendAt(400, t), 14, 'held at the cap');
  const o = { trend: flat, shape: A.DEFAULTS.shape };
  assert.equal(A.slotFor(201, {}, o).shape, 'breather'); assert(Math.abs(A.slotFor(202, {}, o).target - 5.4) < 1e-12);
  assert.equal(A.slotFor(205, {}, o).target, 6);
  assert.equal(A.slotFor(210, { bigBoard: true }, o).shape, 'peak'); assert(Math.abs(A.slotFor(210, { bigBoard: true }, o).target - 6.9) < 1e-12);
  assert.equal(A.slotFor(210, { bigBoard: false }, o).target, 6, 'no peak without a big board');
  assert.equal(A.levelTol(6, A.DEFAULTS), 1); assert(Math.abs(A.levelTol(13, A.DEFAULTS) - 1.3) < 1e-12);
});

test('per-level rules: tolerance, spike, big board, opening clock, skilled, B7', () => {
  const o = { ...A.DEFAULTS, trend: flat };
  const why = (L, p) => A.levelCheck(L, p, o).why;
  assert.equal(why(205, pair(6.9)), null);
  assert.equal(why(205, pair(7.1)), 'tooHard');
  assert.equal(why(201, pair(4.3)), 'tooEasy');        // breather 5.4, tol 1
  assert.equal(why(205, pair(6, { tiles: 92 })), 'bigBoardOffSlot');
  assert.equal(why(210, pair(6.9, { tiles: 92 })), null);
  assert.equal(why(210, pair(7.8, { tiles: 92 })), null, 'a named peak may sit above the spike cap');
  assert.equal(why(205, pair(6, { spare: 1, openingClock: true })), 'openingClock');
  assert.equal(why(210, pair(6.9, { spare: 1, openingClock: true, tiles: 92 })), null, 'allowed on a named peak');
  assert.equal(why(205, pair(6, { S: 2.4 })), 'skilledLow');
  assert.equal(why(205, pair(6, { S: 6.5 })), 'skilledHigh');
  assert.equal(why(205, pair(6, { Strusted: false })), 'skilledUnknown');
  assert.equal(A.levelCheck(205, pair(6, { S: 2.4 }), { ...o, skilled: { ...o.skilled, floor: 'average' } }).why, null);
  assert.equal(why(205, pair(6, { maxTarget: 5 })), 'b7Inflated');
  // spike cap binds above tolerance only when tolerance is wider: with a 30% tolerance a 7.5 on trend 6 is a spike
  assert.equal(A.levelCheck(205, pair(7.5), { ...o, tolerance: { abs: 1, rel: 0.3 } }).why, 'spike');
});

test('a perfect library fills a range exactly and keeps every rule', () => {
  const trend = { T0: 6, L0: 200, g: 1.008, cap: 14 };
  const pairs = [];
  for (let L = 200; L <= 225; L++) pairs.push(exact(L, trend, L % 10 === 0 ? { tiles: 92 } : {}));
  for (let i = 0; i < 30; i++) pairs.push(pair(3 + 10 * Math.random()));   // noise
  const r = A.assign(pairs, { from: 200, to: 225, trend });
  assert.equal(r.unfillable.length, 0);
  assert.equal(r.proven, true);
  assert(r.totalCost < 1e-9, 'cost ' + r.totalCost);
  assert.equal(r.levels.find(l => l.level === 210).shape, 'peak');
  assert(r.windows.every(w => w.ok));
  assert.equal(new Set(r.levels.map(l => l.key)).size, r.levels.length);
  assert.match(r.text, /26 of 26 filled/);
});

test('spare 1: at most 1 in 5 and never twice in a row', () => {
  // every level has a perfect spare-1 pair and a slightly worse spare-2 pair
  const pairs = [];
  for (let L = 203; L <= 209; L++) { pairs.push(exact(L, flat, { spare: 1 })); pairs.push(pair(6.3, { story: STORIES[(L + 3) % STORIES.length] })); }
  const r = A.assign(pairs, { from: 203, to: 209, trend: flat });
  const ones = r.levels.filter(l => l.spare === 1).map(l => l.level);
  assert(ones.length >= 1);
  for (let a = 203; a <= 209; a++) assert(ones.filter(L => L >= a && L < a + 5).length <= 1, 'window from ' + a + ': ' + ones);
  // context: a spare-1 level at 202 forbids spare 1 on 203-206
  const r2 = A.assign(pairs, { from: 203, to: 209, trend: flat, context: [{ level: 202, D: 5.4, spare: 1, story: 'x' }] });
  assert(r2.levels.filter(l => l.spare === 1).every(l => l.level >= 207));
});

test('story spacing: no story twice in 3 consecutive levels', () => {
  const pairs = [];
  for (let L = 203; L <= 208; L++) { pairs.push(pair(6, { story: 'deepClock' })); pairs.push(pair(6.4, { story: L % 2 ? 'lockBeside' : 'keysFarSide' })); }
  const r = A.assign(pairs, { from: 203, to: 208, trend: flat });
  assert.equal(r.unfillable.length, 0);
  const st = r.levels.map(l => l.story);
  for (let i = 0; i + 2 < st.length; i++) assert.equal(new Set(st.slice(i, i + 3)).size, 3, st.join(','));
});

test('window mean: levels each within tolerance but all biased high are refused as a window', () => {
  const pairs = [];
  for (let L = 203; L <= 207; L++) pairs.push(pair(6.9, { story: STORIES[L % 8] }));   // +0.9 each: window mean +0.9 > 0.5
  let r = A.assign(pairs, { from: 203, to: 207, trend: flat });
  assert(r.unfillable.length >= 1, 'some level must stay open');
  assert(r.unfillable.every(u => u.reason === 'conflict' && u.conflicts.window >= 1), JSON.stringify(r.unfillable));
  assert(r.windows.every(w => w.ok), 'holes count as on target and the window holds');
  for (let L = 203; L <= 207; L++) pairs.push(pair(5.6, { story: STORIES[(L + 4) % 8] }));   // -0.4 options
  r = A.assign(pairs, { from: 203, to: 207, trend: flat });
  assert.equal(r.unfillable.length, 0);
  assert(Math.abs(r.levels.reduce((s, l) => s + l.dev, 0) / 5) <= 0.5 + 1e-9);
});

test('skilled floor: hard refuses S < 2.5, average allows it when the 5-level mean holds', () => {
  const pairs = [];
  for (let L = 203; L <= 207; L++) pairs.push(pair(6, { S: L === 205 ? 1.8 : 3, story: STORIES[L % 8] }));
  let r = A.assign(pairs, { from: 203, to: 207, trend: flat });
  assert.equal(r.unfillable.length, 1, 'four usable puzzles for five levels');
  assert(!r.levels.some(l => l.S === 1.8));
  r = A.assign(pairs, { from: 205, to: 205, trend: flat, exclude: pairs.filter(p => p.S !== 1.8).map(p => p.key) });
  assert.deepEqual(r.unfillable.map(u => [u.level, u.reason, u.failures.skilledLow]), [[205, 'noCandidate', 1]]);
  r = A.assign(pairs, { from: 203, to: 207, trend: flat, skilled: { floor: 'average' } });
  assert.equal(r.unfillable.length, 0);   // mean S = (4 x 3 + 1.8) / 5 = 2.76
  const low = pairs.map(p => ({ ...p, S: 2 }));
  r = A.assign(low, { from: 203, to: 207, trend: flat, skilled: { floor: 'average' } });
  assert(r.unfillable.length >= 1, 'a window mean of 2 is under the floor');
});

test('unfillable slots are reported plainly with the reasons and nearest misses', () => {
  const pairs = [pair(12), pair(13), pair(6, { tiles: 92 })];
  const r = A.assign(pairs, { from: 204, to: 205, trend: flat });
  assert.equal(r.unfillable.length, 2);
  const u = r.unfillable[0];
  assert.equal(u.reason, 'noCandidate');
  assert.equal(u.failures.tooHard, 2); assert.equal(u.failures.bigBoardOffSlot, 1);
  assert.equal(u.nearest[0].D, 12);
  assert.match(u.text, /no pair in the library fits/);
  assert.match(r.text, /Unfillable \(2\)/);
});

test('each puzzle once (also across spares), and exclude', () => {
  const p2 = pair(6, { key: 'only', spare: 2, story: 'a' }), p3 = pair(6, { key: 'only', spare: 3, story: 'b' });
  let r = A.assign([p2, p3], { from: 204, to: 205, trend: flat });
  assert.equal(r.levels.filter(l => !l.hole).length, 1);
  r = A.assign([p2, p3], { from: 204, to: 205, trend: flat, exclude: ['only'] });
  assert.equal(r.levels.filter(l => !l.hole).length, 0);
  assert.equal(r.excluded, 2);
});

// An independent brute force over every assignment (no holes), for small random libraries.
function brute(pairs, from, to, trend) {
  const o = { ...A.DEFAULTS, trend }, levels = []; for (let L = from; L <= to; L++) levels.push(L);
  const ok = levels.map(L => pairs.map(p => ({ p, c: A.levelCheck(L, p, o) })).filter(x => !x.c.why));
  let best = Infinity;
  const pick = [];
  const valid = () => {
    for (let i = 0; i < pick.length; i++) {
      if (pick[i].p.spare === 1 && pick.slice(Math.max(0, i - 4), i).some(x => x.p.spare === 1)) return false;
      if (pick.slice(Math.max(0, i - 2), i).some(x => x.p.story === pick[i].p.story)) return false;
    }
    for (let a = 0; a + 5 <= pick.length; a++) {
      const w = pick.slice(a, a + 5), dev = w.reduce((s, x) => s + x.p.D - x.c.s.target, 0) / 5, T = w.reduce((s, x) => s + x.c.s.T, 0) / 5;
      if (Math.abs(dev) > Math.max(0.5, 0.05 * T) + 1e-9) return false;
    }
    return new Set(pick.map(x => x.p.key)).size === pick.length;
  };
  (function go(i) {
    if (i === levels.length) { if (valid()) best = Math.min(best, pick.reduce((s, x) => s + Math.abs(Math.log(x.p.D / x.c.s.target)), 0)); return; }
    for (const x of ok[i]) { pick.push(x); go(i + 1); pick.pop(); }
  })(0);
  return best;
}
test('branch-and-bound matches brute force on random small libraries', () => {
  const R = rng(7);
  let compared = 0;
  for (let t = 0; t < 25; t++) {
    const pairs = [];
    for (let i = 0; i < 9; i++) pairs.push(pair(4.5 + 3 * R(), { key: 'k' + (i % 7), spare: 1 + Math.floor(3 * R()), story: STORIES[Math.floor(4 * R())] }));
    const want = brute(pairs, 205, 210, flat);
    const r = A.assign(pairs, { from: 205, to: 210, trend: flat, allowHoles: false });
    if (want === Infinity) { assert.equal(r.levels.length, 0, 'no full assignment exists'); continue; }
    assert(r.proven);
    assert(Math.abs(r.totalCost - want) < 1e-3, `trial ${t}: b&b ${r.totalCost} vs brute ${want}`);
    compared++;
  }
  assert(compared >= 5, 'enough feasible trials: ' + compared);
});

test('a big library over 50 levels finishes fast', () => {
  const R = rng(3), trend = { T0: 6, L0: 200, g: 1.008, cap: 14 }, pairs = [];
  for (let i = 0; i < 600; i++) {
    const big = R() < 0.08;
    pairs.push(pair(3 + 10 * R(), { key: 'b' + i, spare: 1 + Math.floor(3 * R()), story: STORIES[Math.floor(8 * R())], tiles: big ? 92 : 80, S: 2 + 4.5 * R(), openingClock: R() < 0.2 }));
  }
  const t = Date.now(), r = A.assign(pairs, { from: 200, to: 249, trend, maxNodes: 3e5 });
  assert(Date.now() - t < 20000);
  assert(r.levels.filter(l => !l.hole).length >= 45, r.text);
  const ones = r.levels.filter(l => l.spare === 1).map(l => l.level);
  for (let a = 196; a <= 249; a++) assert(ones.filter(L => L >= a && L < a + 5).length <= 1);
});

test('tolerance is on the trend T; CURVE pairs can be dropped and are counted', () => {
  const o = { trend: flat, shape: A.DEFAULTS.shape, tolerance: A.DEFAULTS.tolerance };
  const s = A.slotFor(201, pair(5), { ...o });   // breather 0.9 T
  assert.equal(A.levelTol(s.T, A.merge ? A.merge(A.DEFAULTS, o) : { ...A.DEFAULTS, ...o }), Math.max(1, 0.1 * 6));
  const ps = [201].map(L => { const p = exact(L); p.Dsource = 'CURVE'; return p; });
  const r1 = A.assign(ps, { from: 201, to: 201, trend: flat, dropCurve: true });
  assert.equal(r1.curveDropped, 1); assert.equal(r1.levels.filter(l => l.key).length, 0);
  const r2 = A.assign(ps, { from: 201, to: 201, trend: flat });
  assert.equal(r2.curveFilled, 1);
});
