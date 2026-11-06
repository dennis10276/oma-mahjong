/* The peek pair (board.js peekPair): with 3 tiles waiting, a face-down tile and its free twin still go together
   without a tray slot. The hint's solver and the solution check know it (Dennis, 2026-11-06). */
'use strict';
const path = require('path');
const L = global.Layouts = require(path.join(__dirname, '..', 'www', 'layouts.js'));
const H = require(path.join(__dirname, '..', 'www', 'hard.js'));
// three far tiles (faces 0, 1, 2) go into the tray first; then only the pair 3 (face-down) + 4 is free on the
// pile, and under it lie the twins of the three waiting tiles
const tiles = [[10, 0, 0], [14, 0, 0], [18, 0, 0], [1, 0, 1], [3, 0, 1], [0, 0, 0], [2, 0, 0], [4, 0, 0]].map(([x, y, z]) => ({ x, y, z }));
const faces = [0, 1, 2, 3, 3, 0, 1, 2], nb = L.neighbors(tiles), down = Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 0]);
module.exports = [
  {
    name: 'peek pair: the hint finds the way out with 3 tiles waiting, face-down tile first',
    async run(t) {
      const alive = Uint8Array.from([0, 0, 0, 1, 1, 1, 1, 1]);
      t.eq(L.solve(tiles, nb, faces, alive, [0, 1, 2], 10000), null, 'without the rule: no way');
      const p = L.solve(tiles, nb, faces, alive, [0, 1, 2], 10000, null, down);
      t.ok(p && p.length === 5, 'with the rule: a way through', p);
      t.eq(p && p.slice(0, 2).join(','), '3,4', 'the face-down tile comes first, then its twin');
      t.eq(L.solve(tiles, nb, faces, alive, [0, 1, 2], 10000, null, new Uint8Array(8)), null, 'no face-down tile: no shortcut');
    },
  },
  {
    name: 'peek pair: the solution check accepts it, and only with a face-down tile',
    async run(t) {
      const sol = [0, 1, 2, 3, 4, 5, 7, 6];
      t.ok(H.validSolution({ tiles, nb, faces, down, rules: null, clock: null }, sol), 'a pair with 3 waiting is fine');
      t.ok(!H.validSolution({ tiles, nb, faces, rules: null, clock: null }, sol), 'without face-down information: the 4th tile loses');
      t.ok(!H.validSolution({ tiles, nb, faces, down: new Uint8Array(8), rules: null, clock: null }, sol), 'both face-up: the 4th tile loses');
      t.ok(!H.validSolution({ tiles, nb, faces, down, rules: null, clock: null }, [0, 1, 2, 3, 5, 4, 7, 6]), 'the twin must come right after');
      const clock = { i: 4, n: 5 };
      t.ok(H.validSolution({ tiles, nb, faces, down, rules: null, clock }, sol), 'the clock in the pair, in time (move index 4 < 5)');
      t.ok(!H.validSolution({ tiles, nb, faces, down, rules: null, clock: { i: 4, n: 4 } }, sol), 'one move too late');
    },
  },
];
