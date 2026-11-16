'use strict';
/* The silver key set (Dennis 2026-11-16: "Yes we can make a second key pair with its own locks"): obst.keys2/locks2 next to the
   gold keys/locks. Each set opens only its own locks; a key of one set may itself be locked by the other (a chain). */
const path = require('path');
const DENNIS = { name: 'Dennis', pid: 'test-silver', level: 301, seenSp: { clock: 1, clockMoves: 1, ice: 1, lock: 1, gold: 1, joker: 1, trayPair: 1 } };
module.exports = [
  { name: 'silver keys: rules and level-table packing (node)', async run(t) {
    const L = require(path.join(__dirname, '../www/layouts.js'));
    global.Layouts = L; const H = require(path.join(__dirname, '../www/hard.js'));
    // 0 gold key pair (0,1) locks 2; silver pair (3,4) locks 5; silver key 4 is itself under the gold lock
    const rules = { iceNb: [], ice: {}, locks: new Set([2, 4]), keys: [0, 1], locks2: new Set([5]), keys2: [3, 4] };
    const alive = [1, 1, 1, 1, 1, 1];
    const locked = i => L.takeable(i, alive, { above: alive.map(() => []), left: alive.map(() => []), right: alive.map(() => []) }, rules, alive.map(() => 1)) === false;
    t.eq([0, 1, 2, 3, 4, 5].map(locked), [false, false, true, false, true, true], 'gold lock on 2 and on silver key 4, silver lock on 5');
    alive[0] = alive[1] = 0;
    t.eq([2, 4, 5].map(locked), [false, false, true], 'gold keys gone: gold locks open, the silver lock stays shut');
    alive[3] = alive[4] = 0;
    t.eq(locked(5), false, 'silver keys gone: the silver lock opens');
    // packing: an old row keeps its 11 fields; a row with a silver set round-trips
    const d = { tiles: [[0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0]], faces: [1, 1, 2, 2], down: [], gold: [], obst: { ice: {}, locks: [2], keys: [0, 1] }, clock: null, info: { rate: 0, strong: 0 }, solution: [0, 1, 2, 3] };
    t.eq(H.pack(d).length, 11, 'a board without a silver set packs as before');
    const d2 = { ...d, obst: { ...d.obst, locks2: [3], keys2: [0, 1] } }, r = H.pack(d2), u = H.unpack(1, r);
    t.eq(r.length, 13, 'a silver set adds two fields');
    t.eq([u.obst.locks2, u.obst.keys2, u.obst.locks, u.obst.keys], [[3], [0, 1], [2], [0, 1]], 'silver set read back');
    t.eq(H.unpack(1, H.pack(d)).obst.keys2, undefined, 'old rows have no silver set');
  } },
  { name: 'silver keys: in the game a silver lock refuses a tap and opens when the silver pair is taken', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: DENNIS });
    await startLevel(p, 300);
    const set = await p.evaluate(() => {
      const ok = i => G.alive[i] && !G.down[i] && __mj.canTake(i);
      const free = G.tiles.map((x, i) => i).filter(i => ok(i) && G.tiles[i].face < 100);
      const [a, b, lock] = free.filter(i => !G.ob.keys.includes(i) && !G.ob.locks.has(i));
      // a and b get the same picture (the tile that had it elsewhere takes b's): the silver key pair
      const f = G.tiles[a].face, w = G.tiles.findIndex((x, k) => k !== a && k !== b && x.face === f);
      G.tiles[w].face = G.tiles[b].face; G.tiles[b].face = f;
      const ob = obState(); setObstacles({ ...ob, need: ob.need, left: ob.left, locks2: [lock], keys2: [a, b] });
      G.tiles.forEach((x, i) => decorate(i));
      return { a, b, lock, kind: obMarker(lock), key: obMarker(a), open: __mj.canTake(lock) };
    });
    t.eq([set.kind, set.key, set.open], ['lock2', 'key2', false], 'silver lock and key are marked, the lock refuses');
    await p.evaluate(l => __mj.onTap(l), set.lock); await sleep(300);
    t.ok(await p.evaluate(l => G.alive[l] === 1, set.lock), 'a tap on the silver lock leaves it on the board');
    await p.evaluate(([a, b]) => { __mj.onTap(a); __mj.onTap(b); }, [set.a, set.b]); await sleep(900);
    t.eq(await p.evaluate(l => [G.ob.unlocked2, __mj.canTake(l), G.ob.unlocked], set.lock), [true, true, false], 'silver pair taken: silver lock open, gold locks still shut');
    const saved = await p.evaluate(() => { saveCur(); return JSON.parse(localStorage.getItem(CUR)).ob; });
    t.eq([saved.unlocked2, saved.keys2.length], [true, 2], 'the saved game keeps the silver set');
  } },
];
