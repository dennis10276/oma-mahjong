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
    name: 'levels: tiles never sit exactly on one tile; every upper tile bridges 2 or 4 below',
    async run(t) {
      let up = 0, four = 0;
      const bad = [];
      const check = (label, tiles) => {
        for (const a of tiles) if (a.z > 0) {
          up++;
          const below = tiles.filter(b => b.z === a.z - 1 && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2);
          if (below.length < 2 || below.some(b => b.x === a.x && b.y === a.y)) bad.push({ label, tile: a, below: below.length });
          if (below.length === 4) four++;
        }
      };
      for (let L = 1; L <= 80; L++) for (const a of [1.2, 1.9]) check(`level ${L} @${a}`, Layouts.forLevel(L, a).tiles);
      for (const ymd of [20261007, 20261008, 20261225]) check(`daily ${ymd}`, Layouts.forDate(ymd, 1.5).tiles);
      t.eq(bad.slice(0, 3), [], 'no tile on a single tile');
      t.ok(four / up > 0.35, 'many tiles rest on 4 (the pyramid look)', { share: +(four / up).toFixed(2) });
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
      // grandma's half steps lie neatly between the whole ones
      for (const L of [12, 28, 40]) {
        const base = Layouts.forLevel(L, 1.5);
        const st = [0, 0.5, 1, 1.5, 2, 2.5, 3].map(ez => { const sp = Layouts.ease(base, ez); return { ez, kinds: sp.kinds, down: sp.diff.down, target: sp.diff.target, ok: solvable(sp).ok }; });
        t.ok(st.every(x => x.ok), `level ${L}: every half step solvable`, st);
        t.ok(st.every((x, i) => !i || (x.kinds <= st[i - 1].kinds && x.down <= st[i - 1].down + 1e-9 && x.target >= st[i - 1].target - 1e-9)), `level ${L}: each step a bit easier`, st);
      }
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
      // on grandma's easier steps: less ice and fewer locks
      let n1 = 0, n2 = 0;
      for (let L = 45; L <= 60; L++) {
        const spec = Layouts.forLevel(L, 1.5), d = Layouts.makeDeal(spec);
        const cnt = ez => { const o = Layouts.obstacles(spec.tiles, d.faces, { level: L, seed: spec.seed, avoid: new Set(d.down), ez }); return o ? Object.keys(o.ice).length + o.locks.length : 0; };
        n1 += cnt(1); n2 += cnt(2.5);
      }
      t.ok(n2 < n1 * 0.75, 'easier steps: fewer obstacles', { normal: n1, easier: n2 });
    },
  },
  {
    name: 'levels: neighbouring levels are about equally hard (deal lands near its target)',
    async run(t) {
      for (const ez of [0, 1]) {
        const offs = [];
        for (let lv = 8; lv <= 50; lv += 2) {
          const spec = Layouts.ease(Layouts.forLevel(lv, 2.0), ez), d = Layouts.makeDeal(spec);
          const w = Layouts.botWinRate(spec.tiles, Layouts.neighbors(spec.tiles), d.faces, 200, 4242);
          offs.push({ lv, w: +w.toFixed(2), target: spec.diff.target, off: Math.abs(w - spec.diff.target) });
        }
        const mean = offs.reduce((a, b) => a + b.off, 0) / offs.length, worst = offs.reduce((a, b) => b.off > a.off ? b : a);
        t.ok(mean < (ez ? 0.05 : 0.08), `ez${ez}: on average close to the target`, { mean: +mean.toFixed(3) });
        t.ok(worst.off < (ez ? 0.15 : 0.22), `ez${ez}: no level far off`, worst);
      }
    },
  },
];
