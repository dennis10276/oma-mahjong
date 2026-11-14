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

// ---- the part after the trap, harder (Dennis 2026-11-14): occupancy facts, the one-waiting re-route, extra face-down tiles after the clock
test('tail: occupancy counts the tray before every tail step (shares add up) and the pressure miss is 0 for a calm route', () => {
  const d = load('chain-3-8'), o = Tl.occupancy(d), P = Tl.prepare(d);
  assert.equal(o.steps, P.tail.length); assert.equal(o.counts.reduce((a, b) => a + b, 0), o.steps); assert.ok(Math.abs(o.share.reduce((a, b) => a + b, 0) - 1) < 0.01);
  assert.equal(Tl.pressureMiss({ share: [0.3, 0.5, 0.2, 0], longest2plus: 2 }, false), 0); assert.ok(Tl.pressureMiss({ share: [0.05, 0.1, 0.45, 0.4], longest2plus: 20 }, false) > 1);
});
test('tail: reroute keeps everything but the order of the tail: same pictures, same face-down set, same clock position, strict win, no new blind gamble, and the tray is not held at 2-3 waiting', () => {
  for (const f of ['chain-3-8', 'chain-11-46']) {
    const d = load(f), g0 = Tl.gambleFacts(d), o0 = Tl.occupancy(d), r = Tl.reroute(d, { wallMs: 20000 });
    assert.ok(r.ok, f + ' ' + r.why); const e = r.design;
    assert.deepEqual(e.faces, d.faces); assert.deepEqual(e.down, d.down); assert.deepEqual(e.obst, d.obst);
    const ci = d.solution.indexOf(d.clock.i); assert.deepEqual(e.solution.slice(0, ci + 1), d.solution.slice(0, ci + 1)); assert.equal(e.solution.length, d.solution.length); assert.deepEqual(e.solution.slice().sort((a, b) => a - b), d.solution.slice().sort((a, b) => a - b));
    assert.ok(E.replay(e, e.solution, { strict: true }).ok); const g1 = Tl.gambleFacts(e); assert.ok(g1.gamble <= g0.gamble && g1.blindOnly <= g0.blindOnly);
    const o1 = Tl.occupancy(e); assert.ok(o1.share[3] <= 0.1, f + ' share of 3 waiting ' + o1.share[3]); assert.ok(Tl.pressureMiss(o1, false) <= Math.max(0.1, Tl.pressureMiss(o0, false)), 'closer to one waiting than before: ' + Tl.pressureMiss(o0, false) + ' -> ' + Tl.pressureMiss(o1, false));
    assert.equal(Tl.measure(e, { seed: 5, playouts: 100 }).tailGreedyWin, Tl.measure(d, { seed: 5, playouts: 100 }).tailGreedyWin, 'the greedy tail does not depend on the stored order');
  }
});
test('tail: addFaceDown hides only unprotected tail tiles, at most one per pair, stays under the cap and adds no blind gamble', () => {
  const d = load('chain-3-8'), P = Tl.prepare(d), g0 = Tl.gambleFacts(d), prot = new Set([d.clock.i, ...P.tail.slice(0, 5)]);
  const a = Tl.addFaceDown(d, { protect: prot, seed: 2, target: 0.27 }); assert.ok(a.added.length >= 1 && a.added.length <= a.want);
  for (const t of a.added) { assert.ok(P.inTail[t] && !prot.has(t) && !(d.down || []).includes(t)); }
  assert.ok(a.design.down.length / d.tiles.length <= 0.30); assert.equal(new Set(a.design.down).size, a.design.down.length);
  const g1 = Tl.gambleFacts(a.design); assert.ok(g1.gamble <= g0.gamble && g1.blindOnly <= g0.blindOnly); assert.ok(E.replay(a.design, a.design.solution, { strict: true }).ok);
  assert.deepEqual(a.design.faces, d.faces); assert.deepEqual(a.design.solution, d.solution);
});
