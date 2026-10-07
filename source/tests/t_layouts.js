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
        const r0 = solvable(base), r1 = solvable(Layouts.ease(base, 1)), r2 = solvable(Layouts.ease(base, 2));
        t.ok(r1.ok && r2.ok, `level ${L} easy deals solvable`, { r1, r2 });
        t.eq([r1.n, r2.n], [r0.n, r0.n], `level ${L} same pile size`);
        t.ok(r1.kinds <= r0.kinds && r2.kinds < r0.kinds, `level ${L} fewer different pictures`, { normal: r0.kinds, ez1: r1.kinds, ez2: r2.kinds });
        t.ok(r1.down <= r0.down && r2.down === 0, `level ${L} fewer face-down tiles`, { normal: r0.down, ez1: r1.down, ez2: r2.down });
      }
      const b = Layouts.forLevel(10, 1.5);
      t.ok(Layouts.ease(b, 0) === b, 'ease 0 changes nothing');
    },
  },
];
