'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Tl = require('./tail.js'), E = require('../engine.js');

function cycles(num = 1) {
  const d = { tiles: [[-10, 0, 0], [-20, 0, 0]], faces: [100, 100], down: [], obst: {}, clock: { i: 0, n: 3 }, solution: [1, 0] };
  for (let c = 0; c < num; c++) {
    const i = d.tiles.length, x = c * 30;
    d.tiles.push([x, 0, 0], [x, 0, 1], [x + 10, 0, 0], [x + 10, 0, 1]);
    d.faces.push(c * 2, c * 2 + 1, c * 2 + 1, c * 2);
    d.solution.push(i + 1, i + 3, i + 2, i);
  }
  return d;
}

test('forced tail: three buried twin cycles require three distinct two-waiting moments, never three waiting', () => {
  const d = cycles(3), f = Tl.forcedPressure(d, { nodes: 100000, ms: 5000 });
  assert.equal(f.cap1.result, 'lose'); assert.equal(f.cap2.result, 'win');
  assert.equal(f.episodes.minimum, 3); assert.equal(f.targetMet, true);
  assert.ok(E.replay(d, f.solution).ok);
});

test('forced tail: stored pressure is not evidence of forced pressure', () => {
  const d = cycles(1); d.faces = [100, 100, 0, 0, 1, 1];
  d.solution = [1, 0, 3, 5, 2, 4];
  assert.ok(Tl.occupancy(d).counts[2] > 0);
  const f = Tl.forcedPressure(d);
  assert.equal(f.cap1.result, 'win'); assert.equal(f.episodes.minimum, 0); assert.equal(f.targetMet, false);
});

test('capped tail: atomic peek pair can clear at one waiting; strict singles cannot', () => {
  const d = cycles(1); d.faces = [100, 100, 0, 1, 2, 2]; d.down = [4];
  // Start with picture 0 waiting, and a free picture-2 pair above its twin.
  d.tiles = [[-10, 0, 0], [-20, 0, 0], [0, 0, 0], [10, 0, 0], [0, 0, 1], [0, 0, 2]];
  // Instead use two free tops above the buried waiting twin and its match.
  d.tiles[4] = [0, 0, 1]; d.tiles[5] = [10, 0, 1];
  d.faces = [0, 1, 0, 1, 2, 2]; d.solution = [1, 0, 4, 5, 2, 3];
  // Clock is taken second: tray [picture 1, picture 0]. Cap 2 must allow the
  // atomic pair, while strict singles would require a third waiting tile.
  assert.equal(Tl.cappedTail(d, 2).result, 'win');
  assert.equal(Tl.cappedTail(d, 2, { peek: false }).result, 'lose');
});

test('capped tail: budgets return unknown, and a starting tray over cap is a proven failure', () => {
  assert.equal(Tl.cappedTail(cycles(1), 2, { nodes: 0 }).result, 'unknown');
  const d = cycles(1); d.solution = [1, 0, 3, 5, 4, 2]; d.clock.i = 3; d.clock.n = 4;
  assert.equal(Tl.cappedTail(d, 0).result, 'lose');
});

// Independent exhaustive reference using the engine's public game actions.
function reference(d, cap, limit, fromStart = false) {
  const g = E.game(d); let s0 = E.start(g);
  if (!fromStart) for (const i of d.solution.slice(0, d.solution.indexOf(d.clock.i) + 1)) s0 = E.step(g, s0, i);
  const dead = new Set();
  function rec(s, e) {
    if (!s || (s.clockTaken && s.tray.length > cap) || e > limit) return false;
    if (E.won(g, s)) return true;
    const k = s.alive.join('') + '|' + s.tray.map(i => g.faces[i]).sort().join(',') + '#' + e;
    if (dead.has(k)) return false;
    for (const a of E.legal(g, s)) {
      const t = E.step(g, s, a);
      if (t && rec(t, e + (t.clockTaken && (!s.clockTaken || s.tray.length < 2) && t.tray.length >= 2 ? 1 : 0))) return true;
    }
    dead.add(k); return false;
  }
  return rec(s0, s0.clockTaken && s0.tray.length >= 2 ? 1 : 0) ? 'win' : 'lose';
}
test('capped tail matches exhaustive reference across re-pairings, repeats, face-down pairs, caps and episode limits', () => {
  let seed = 17; const rnd = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let trial = 0; trial < 80; trial++) {
    const d = cycles(2), f = [0, 0, 1, 1, 2, 2, 3, 3];
    if (trial % 3 === 0) f.splice(4, 4, 0, 0, 1, 1);
    for (let i = f.length - 1; i; i--) { const j = rnd(i + 1); [f[i], f[j]] = [f[j], f[i]]; }
    d.faces.splice(2, 8, ...f); d.down = f.flatMap((_, i) => rnd(3) === 0 ? [i + 2] : []);
    for (const fromStart of [false, true]) for (const cap of [1, 2, 3]) for (const episodes of [0, 1, 2, Infinity]) {
      assert.equal(Tl.cappedTail(d, cap, { episodes, fromStart, nodes: 100000, ms: 5000 }).result, reference(d, cap, episodes, fromStart), JSON.stringify({ trial, cap, episodes, fromStart, d }));
    }
  }
});

test('board-wide search tries every legal prefix instead of mistaking the saved prefix for forced pressure', () => {
  const d = cycles(1); d.solution = [3, 5, 0, 1, 4, 2]; d.clock.n = 4;
  assert.equal(Tl.cappedTail(d, 2).result, 'lose', 'stored prefix enters with three waiting');
  const r = Tl.cappedTail(d, 2, { fromStart: true });
  assert.equal(r.result, 'win'); assert.ok(E.replay(d, r.solution).ok);
});

test('board-wide lower bound agrees with unpruned enumeration for buried clocks and locked routes', () => {
  for (const clock of [0, 2, 3, 6]) for (const deadline of [2, 4, 7, 10]) for (const cap of [1, 2]) {
    const d = cycles(2); d.clock = { i: clock, n: deadline };
    if (clock === 2) d.obst = { locks: [2], keys: [3, 5] };
    assert.equal(Tl.cappedTail(d, cap, { fromStart: true }).result, reference(d, cap, Infinity, true), JSON.stringify({ clock, deadline, cap }));
  }
});

module.exports = { cycles };
