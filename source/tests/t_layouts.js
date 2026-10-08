/* The piles and the deals: every level can be cleared, and the easier retries really are easier. */
'use strict';
const path = require('path');
const Layouts = require(path.join(__dirname, '..', 'www', 'layouts.js'));
const solvable = spec => {
  const d = Layouts.makeDeal(spec);
  const nb = Layouts.neighbors(spec.tiles);
  const p = Layouts.solve(spec.tiles, nb, d.faces, new Uint8Array(spec.tiles.length).fill(1), [], 200000);
  return { ok: !!(p && p.length), kinds: new Set(d.faces).size, down: d.down.length, n: spec.tiles.length };
};

module.exports = [
  {
    name: 'levels: every level from 1 to 40 can be cleared',
    async run(t) {
      for (let L = 1; L <= 40; L++) {
        const r = solvable(Layouts.forLevel(L, 1.5));
        t.ok(r.ok, `level ${L} solvable`, r);
        t.ok(r.n % 2 === 0 && r.n >= 50, `level ${L} has an even, big pile`, r.n);
      }
      t.eq(Layouts.forLevel(1, 1.5).tiles.length, 56, 'level 1 starts with 56 tiles');
    },
  },
  {
    name: 'levels: phone shapes and big tiles still give clearable piles',
    async run(t) {
      for (const a of [0.9, 1.2, 1.9]) for (const L of [3, 12, 25]) t.ok(solvable(Layouts.forLevel(L, a)).ok, `level ${L} at aspect ${a}`);
      for (const L of [5, 20]) t.ok(solvable(Layouts.forLevel(L, 1.5, 0.7)).ok, `level ${L} with big tiles`);
      for (const ymd of [20261007, 20261008, 20261225]) t.ok(solvable(Layouts.forDate(ymd, 1.5)).ok, `daily ${ymd}`);
    },
  },
  {
    name: 'levels: easier retries keep the pile but have more matching pictures',
    async run(t) {
      for (const L of [8, 12, 20, 30, 45]) {
        const base = Layouts.forLevel(L, 1.5);
        const [r0, r1, r2, r3] = [0, 1, 2, 3].map(ez => solvable(Layouts.ease(base, ez)));
        t.ok(r1.ok && r2.ok && r3.ok, `level ${L} gentle deals solvable`, { r1, r2, r3 });
        t.eq([r1.n, r2.n, r3.n], [r0.n, r0.n, r0.n], `level ${L} same pile size`);
        t.ok(r1.kinds <= r0.kinds && r2.kinds <= r1.kinds && r3.kinds < r0.kinds, `level ${L} fewer different pictures`, { normal: r0.kinds, ez1: r1.kinds, ez2: r2.kinds, ez3: r3.kinds });
        t.ok(r1.down <= r0.down && r2.down <= r0.down && r3.down === 0, `level ${L} fewer face-down tiles`, { normal: r0.down, ez1: r1.down, ez2: r2.down, ez3: r3.down });
      }
      const b = Layouts.forLevel(10, 1.5);
      t.ok(Layouts.ease(b, 0) === b, 'ease 0 changes nothing');
    },
  },
  {
    name: 'levels: ice and locks are placed so every level 35-70 can still be cleared',
    async run(t) {
      let withIce = 0, withLock = 0;
      for (let L = 35; L <= 70; L++) {
        const spec = Layouts.forLevel(L, 1.5), d = Layouts.makeDeal(spec);
        const ob = Layouts.obstacles(spec.tiles, d.faces, { level: L, seed: spec.seed, avoid: new Set(d.down) });
        if (!ob) continue;
        const ice = Object.keys(ob.ice).length; withIce += ice > 0; withLock += ob.keys.length > 0;
        const nb = Layouts.neighbors(spec.tiles), all = new Uint8Array(spec.tiles.length).fill(1);
        const rules = { iceNb: Layouts.iceNeighbors(spec.tiles), ice: ob.ice, locks: ob.locks.length ? new Set(ob.locks) : null, keys: ob.keys };
        t.ok(Layouts.solve(spec.tiles, nb, d.faces, all, [], 120000, rules), `level ${L} solvable with ice/locks`, ob);
        if (ob.keys.length) t.ok(L >= 45 && d.faces[ob.keys[0]] === d.faces[ob.keys[1]], `level ${L}: keys are a pair, only from 45`);
        t.ok(!Object.keys(ob.ice).some(i => d.down.includes(+i)), `level ${L}: no ice on face-down tiles`);
      }
      t.ok(withIce >= 20 && withLock >= 12, 'most levels have them', { withIce, withLock });
    },
  },
];
