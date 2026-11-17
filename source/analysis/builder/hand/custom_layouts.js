#!/usr/bin/env node
'use strict';
/* custom_layouts.js: hand-made layouts, each shaped for one trap (Dennis 2026-11-17: "Use more variety of layouts ... You may change
   the layouts to the needs of the trap"). Writes layouts-custom.json (ids 3001+, read by hand.js layouts()) and checks every relation
   the trap depends on with the game's own rules (www/layouts.js neighbors / iceNeighbors).
     node source/analysis/builder/hand/custom_layouts.js            -> writes the file, prints the named tiles and the checks
   Coordinates: x, y in half tiles, z layer; 6 tiles wide (x 0..10), at most 3 layers. */
const fs = require('fs'), path = require('path');
global.Layouts = global.Layouts || require('../../../www/layouts.js');
const Lw = global.Layouts;
const X6 = [0, 2, 4, 6, 8, 10];
// a block of two base rows with a roof row and two top tiles (the "filler" around a trap; its own little dig)
const block = (y, top) => [...X6.map(x => [x, y, 0]), ...X6.map(x => [x, y + 2, 0]), ...[1, 3, 5, 7, 9].map(x => [x, y + 1, 1]), ...top.map(x => [x, y + 1, 2])];

const defs = {
  // 3001 "Alcove" - The circle. Row y6 on the floor: N F M C W E. F (frozen 2) has only two ice neighbours, N and M; M lies between F and
  // the clock - so the short (left) way is a loop: F needs M gone, M needs F (or the clock) gone. The right way: roofs P (over the clock
  // and W) and R (over W and E) under S, then E, W. Every upper tile sits half off the tiles below (never straight on one). The left middle is left empty so nothing else melts F.
  3001: { name: 'Alcove', named: { N: [0, 6, 0], F: [2, 6, 0], M: [4, 6, 0], C: [6, 6, 0], W: [8, 6, 0], E: [10, 6, 0], P: [7, 6, 1], R: [9, 6, 1], S: [8, 6, 2] },
    rest: [...block(0, [2, 6, 10]), [6, 4, 0], [8, 4, 0], [10, 4, 0], [6, 8, 0], [8, 8, 0], [10, 8, 0], ...block(10, [2, 6])] },
  // 3002 "Terrace" - Break the circle. The same loop (N F M C), but F has a third ice neighbour: V, straight above it in the row y4
  // (A V B ...), which is a side neighbour of nothing in the loop. N and V melt F. The right way is a heap (P, R under S, E, W).
  3002: { name: 'Terrace', named: { A: [0, 4, 0], V: [2, 4, 0], B: [4, 4, 0], N: [0, 6, 0], F: [2, 6, 0], M: [4, 6, 0], C: [6, 6, 0], W: [8, 6, 0], E: [10, 6, 0], P: [7, 6, 1], R: [9, 6, 1], S: [8, 6, 2] },
    rest: [...block(0, [4, 8]), [6, 4, 0], [8, 4, 0], [10, 4, 0], [6, 8, 0], [8, 8, 0], [10, 8, 0], ...block(10, [2, 6])] },
  // 3003 "Icicle" - The clock thaws the icicle. The clock C (row y6) has a column hanging under it: D1, D2, D3, each frozen 1 and each
  // melted only by the tile above it - so when the clock goes, the icicle thaws top-down, one tile per move. Two ways to the clock: the
  // left (X1 over L0/L, short) and the right (X9, X7 over R3/R2/R, longer); Q (over the clock and R) is the clock's roof. Nothing else touches the icicle.
  3003: { name: 'Icicle', named: { L0: [0, 6, 0], L: [2, 6, 0], C: [4, 6, 0], R: [6, 6, 0], R2: [8, 6, 0], R3: [10, 6, 0], X1: [1, 6, 1], Q: [5, 6, 1], X7: [7, 6, 1], X9: [9, 6, 1], D1: [4, 8, 0], D2: [4, 10, 0], D3: [4, 12, 0] },
    rest: [...block(0, [2, 6, 10]), ...X6.map(x => [x, 4, 0]), [0, 8, 0], [0, 10, 0], [0, 12, 0], [0, 9, 1], [0, 11, 1], [8, 8, 0], [10, 8, 0], [8, 10, 0], [10, 10, 0], [8, 12, 0], [10, 12, 0], [9, 9, 1], [9, 11, 1]] },
};
const out = {}, report = [];
for (const [id, d] of Object.entries(defs)) {
  const tiles = [...d.rest], idx = {};
  for (const [k, t] of Object.entries(d.named)) { idx[k] = tiles.length; tiles.push(t); }
  const key = t => t.join(','), seen = new Set();
  for (const t of tiles) { if (seen.has(key(t))) throw Error(id + ': duplicate tile ' + key(t)); seen.add(key(t)); }
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) { const a = tiles[i], b = tiles[j];   // no two tiles in the same place
    if (a[2] === b[2] && Math.abs(a[0] - b[0]) < 2 && Math.abs(a[1] - b[1]) < 2) throw Error(id + ': overlap ' + key(a) + ' / ' + key(b)); }
  if (tiles.length % 2) throw Error(id + ': odd tile count ' + tiles.length);
  const T = tiles.map(([x, y, z]) => ({ x, y, z })), nb = Lw.neighbors(T), ice = Lw.iceNeighbors(T);
  const nm = i => Object.keys(idx).find(k => idx[k] === i) || String(i);
  const rel = k => { const i = idx[k]; return `${k}#${i}: on ${nb.above[i].map(nm).join(' ') || '-'} | L ${nb.left[i].map(nm).join(' ') || '-'} R ${nb.right[i].map(nm).join(' ') || '-'} | ice ${ice[i].map(nm).join(' ')}`; };
  report.push(`${id} ${d.name}: ${tiles.length} tiles`, ...Object.keys(d.named).map(k => '  ' + rel(k)));
  out[id] = { name: d.name, shape: d.name.toLowerCase(), tiles, named: idx };
}
fs.writeFileSync(path.join(__dirname, 'layouts-custom.json'), JSON.stringify(out));
console.log(report.join('\n'));
