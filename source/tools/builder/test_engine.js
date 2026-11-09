/* Tests for engine.js: tiny hand boards per rule, a brute-force cross-check on random small boards, and the 18
   qualified boards (winnable from the start and along the stored solution; step() agrees with validSolution).
     node --test source/tools/builder/test_engine.js                                                       */
'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const L = global.Layouts, Hard = require('../../www/hard.js');
const { exactRoute } = require('../lab/exact.js');

const row = (...xs) => xs.map(x => [x, 0, 0]);               // tiles far apart unless x differs by 2
const board = (tiles, faces, more = {}) => ({ tiles, faces, down: [], gold: [], obst: { ice: {}, locks: [], keys: [] }, clock: null, ...more });
const play = (g, moves) => moves.reduce((s, m) => s && E.step(g, s, m), E.start(g));
const res = (g, s, o) => E.winnable(g, s, o).result;

test('editing a design invalidates cached physics and proofs for every rules mode', () => {
  for (const options of [{}, { strict: true }, { clockAfterAction: false }]) {
    const d = board([[0, 0, 0], [0, 0, 1], [4, 0, 0], [8, 0, 0]], [0, 1, 1, 0], { clock: { i: 0, n: 4 }, solution: [2, 1, 0, 3] });
    const g = E.game(d, options);
    assert.equal(res(g, E.start(g)), 'win');
    assert.strictEqual(E.game(d, options), g);
    d.clock.n = 1;
    const changed = E.game(d, options);
    assert.notStrictEqual(changed, g);
    assert.equal(res(changed, E.start(changed)), 'lose');
    d.faces[3] = 2;
    assert.notStrictEqual(E.game(d, options), changed);
  }
});

test('free and blocked: a row frees its ends, a tile on top blocks both below it', () => {
  const g = E.game(board([[0, 0, 0], [2, 0, 0], [4, 0, 0], [8, 0, 0]], [0, 1, 1, 0]));
  assert.deepEqual(E.legal(g, E.start(g)), [0, 2, 3]);
  const h = E.game(board([[0, 0, 0], [2, 0, 0], [4, 0, 0], [1, 0, 1]], [0, 1, 0, 1]));
  assert.deepEqual(E.legal(h, E.start(h)), [2, 3]);
  assert.deepEqual(E.legal(h, play(h, [3])), [0, 2]);
  assert.equal(res(h, E.start(h)), 'win');
});

test('ice h=1 and h=2 count neighbours gone since the start', () => {
  const g1 = E.game(board(row(0, 2), [0, 0], { obst: { ice: { 1: 1 }, locks: [], keys: [] } }));
  assert.deepEqual(E.legal(g1, E.start(g1)), [0]);
  assert.deepEqual(E.legal(g1, play(g1, [0])), [1]);
  assert.throws(() => E.step(g1, E.start(g1), 1));
  // A (0,0) has ice-neighbours B (2,0) and C (0,2); D is far away
  const d2 = board([[0, 0, 0], [2, 0, 0], [0, 2, 0], [8, 0, 0]], [0, 1, 1, 0], { obst: { ice: { 0: 2 }, locks: [], keys: [] } });
  const g2 = E.game(d2);
  assert.deepEqual(E.legal(g2, E.start(g2)), [1, 2, 3]);
  assert.ok(!E.legal(g2, play(g2, [1])).includes(0));
  assert.ok(E.legal(g2, play(g2, [1, 2])).includes(0));
  assert.equal(res(g2, E.start(g2)), 'win');
  // ice that can never melt: lose, proven
  const g3 = E.game(board(row(0, 8), [0, 0], { obst: { ice: { 0: 1 }, locks: [], keys: [] } }));
  assert.equal(res(g3, E.start(g3)), 'lose');
});

test('a lock opens when both keys are gone', () => {
  const g = E.game(board(row(0, 4, 8, 12), [0, 0, 1, 1], { obst: { ice: {}, locks: [2], keys: [0, 1] } }));
  assert.deepEqual(E.legal(g, E.start(g)), [0, 1, 3]);
  assert.ok(!E.legal(g, play(g, [0])).includes(2));
  assert.ok(E.legal(g, play(g, [0, 1])).includes(2));
  // a key that is locked itself can never go: lose, proven
  const h = E.game(board(row(0, 4, 8, 12), [0, 0, 1, 1], { obst: { ice: {}, locks: [0], keys: [0, 1] } }));
  assert.equal(res(h, E.start(h)), 'lose');
  assert.equal(res(g, E.start(g)), 'win');
});

test('a 4th waiting tile loses; matches always fit', () => {
  const g = E.game(board(row(0, 4, 8, 12, 16, 20, 24, 28), [0, 1, 2, 3, 0, 1, 2, 3]));
  const s = play(g, [0, 1, 2]);
  assert.equal(s.tray.length, 3);
  assert.equal(E.step(g, s, 3), null);
  assert.equal(E.step(g, s, 4).tray.length, 2);
  assert.equal(res(g, s), 'win');
  const c = E.classify(g, s);
  assert.deepEqual(c.find(x => x.move === 3), { move: 3, result: 'lose', depth: 0 });
});

test('clock deadline: the clock must be taken at a move index < n', () => {
  // clock C (0) under T (1); X, Y far away. T,C at moves 0,1 -> needs n >= 2
  const tiles = [[0, 0, 0], [0, 0, 1], [6, 0, 0], [10, 0, 0]], faces = [0, 1, 0, 1];
  const g1 = E.game(board(tiles, faces, { clock: { i: 0, n: 1 } }));
  assert.equal(res(g1, E.start(g1)), 'lose');
  const g2 = E.game(board(tiles, faces, { clock: { i: 0, n: 2 } }));
  const w = E.winnable(g2, E.start(g2));
  assert.equal(w.result, 'win'); assert.deepEqual(w.path.slice(0, 2), [1, 0]);
  assert.equal(E.step(g2, play(g2, [2, 3]), 1) === null, true);        // moves = 2 = n with the clock on the board
  const c = E.classify(g2, E.start(g2));
  assert.deepEqual(c.map(x => [x.move, x.result, x.depth]), [[1, 'win', undefined], [2, 'lose', 1], [3, 'lose', 1]]);
  assert.equal(E.clockShortest(g2).k, 2);
  assert.equal(E.clockShortest(E.game(board(tiles, faces, { clock: { i: 0, n: 2 } }), { strict: true })).k, 2);
  // a free tray match is NOT safe first while the clock waits: A (0) taken, B (1) would match, clock (2) due now
  const g3 = E.game(board(row(0, 4, 8, 12), [0, 0, 1, 1], { clock: { i: 2, n: 2 } }));
  const s = play(g3, [0]);
  assert.equal(res(g3, s), 'win');
  assert.equal(E.classify(g3, s).find(x => x.move === 1).result, 'lose');
});

test('peek pair: a face-down tile and its free twin go together, without a tray slot', () => {
  // three singles waiting (0, 1, 2); their twins (5, 6, 7) lie under the face-down pair (3, 4)
  const d = board([[0, 0, 0], [4, 0, 0], [8, 0, 0], [21, 10, 1], [23, 10, 1], [20, 10, 0], [22, 10, 0], [24, 10, 0]], [0, 1, 2, 3, 3, 0, 1, 2], { down: [3] });
  const g = E.game(d), s = play(g, [0, 1, 2]);
  assert.equal(s.tray.length, 3);
  assert.deepEqual(E.legal(g, s), [3, 4, { pair: [4, 3] }]);
  const s2 = E.step(g, s, { pair: [4, 3] });
  assert.equal(s2.tray.length, 3); assert.equal(s2.moves, 5);
  assert.equal(res(g, s), 'win');
  assert.deepEqual(E.winnable(g, s).path[0], { pair: [4, 3] });
  const strict = E.game(d, { strict: true });
  assert.equal(res(strict, play(strict, [0, 1, 2])), 'lose');      // validSolution / exact.js rules: no way out
  // no pair when the picture already waits in the tray, nor for two face-up twins
  const h = E.game(board(row(0, 4, 8, 12), [0, 0, 0, 0], { down: [2] }));
  assert.ok(!E.legal(h, play(h, [0])).some(m => typeof m === 'object'));
  assert.ok(E.legal(h, E.start(h)).some(m => typeof m === 'object' && m.pair.includes(2)));
  const u = E.game(board(row(0, 4), [0, 0]));
  assert.ok(!E.legal(u, E.start(u)).some(m => typeof m === 'object'));
  // board.js takes both tiles off before checkClock: its second tile can save the clock at the boundary.
  const dc = board(row(0, 4, 8, 12), [0, 0, 1, 1], { down: [1], clock: { i: 1, n: 1 } }), c = E.game(dc);
  assert.equal(E.step(c, E.start(c), { pair: [0, 1] }).clockTaken, true);
  assert.equal(E.step(E.game(dc, { clockAfterAction: false }), E.start(c), { pair: [0, 1] }), null);
  assert.deepEqual(E.replay(dc, [0, 1, 2, 3]), { ok: true, pairs: 1 });
  assert.equal(E.clockShortest(c).k, 1);                        // the clock alone first
  const dd = board(row(0, 4, 8, 12), [0, 0, 1, 1], { down: [0, 1], clock: { i: 1, n: 1 } }), cd = E.game(dd);
  assert.deepEqual(E.legal(cd, E.start(cd)).filter(m => typeof m === 'object'), [{ pair: [1, 0] }]);   // both face-down: clock first
  assert.equal(E.step(cd, E.start(cd), { pair: [1, 0] }).clockTaken, true);
  const c2 = E.game(board(row(0, 4, 8, 12), [0, 0, 1, 1], { down: [1], clock: { i: 2, n: 2 } }));
  assert.equal(E.step(c2, E.start(c2), { pair: [0, 1] }).moves, 2);
  assert.equal(res(c2, E.start(c2)), 'win');                   // e.g. 2 first
  assert.equal(E.classify(c2, E.start(c2)).find(x => typeof x.move === 'object').result, 'lose');
});

// ---------- brute force on random small boards ----------
function brute(g, s, memo = new Map()) {
  const key = Array.from(s.alive).join('') + '|' + s.tray.map(t => g.faces[t]).sort().join(',') + '|' + (s.clockTaken ? '' : s.moves);
  if (memo.has(key)) return memo.get(key);
  let r = E.won(g, s);
  if (!r) for (const m of E.legal(g, s)) { const t = E.step(g, s, m); if (t && brute(g, t, memo)) { r = true; break; } }
  memo.set(key, r); return r;
}
// tight: more pictures, more face-down tiles and a third layer, so peek pairs and the clock rule decide more often
function randomBoard(seed, tight) {
  const r = L.rng(seed), spots = [];
  for (let x = 0; x <= 8; x += 2) for (let y = 0; y <= 4; y += 2) spots.push([x, y, 0]);
  if (tight) for (let x = 2; x <= 6; x += 2) spots.push([x, 2, 2]);
  for (let x = 1; x <= 7; x += 2) for (let y = 1; y <= 3; y += 2) spots.push([x, y, 1]);
  const n = (tight ? 10 : 8) + 2 * Math.floor(r() * 4), tiles = L.shuffleArr(r, spots).slice(0, n);
  const faces = []; for (let k = 0; k < n / 2; k++) { const f = r() < (tight ? 0.1 : 0.3) && k ? faces[faces.length - 1] : k; faces.push(f, f); }
  L.shuffleArr(r, faces);
  const d = board(tiles, faces);
  d.down = [...Array(n).keys()].filter(() => r() < (tight ? 0.5 : 0.3));
  if (r() < 0.5) d.obst.ice[Math.floor(r() * n)] = 1 + Math.floor(r() * 2);
  if (r() < 0.4) { const a = faces.indexOf(faces[0], 1); d.obst.keys = [0, a]; d.obst.locks = [Math.floor(r() * n)].filter(i => i !== 0 && i !== a); }
  if (r() < 0.7) d.clock = { i: Math.floor(r() * n), n: 1 + Math.floor(r() * n * 0.7) };
  return d;
}
test('winnable, clockShortest, replay and classify agree with a brute force on 600 random small boards', () => {
  let wins = 0, loses = 0, peekDecides = 0;
  for (let seed = 1; seed <= 600; seed++) {
    const d = randomBoard(seed > 300 ? seed - 300 : seed, seed > 300);
    if (brute(E.game(d), E.start(E.game(d))) && !brute(E.game(d, { strict: true }), E.start(E.game(d, { strict: true })))) peekDecides++;
    for (const strict of [false, true]) {
      const g = E.game(d, { strict }), s = E.start(g), want = brute(g, s);
      if (!strict) { const gp = E.game(d, { clockAfterAction: false }); assert.equal(E.winnable(gp, E.start(gp)).result, brute(gp, E.start(gp)) ? 'win' : 'lose', `per-tile seed ${seed}`); }
      const got = E.winnable(g, s);
      assert.equal(got.result, want ? 'win' : 'lose', `seed ${seed} strict ${strict}`);
      if (want) { wins++; assert.ok(E.won(g, play(g, got.path)), `path seed ${seed}`); } else loses++;
      for (const c of E.classify(g, s)) { const t = E.step(g, s, c.move); assert.equal(c.result, t && brute(g, t) ? 'win' : 'lose', `classify seed ${seed}`); }
      if (d.clock) {
        // the smallest clock.n that keeps the board winnable
        let kmin = null; for (let n = 1; n <= d.tiles.length && kmin === null; n++) { const gn = E.game({ ...d, clock: { i: d.clock.i, n } }, { strict }); if (brute(gn, E.start(gn))) kmin = n; }
        const cs = E.clockShortest(E.game({ ...d }, { strict }));
        assert.equal(cs ? cs.k : null, kmin, `clockShortest seed ${seed} strict ${strict}`);
        if (cs) {
          const dk = { ...d, clock: { i: d.clock.i, n: cs.k } }, rp = E.replay(dk, E.flatten(cs.path), { strict });
          assert.ok(rp.ok, `replay of clockShortest seed ${seed} strict ${strict} ${JSON.stringify(rp)}`);
          assert.ok(!E.replay({ ...d, clock: { i: d.clock.i, n: cs.k - 1 } }, E.flatten(cs.path), { strict }).ok);
        }
        if (!strict) {        // diagnostic per-tile timing can require one extra move
          const cp = E.clockShortest(E.game({ ...d }, { clockAfterAction: false }));
          let kp = null; for (let n = 1; n <= d.tiles.length && kp === null; n++) { const gn = E.game({ ...d, clock: { i: d.clock.i, n } }, { clockAfterAction: false }); if (brute(gn, E.start(gn))) kp = n; }
          assert.equal(cp ? cp.k : null, kp, `per-tile clockShortest seed ${seed}`);
          if (kp !== null) assert.ok(kp - kmin <= 1 && kp >= kmin);
        }
        if (!strict) { const own = E.clockSearch(E.game({ ...d }, { strict: true })); assert.equal(own ? own.k : null, (E.clockShortest(E.game({ ...d }, { strict: true })) || {}).k ?? null, `own vs exact.js seed ${seed}`); }
      }
    }
  }
  assert.ok(wins > 50 && loses > 50 && peekDecides >= 3, `${wins} wins, ${loses} losses, ${peekDecides} won only with peek pairs`);
});

// ---------- the qualified boards ----------
const QUAL = fs.readFileSync(path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'qualified-200-225.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l).design);
test('every qualified board: step() agrees with validSolution, winnable from the start and along its solution', () => {
  for (const d of QUAL) {
    for (const strict of [false, true]) {
      const g = E.game(d, { strict });
      assert.equal(Hard.validSolution(g, d.solution), true);
      let s = E.start(g);
      for (let k = 0; k < d.solution.length; k++) {
        assert.equal(E.winnable(g, s, { nodes: 3e6, ms: 20000 }).result, 'win', `board ${d.level} step ${k}`);
        s = E.step(g, s, d.solution[k]); assert.ok(s);
      }
      assert.ok(E.won(g, s));
    }
  }
});

test('step() and validSolution agree on random play-outs (strict rules)', () => {
  for (const d of QUAL.slice(0, 6)) {
    const g = E.game(d, { strict: true }), r = L.rng(d.tiles.length * 7 + d.clock.n);
    for (let run = 0; run < 40; run++) {
      const p = []; let s = E.start(g), alive = true;
      while (p.length < d.tiles.length) {
        const ms = E.legal(g, s); if (!ms.length) break;
        const m = ms[Math.floor(r() * ms.length)]; p.push(m); s = E.step(g, s, m);
        if (!s) { alive = false; break; }
      }
      if (p.length < d.tiles.length) assert.equal(Hard.validSolution(g, p), false);   // stuck or lost early
      else assert.equal(Hard.validSolution(g, p), alive && E.won(g, s));
    }
  }
});

test('replay(strict) = validSolution on the qualified and the 1,989 training designs; replay(game) accepts them too', () => {
  const train = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'training-data.json'), 'utf8')).map(r => r.design).filter(Boolean);
  // an independent game object, built like tools/lab/ideas.js gameG
  const gameG = b => { const tiles = b.tiles.map(t => ({ x: t[0], y: t[1], z: t[2] })), o = b.obst || {}; const rules = (Object.keys(o.ice || {}).length || (o.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: o.ice || {}, locks: (o.keys || []).length ? new Set(o.locks) : null, keys: o.keys || [] } : null;
    return { tiles, nb: L.neighbors(tiles), faces: b.faces, rules, clock: b.clock }; };
  let valid = 0, broken = 0;
  for (const d of [...QUAL, ...train]) {
    const v = Hard.validSolution(gameG(d), d.solution), r = E.replay(d, d.solution, { strict: true });
    assert.equal(r.ok, v, `design ${d.level}: ${JSON.stringify(r)}`);
    if (v) { valid++; assert.equal(E.replay(d, d.solution).ok, true); }
    // a broken copy: two moves swapped, the clock one move tighter
    const p = d.solution.slice(); [p[3], p[4]] = [p[4], p[3]];
    const x = { ...d, clock: d.clock && { ...d.clock, n: d.clock.n - 1 } };
    if (Hard.validSolution(gameG(x), p) !== E.replay(x, p, { strict: true }).ok) broken++;
  }
  assert.equal(broken, 0);
  assert.ok(valid >= 18);
});

test('replay reads a peek pair only when the single would be a 4th tile', () => {
  const d = board([[0, 0, 0], [4, 0, 0], [8, 0, 0], [21, 10, 1], [23, 10, 1], [20, 10, 0], [22, 10, 0], [24, 10, 0]], [0, 1, 2, 3, 3, 0, 1, 2], { down: [3] });
  assert.deepEqual(E.replay({ ...d, solution: null }, [0, 1, 2, 4, 3, 5, 6, 7]), { ok: true, pairs: 1 });
  assert.equal(E.replay(d, [0, 1, 2, 4, 3, 5, 6, 7], { strict: true }).why, 'trayFull');
  assert.deepEqual(E.replay(d, [3, 4, 0, 5, 1, 6, 2, 7]), { ok: true, pairs: 0 });      // singles when there is room
  assert.deepEqual(E.replay(d, [0, 1, 2, 4, 5, 3, 6, 7]), { ok: false, why: 'trayFull', at: 3, pairs: 0 });
  assert.equal(E.replay(d, [0, 1, 2, 4, 3, 5, 6]).why, 'length');
  assert.equal(E.replay(d, [5, 1, 2, 4, 3, 0, 6, 7]).why, 'notTakeable');
  const boundary = { ...d, clock: { i: 3, n: 4 } }, path = [0, 1, 2, 4, 3, 5, 6, 7];
  assert.equal(E.replay(boundary, path).ok, true);
  assert.equal(E.replay(boundary, path, { clockAfterAction: false }).why, 'clockLate');
  assert.equal(E.replay({ ...d, clock: { i: 3, n: 5 } }, [0, 1, 2, 4, 3, 5, 6, 7]).ok, true);
  assert.deepEqual(E.flatten([0, { pair: [4, 3] }, 5]), [0, 4, 3, 5]);
});

test('a last-action peeked clock is a winning choice, not a decision trap', () => {
  const d = board([[0, 0, 0], [4, 0, 0], [8, 0, 0], [21, 10, 1], [23, 10, 1], [20, 10, 0], [22, 10, 0], [24, 10, 0]],
    [0, 1, 2, 3, 3, 0, 1, 2], { down: [3], clock: { i: 3, n: 4 } });
  const g = E.game(d), s = play(g, [0, 1, 2]);
  const pair = E.classify(g, s).find(c => typeof c.move === 'object');
  assert.deepEqual(pair.move, { pair: [4, 3] });
  assert.equal(pair.result, 'win');
  const old = E.game(d, { clockAfterAction: false });
  assert.equal(res(old, play(old, [0, 1, 2])), 'lose');
  assert.ok(E.won(g, play(g, [0, 1, 2, pair.move, 5, 6, 7])));
  assert.equal(E.step(g, { ...s, moves: 4 }, pair.move), null); // the action must still start before expiry
});

test('clockShortest: strict = exact.js, game rules never longer, its flat path replays', () => {
  for (const d of QUAL) {
    const gs = E.game(d, { strict: true }), x = exactRoute(gs, d.clock.i), cs = E.clockShortest(gs), cg = E.clockShortest(E.game(d));
    assert.equal(cs.k, x.k);
    assert.ok(cg.k <= cs.k && cg.k <= d.clock.n);
    assert.ok(E.won(E.game(d), play(E.game(d), cg.path)));
    assert.ok(E.replay(d, E.flatten(cg.path)).ok);
    assert.ok(E.replay(d, E.flatten(cs.path), { strict: true }).ok);
  }
});

test('an explicit strict clock work budget includes finishing proofs, even without reserve cuts',()=>{
 const d=board([[0,0,0],[4,0,0],[8,0,0],[12,0,0]],[0,0,1,1],{clock:{i:0,n:99}}),g=E.game(d,{strict:true});
 assert.equal(g.reserveCuts.length,0);
 assert.equal(E.clockShortest(g,{nodes:1000,ms:Infinity,totalNodes:1}),null);
 const r=E.clockShortest(g,{nodes:1000,ms:Infinity,totalNodes:100});
 assert.ok(r&&!r.unsure);assert.equal(r.k,1);assert.ok(r.workNodes>1&&r.workNodes<=100);
 assert.equal(E.replay(d,E.flatten(r.path),{strict:true}).ok,true);
});

test('traps along the clock prefix: the stored solution never loses, losing moves carry kinds and depth', () => {
  let points = 0;
  for (const d of QUAL) {
    const t = E.traps(E.game(d));
    points += t.length;
    for (const p of t) {
      assert.equal(p.takeLoses, false);
      assert.ok(p.lose >= 1 && p.losing.every(x => Number.isInteger(x.depth) && x.depth >= 0 && x.depth <= E.DEF.cap));
      assert.ok(p.tempting.every(x => ['clock', 'match', 'pair', 'twin', 'peekpair'].includes(x.kind)));
    }
  }
  assert.ok(points > 50);
});
