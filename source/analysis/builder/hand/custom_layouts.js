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
// ---- buried chains (Dennis 2026-11-17 after lab-three "Soo easy": "Make all the new ideas like that") ----
// a filler pile: two floor rows, a roof row, top tiles at `top`; its roof tile at x `k` (row y+1) is a key spot, boxed in by its row
const pile = (y, top) => [...X6.map(x => [x, y, 0]), ...X6.map(x => [x, y + 2, 0]), ...[1, 3, 7, 9].map(x => [x, y + 1, 1]), ...top.map(x => [x, y + 1, 2])];
Object.assign(defs, {
  // 3101 "Keep" - The circle, buried. Key piles top (K1) and bottom (K2), each a dig of about five; the clock's roof P is gold-locked.
  // The loop row N F M C W E lies under covers: L1/L3 over N F M (left, looks cheap), P/R under S over C W E (right). F is frozen 4:
  // its melters are N, M and its two covers L1, L3 - without M only three. M is boxed in by F and the clock: the left is a loop,
  // and you only see F's ice after lifting L1 and L3.
  3101: { name: 'Keep', named: { K1: [5, 1, 1], K2: [5, 11, 1], N: [0, 6, 0], F: [2, 6, 0], M: [4, 6, 0], C: [6, 6, 0], W: [8, 6, 0], E: [10, 6, 0],
      L1: [1, 6, 1], L3: [3, 6, 1], P: [7, 6, 1], R: [9, 6, 1], S: [8, 6, 2] },
    rest: [...pile(0, [2, 4, 8]), [0, 4, 0], [4, 4, 0], [6, 4, 0], [8, 4, 0], [10, 4, 0], [5, 4, 1], [7, 4, 1], [9, 4, 1], [8, 4, 2],
      [4, 8, 0], [6, 8, 0], [8, 8, 0], [10, 8, 0], [5, 8, 1], [7, 8, 1], [9, 8, 1], [8, 8, 2], ...pile(10, [2, 6, 8])] },
  // 3102 "Lattice" - Break the circle, buried. Left: two floor rows A V B / N F M under four covers (U1 U3 / L1 L3) and one top T.
  // F is frozen 4: N, M, L1, L3 and V (straight above it) melt it; without V only three - a loop, since M is boxed in by F and the
  // clock. V is gold-locked; the gold keys K1/K2 lie in the right pile, under its top. Fetching the keys pulls you right - but the right
  // (E, W) fills the tray; the keys are for V, the door into the loop.
  3102: { name: 'Lattice', named: { A: [0, 4, 0], V: [2, 4, 0], B: [4, 4, 0], N: [0, 6, 0], F: [2, 6, 0], M: [4, 6, 0], C: [6, 6, 0], W: [8, 6, 0], E: [10, 6, 0],
      U1: [1, 4, 1], U3: [3, 4, 1], L1: [1, 6, 1], L3: [3, 6, 1], T: [2, 5, 2], P5: [7, 5, 1], K1: [9, 5, 1], P7: [7, 7, 1], K2: [9, 7, 1], S: [8, 6, 2] },
    rest: [...block(0, [2, 8]), [6, 4, 0], [8, 4, 0], [10, 4, 0], [0, 8, 0], [4, 8, 0], [6, 8, 0], [8, 8, 0], [10, 8, 0], ...pile(10, [2, 8])] },
  // 3103 "Drip" - The icicle, buried. The clock C (row y6) under its gold-locked roof Q; under C hangs the icicle D1 D2 D3 (frozen 1 each,
  // each melted only by the tile above it). The left (L0, L under X1) looks cheap; the right (R, R2, R3 under X7, X9 and two tops) is
  // heavy - and only the right brings the icicle's pictures. Keys: K1 in the top pile (under a top), K2 in the bottom-right stack.
  3103: { name: 'Drip', named: { L0: [0, 6, 0], L: [2, 6, 0], C: [4, 6, 0], R: [6, 6, 0], R2: [8, 6, 0], R3: [10, 6, 0], X1: [1, 6, 1], Q: [5, 6, 1], X7: [7, 6, 1], X9: [9, 6, 1],
      T6: [6, 6, 2], T8: [8, 6, 2], D1: [4, 8, 0], D2: [4, 10, 0], D3: [4, 12, 0], K1: [5, 1, 1], K2: [9, 11, 1] },
    rest: [...X6.map(x => [x, 0, 0]), ...X6.map(x => [x, 2, 0]), [1, 1, 1], [3, 1, 1], [7, 1, 1], [9, 1, 1], [2, 1, 2], [6, 1, 2], [8, 1, 2],
      ...X6.map(x => [x, 4, 0]), ...[1, 3, 5, 7, 9].map(x => [x, 3, 1]), [2, 3, 2],
      [0, 8, 0], [0, 10, 0], [0, 12, 0], [0, 9, 1], [0, 11, 1], [8, 8, 0], [10, 8, 0], [8, 10, 0], [10, 10, 0], [8, 12, 0], [10, 12, 0], [9, 9, 1]] },
});
// a three-layer half-offset pyramid over the floor x0..x1, y0..y1 (every upper tile on four below: nothing hangs, nothing straight)
const pyr = (x0, x1, y0, y1) => { const t = [];
  for (let x = x0; x <= x1; x += 2) for (let y = y0; y <= y1; y += 2) t.push([x, y, 0]);
  for (let x = x0 + 1; x <= x1 - 1; x += 2) for (let y = y0 + 1; y <= y1 - 1; y += 2) t.push([x, y, 1]);
  for (let x = x0 + 2; x <= x1 - 2; x += 2) for (let y = y0 + 2; y <= y1 - 2; y += 2) t.push([x, y, 2]);
  return t; };
// the same, two layers only (a band whose middle row is hidden under one roof layer)
const pyr2 = (x0, x1, y0, y1) => pyr(x0, x1, y0, y1).filter(t => t[2] < 2);
const minus = (tiles, named) => tiles.filter(t => !Object.values(named).some(n => n.join(',') === t.join(',')));
const N3104 = { C: [4, 4, 0], L: [5, 5, 1], T4: [4, 4, 2], T6: [6, 4, 2], K1: [1, 9, 1], K2: [9, 9, 1] };
const N3105 = { C: [6, 6, 0], L: [5, 5, 1], F3: [3, 5, 1], F1: [1, 5, 1] };
Object.assign(defs, {
  // 3104 "Well" - Keys before the lid, buried. Two pyramids (the top one keeps only the two tops T4, T6 over the lid). The clock C deep in the top one under four covers; one of them, the lid L,
  // is gold-locked and lies hidden under two tops (T4, T6) - you only see the lock when you are already digging. The keys K1, K2 are in
  // the bottom pyramid, each under two tops and boxed in by its row.
  3104: { name: 'Well', named: N3104, rest: minus([...X6.map(x => [x, 0, 0]), ...pyr2(0, 10, 2, 6), ...pyr(0, 10, 8, 12)], N3104) },   // top: only the two tops over the lid
  // 3105 "Ridge" - Melt before the lid, buried. A pyramid band across the middle with flat rows above and below. The clock C under four
  // covers; the lid L (one of them) is frozen: the dig to the clock melts it only so far, the last melt is F3, beside L on the far side,
  // boxed in by L and F1 (under a top). Dig first and the dig's tiles wait while you fetch F1, F3.
  3105: { name: 'Ridge', named: N3105, rest: minus([...block(0, [4, 8]).filter(t => !(t[2] === 0 && t[1] === 2)), ...X6.map(x => [x, 2, 0]), ...pyr(0, 10, 4, 8), ...X6.map(x => [x, 10, 0]), ...X6.map(x => [x, 12, 0]), ...[1, 3, 5, 7, 9].map(x => [x, 11, 1]), [2, 11, 2], [6, 11, 2]], N3105) },
});
// a pyramid band whose middle row holds the clock at x 4: reachable from the left (L2, L0) or the right (R6, R8, R10), all buried
const N3108 = { C: [4, 6, 0], L0: [0, 6, 0], L2: [2, 6, 0], R6: [6, 6, 0], S5: [5, 5, 1], K1: [5, 1, 1], K2: [5, 11, 1] };
const N3109 = { C: [4, 4, 0], L0: [0, 4, 0], L2: [2, 4, 0], R6: [6, 4, 0], FD: [0, 10, 0], U: [1, 9, 1] };
const N3110 = { C: [4, 8, 0], L0: [0, 8, 0], L2: [2, 8, 0], R6: [6, 8, 0], R8: [8, 8, 0], R10: [10, 8, 0] };
const N3111 = { C: [4, 6, 0], L0: [0, 6, 0], L2: [2, 6, 0], R6: [6, 6, 0], R8: [8, 6, 0], I: [3, 5, 1] };
Object.assign(defs, {
  // 3108 "Gate" - The clock closes the pair, buried. Band rows y4-8 between two key piles (silver keys K1 top, K2 bottom; S5, one of the
  // clock's covers, is silver-locked). The clock's twin lies at the far left end of its row (L0), under the band: the left way takes
  // it and it waits all the way down - which looks bad - but the clock closes the pair; the right way leaves no room for the clock.
  3108: { name: 'Gate', named: N3108, rest: minus([...pile(0, [2, 6, 8]), ...pyr2(0, 10, 4, 8), ...pile(10, [2, 4, 8])], N3108) },
  // 3109 "Shelf" - The escape is too slow, buried. Band rows y0-4 (the clock in the bottom row y4), a flat field below. The left way
  // fills the tray; a face-down tile FD (the twin of the left's last tile) lies in the field under U and (1,11,1) - the escape, three moves away.
  3109: { name: 'Shelf', named: N3109, rest: minus([...pyr(0, 10, 0, 4), ...X6.map(x => [x, 6, 0]), ...[1, 3, 5, 7, 9].map(x => [x, 7, 1]), [6, 7, 2], [8, 7, 2], ...X6.map(x => [x, 8, 0]),
      ...X6.map(x => [x, 10, 0]), ...X6.map(x => [x, 12, 0]), ...[1, 3, 5, 7, 9].map(x => [x, 11, 1]), [6, 11, 2]], N3109) },   // FD (0,10) under U (1,9,1) and (1,11,1): the escape costs three
  // 3110 "Pier" - Don't rush the clock, buried. A small pyramid on top, a band rows y6-10 at the bottom with the clock in its middle row.
  // The left way is shorter and reaches the clock in time - with three tiles waiting whose twins are buried: stuck right after the clock.
  3110: { name: 'Pier', named: N3110, rest: minus([...pyr(0, 10, 0, 4), ...pyr2(0, 10, 6, 10), ...X6.map(x => [x, 12, 0])], N3110) },
  // 3111 "Arch" - The twin is beside the clock, buried. Band rows y4-8 under flat rows. The left way's cover I has the picture of R6,
  // the clock's right neighbour - which frees only after the clock (and its own covers): I waits the whole way. The right takes R6 itself.
  3111: { name: 'Arch', named: N3111, rest: minus([...X6.map(x => [x, 0, 0]), ...X6.map(x => [x, 2, 0]), ...[1, 3, 5, 7, 9].map(x => [x, 1, 1]), ...pyr2(0, 10, 4, 8), ...X6.map(x => [x, 10, 0]), ...X6.map(x => [x, 12, 0]), ...[1, 3, 5, 7, 9].map(x => [x, 11, 1]), [4, 11, 2], [8, 11, 2]], N3111) },
});
const notch = t => !(t[2] === 1 && t[0] === 7 && (t[1] === 5 || t[1] === 7)) && !(t[2] === 2 && t[0] >= 6 && t[1] >= 4 && t[1] <= 8);
const N3106 = { C: [4, 6, 0], R: [6, 6, 0], T: [10, 0, 0], LK: [5, 5, 1], K1: [1, 3, 1], K2: [9, 9, 1] };
const N3107 = { C: [2, 4, 0], c1: [9, 9, 1], c2: [5, 11, 1] };
const N3112 = { N: [0, 6, 0], F: [2, 6, 0], M: [4, 6, 0], C: [6, 6, 0], W: [8, 6, 0], E: [10, 6, 0], L1: [1, 6, 1], L3: [3, 6, 1], P: [7, 6, 1], R: [9, 6, 1], S: [8, 6, 2], T2: [2, 6, 2], K1: [9, 1, 1], K2: [1, 11, 1] };
Object.assign(defs, {
  // 3106 "Hill" - The clock is face-down, buried. A big pyramid with a notch on the right (no covers at x 7 in rows 5/7): the clock C deep
  // on the floor, face-down; its right neighbour R loses its last covers with the clock's and frees the moment the clock goes. One
  // cover of the clock (LK) is gold-locked; the keys are K1 (under a top) and K2 (in the notch). The clock's twin T is the far corner.
  3106: { name: 'Hill', named: N3106, rest: minus([...X6.map(x => [x, 0, 0]), ...pyr(0, 10, 2, 10).filter(notch), ...X6.map(x => [x, 12, 0])], N3106) },
  // 3107 "Steps" - Trust the full tray, buried. A pyramid on the left (the clock deep in it), lower rows stepping down to the right. The
  // clock has no spare move. Twice the dig must go up to three waiting tiles; the next dig tile always matches. Two free tiles on the
  // steps (c1, c2) are twins of waiting tiles: clearing the tray with them costs the move the clock does not have.
  3107: { name: 'Steps', named: N3107, rest: minus([...pyr(0, 6, 0, 8), [8, 0, 0], [10, 0, 0], [8, 2, 0], [10, 2, 0], [8, 4, 0], [10, 4, 0], [8, 6, 0], [10, 6, 0], [9, 5, 1], [8, 8, 0], [10, 8, 0], [8, 10, 0], [10, 10, 0],
      ...X6.map(x => [x, 10, 0]).filter(t => t[0] < 8), ...X6.map(x => [x, 12, 0]), [1, 11, 1], [3, 11, 1], [7, 11, 1], [9, 11, 1], [2, 11, 2]], N3107) },
  // 3112 "Span" - The bridge melts from both ends, buried. Floor row N F M C W E under covers (L1, L3 under T2 on the left; P, R under S
  // on the right). The clock C is frozen 3 and its only melters are M, W and its cover P (nothing above or below it in its own layer):
  // both sides must come down. Their tiles are twins across the clock - dig one side first and the tray fills. Silver keys K1, K2 at the row ends of the
  // piles open S (silver-locked), the right side's top.
  3112: { name: 'Span', named: N3112, rest: minus([...pile(0, [2, 6, 8]), [0, 4, 0], [2, 4, 0], [8, 4, 0], [10, 4, 0], [1, 4, 1], [9, 4, 1], [0, 8, 0], [2, 8, 0], [8, 8, 0], [10, 8, 0], [1, 8, 1], [9, 8, 1], ...pile(10, [2, 4, 8]), [5, 1, 1], [5, 11, 1]], N3112) },   // the piles' middle roof tiles are plain here
});
// 3113 "Dale" - One move late, in a pair (Dennis 2026-11-20: the clock as half of a face-down pair may be one move past its number,
// "Allow it as a trick"). Hill mirrored (the notch on the left): the clock C face-up deep on the floor; when it goes, its left
// neighbour R loses its last cover and frees. The clock's twin T is face-down in the far corner (top left).
const mirror = t => [10 - t[0], t[1], t[2]];
defs[3113] = { name: 'Dale', named: { C: [6, 6, 0], R: [4, 6, 0], T: [0, 0, 0], LK: [5, 5, 1], K1: [9, 3, 1], K2: [1, 9, 1] },
  rest: defs[3106].rest.map(mirror).filter(t => !['6,6,0', '4,6,0', '0,0,0', '5,5,1', '9,3,1', '1,9,1'].includes(t.join(','))) };
// ---- round 5 (Dennis 2026-11-20 after lab-buried "start over for most": keys you must think about, several traps on the one
// forced path, the clock with no spare move, every board its own kind of chain) ----
// 3201 "Vault" - Silver opens the gold. The clock C deep in a centre pyramid (four tops, four covers); one cover, GL, is gold-locked.
// Gold key G1 lies on the top row under (7,1,1); gold key G2 sits in the bottom
// roof row boxed in by SL1 and SL2, both silver-locked. The silver keys S1, S2 lie at the board's edges under one cover each.
const N3201 = { C: [4, 4, 0], GL: [3, 5, 1], G1: [8, 0, 0], G2: [5, 11, 1], SL1: [3, 11, 1], SL2: [7, 11, 1], S1: [0, 6, 0], S2: [10, 2, 0] };
defs[3201] = { name: 'Vault', named: N3201, rest: minus([...pyr(2, 8, 2, 8), [2, 0, 0], [4, 0, 0], [6, 0, 0], [3, 1, 1], [7, 1, 1],
  [0, 2, 0], [0, 6, 0], [0, 8, 0], [10, 2, 0], [10, 4, 0], [10, 6, 0], [10, 8, 0], [1, 7, 1], [9, 3, 1], [9, 7, 1],
  ...X6.map(x => [x, 10, 0]), ...X6.map(x => [x, 12, 0]), ...[1, 3, 5, 7, 9].map(x => [x, 11, 1]), [2, 11, 2], [8, 11, 2]], N3201) };
// 3202 "Frost" - Which neighbour to leave. A roof band (rows y3-y9) over a floor band; the clock C in the roof's middle row, frozen 4.
// Its melters: the top T lying on it and its four roof neighbours W, E, N, S - T plus three of the four. Each neighbour sits inside a
// five-tile row (free only from an end) and under its own top; the digs differ in cost and in what they leave in the tray.
const N3202 = { C: [5, 5, 1], T: [6, 6, 2], W: [3, 5, 1], E: [7, 5, 1], N: [5, 3, 1], S: [5, 7, 1] };
defs[3202] = { name: 'Frost', named: N3202, rest: minus([...X6.map(x => [x, 0, 0]), ...[2, 4, 6, 8, 10].flatMap(y => X6.map(x => [x, y, 0])),
  ...[3, 5, 7, 9].flatMap(y => [1, 3, 5, 7, 9].map(x => [x, y, 1])), [2, 4, 2], [8, 4, 2], [2, 8, 2], [8, 8, 2],
  ...X6.map(x => [x, 12, 0]), [5, 11, 1]], N3202) };
// 3203 "Thaw" - The tile on it melts it. A three-layer pyramid at the bottom with the clock C deep on its floor; C's cover LK (under
// all four tops) is gold-locked. Gold key K1 lies on the pyramid's floor edge under three covers, one of them (3,9,1) also a cover of
// the clock. Gold key K2 lies in the top band's roof row, frozen 2 and boxed in its row, with a top KT on it: KT plus one side
// neighbour melt and free it - a player who counts only side tiles takes one too many.
const N3203 = { C: [4, 8, 0], LK: [5, 9, 1], K1: [2, 10, 0], K2: [5, 3, 1], KT: [4, 2, 2] };
defs[3203] = { name: 'Thaw', named: N3203, rest: minus([...pyr(2, 8, 6, 12), ...[0, 2, 4].flatMap(y => X6.map(x => [x, y, 0])),
  ...[1, 3].flatMap(y => [1, 3, 5, 7, 9].map(x => [x, y, 1])), [0, 6, 0], [10, 6, 0], [10, 8, 0], [0, 10, 0], [10, 10, 0], [0, 12, 0],
  [9, 7, 1], [1, 11, 1]], N3203) };
const out = {}, report = [];
for (const [id, d] of Object.entries(defs)) {
  const tiles = [...d.rest], idx = {};
  for (const [k, t] of Object.entries(d.named)) { idx[k] = tiles.length; tiles.push(t); }
  const key = t => t.join(','), seen = new Set();
  for (const t of tiles) { if (seen.has(key(t))) throw Error(id + ': duplicate tile ' + key(t)); seen.add(key(t)); }
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) { const a = tiles[i], b = tiles[j];   // no two tiles in the same place
    if (a[2] === b[2] && Math.abs(a[0] - b[0]) < 2 && Math.abs(a[1] - b[1]) < 2) throw Error(id + ': overlap ' + key(a) + ' / ' + key(b)); }
  if (tiles.length % 2) throw Error(id + ': odd tile count ' + tiles.length);
  // house style: every corner of an upper tile rests on a tile one layer down; never straight on one tile
  const under = (p, a, b) => tiles.some(q => q[2] === p[2] - 1 && q[0] <= a && q[0] + 2 > a && q[1] <= b && q[1] + 2 > b);
  // (3001-3003, the played lab-three boards, keep their shape: their top tile at x 10 hangs half over air - superseded by 31xx)
  if (+id >= 3100) for (const p of tiles) if (p[2] > 0) {
    for (const a of [p[0], p[0] + 1]) for (const b of [p[1], p[1] + 1]) if (!under(p, a, b)) throw Error(id + ': corner of ' + key(p) + ' hangs over air');
    if (seen.has(key([p[0], p[1], p[2] - 1]))) throw Error(id + ': ' + key(p) + ' stands straight on a tile');
  }
  const T = tiles.map(([x, y, z]) => ({ x, y, z })), nb = Lw.neighbors(T), ice = Lw.iceNeighbors(T);
  const nm = i => Object.keys(idx).find(k => idx[k] === i) || String(i);
  const rel = k => { const i = idx[k]; return `${k}#${i}: on ${nb.above[i].map(nm).join(' ') || '-'} | L ${nb.left[i].map(nm).join(' ') || '-'} R ${nb.right[i].map(nm).join(' ') || '-'} | ice ${ice[i].map(nm).join(' ')}`; };
  report.push(`${id} ${d.name}: ${tiles.length} tiles`, ...Object.keys(d.named).map(k => '  ' + rel(k)));
  out[id] = { name: d.name, shape: d.name.toLowerCase(), tiles, named: idx };
}
fs.writeFileSync(path.join(__dirname, 'layouts-custom.json'), JSON.stringify(out));
console.log(report.join('\n'));
