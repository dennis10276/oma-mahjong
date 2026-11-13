'use strict';
/* Tests for bank/tail.js: the bot-free tail hardness measure (tailGreedyWin) and its tuner.
     node --test source/tools/builder/bank/test_tail.js                                                                       (light: no bots, no Firebase) */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const Tl = require('./tail.js'), E = require('../engine.js'), SEP = require('./separate.js');
const dir = path.resolve(__dirname, '../../../build/traps/examples2');
const load = f => JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8')).design;
const clone = x => JSON.parse(JSON.stringify(x));

test('tail: measure is deterministic from the seed and reports the stored tail facts', () => {
  const d = load('chain-3-8'), a = Tl.measure(d, { seed: 3, playouts: 150 }), b = Tl.measure(d, { seed: 3, playouts: 150 }), c = Tl.measure(d, { seed: 4, playouts: 150 });
  assert.deepEqual(a, b); assert.ok(a.tailGreedyWin >= 0 && a.tailGreedyWin <= 1); assert.equal(a.playouts, 150);
  assert.equal(a.start.left + a.start.step, d.tiles.length); assert.ok(a.stored.peakTray <= 3 && a.stored.steps === a.start.left); assert.ok(a.stored.moves2plus <= a.stored.steps);
  assert.ok(Math.abs(a.tailGreedyWin - c.tailGreedyWin) < 0.2, 'two seeds agree roughly');
});
test('tail: the lab-5 boards Dennis found "too easy after" (292, 293, 294) are easy for the greedy player, the 5-star board 291 is not', () => {
  const easy = ['chain-15-12', 'chain-5-9', 'chain-0-1'].map(f => Tl.measure(load(f), { seed: 1, playouts: 300 }).tailGreedyWin), hard = Tl.measure(load('chain-11-46'), { seed: 1, playouts: 300 }).tailGreedyWin;
  for (const w of easy) assert.ok(w > 0.85, 'too easy after: ' + w);
  assert.ok(hard < 0.5, '291 tail ' + hard);
});
test('tail: a board that cannot be cleared by the stored solution is not measured as won (broken tail -> replay check fails)', () => {
  const d = load('chain-3-8'), P = Tl.prepare(d), faces = d.faces.slice(), t = P.tail[0], o = P.tail.find(x => faces[x] !== faces[t]);
  assert.equal(Tl.tailReplays(P, faces), true);
  faces[o] = faces[t];   // three copies of a picture: the stored tail no longer matches pairwise
  assert.equal(Tl.tailReplays(P, faces), false);
});
test('tail: the tuner brings a too-easy tail into the band, keeps the stored solution a strict win, the clock, the face-down set, the twins apart and adds no blind gamble', () => {
  const d = load('chain-3-8'), k = d.solution.indexOf(d.clock.i) + 1, kOf = x => E.clockShortest(E.game(clone(x)), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity }).k;
  const k0 = kOf(d), c0 = SEP.closeTwins(d), g0 = Tl.gambleFacts(d);
  const r = Tl.tune(d, { band: [0.15, 0.40], wallMs: 20000, seed: 1, validate: x => E.replay(x, x.solution, { strict: true }).ok ? { ok: true } : { ok: false, why: 'replay' } });
  assert.ok(r.before.tailGreedyWin > 0.8, 'starts easy'); assert.ok(r.inBand && r.after.tailGreedyWin >= 0.15 && r.after.tailGreedyWin <= 0.40, 'tail in band: ' + r.after.tailGreedyWin);
  assert.ok(E.replay(r.design, r.design.solution, { strict: true }).ok); assert.deepEqual(r.design.solution, d.solution); assert.deepEqual(r.design.down, d.down); assert.deepEqual(r.design.obst, d.obst); assert.deepEqual(r.design.tiles, d.tiles);
  assert.equal(r.design.solution.indexOf(r.design.clock.i) + 1, k); assert.equal(kOf(r.design), k0);
  const c1 = SEP.closeTwins(r.design); assert.ok(c1.visible <= c0.visible && c1.four <= c0.four && c1.count <= c0.count);
  const g1 = Tl.gambleFacts(r.design); assert.ok(g1.gamble <= g0.gamble && g1.blindOnly <= g0.blindOnly);
  // only pictures after the clock changed, and only on whole pairs inside the tail
  const P = Tl.prepare(d); for (let i = 0; i < d.faces.length; i++) if (d.faces[i] !== r.design.faces[i]) assert.ok(P.inTail[i], 'tile ' + i + ' lies in the tail');
  // a fresh seed agrees (no overfitting to the tuning seed)
  const fresh = Tl.measure(r.design, { seed: 4242, playouts: 600 }).tailGreedyWin; assert.ok(fresh > 0.1 && fresh < 0.47, 'fresh seed ' + fresh);
});
test('tail: a failing validate keeps the longest valid prefix and a tail already in band is left alone', () => {
  const d = load('chain-11-46'), m = Tl.measure(d, { seed: 977, playouts: 800 }).tailGreedyWin;
  const r0 = Tl.tune(d, { band: [0.15, 0.40], wallMs: 5000, validate: () => ({ ok: true }) });
  if (m >= 0.15 && m <= 0.40) assert.equal(r0.swaps, 0); assert.deepEqual(r0.design.faces, d.faces);
  const e = load('chain-0-1'), r1 = Tl.tune(e, { band: [0.15, 0.40], wallMs: 8000, validate: () => ({ ok: false, why: 'never' }) });
  assert.equal(r1.swaps, 0); assert.deepEqual(r1.design.faces, e.faces); assert.ok(!r1.inBand);
});
