// Round 5, R1 "Silver opens the gold" (layout 3201 "Vault"; Dennis 2026-11-20: "The keys should be thought about how to get them not
// auto easy take always", "make multiple traps within a have to take path", "Can it go tighter?"). The clock C lies deep in the
// centre pyramid; its cover GL is gold-locked. Gold key G1 lies on the top row under a tile; gold key G2 is boxed in the bottom roof
// row between SL1 and SL2, both silver-locked; the silver keys S1, S2 lie at the edges under one cover each. So gold needs silver
// first, and every key costs a dig. Traps on the one path:
//   1. digging the clock's tops first fills the tray before the keys are out;
//   2. G2 has two doors (SL1 left, SL2 right) that look the same - only the left one leaves room;
//   3. the order of the four key digs against the tray (pictures laid along the route, the tray at 2-3).
// The clock gets no spare move (badge 1 at the clock).
const U = require('./band_util.js'), lay = 3201, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const pyr = U.where(lay, t => t[0] >= 2 && t[0] <= 8 && t[1] >= 2 && t[1] <= 8);
const bottom = [n.SL1, n.SL2, n.G2, at(1, 11, 1), at(9, 11, 1), at(2, 11, 2), at(8, 11, 2)];
const edges = [n.S1, n.S2, at(1, 7, 1), at(9, 3, 1), n.G1, at(7, 1, 1)];
const block = [...pyr, ...bottom, ...edges].filter(i => i !== n.C);
const tops = pyr.filter(i => U.where(lay, t => t[2] === 2).includes(i));
const leftDoor = [at(2, 11, 2), at(1, 11, 1), n.SL1];
// the planned route: silver keys, the left door to G2, then G1 (gold opens), then down to the clock
const route = [at(1, 7, 1), n.S1, at(9, 3, 1), n.S2, ...leftDoor, n.G2, at(7, 1, 1), n.G1, at(4, 4, 2), at(4, 6, 2), at(6, 4, 2), at(6, 6, 2),
  at(3, 3, 1), at(5, 3, 1), at(5, 5, 1), n.GL, at(2, 4, 0)];
module.exports = {
  id: 'r1', title: 'Silver opens the gold',
  idea: 'The second gold key sits between two silver locks: silver first, then the left door, then gold - every key under a tile, the tray at three most of the way.',
  layout: lay, block, target: n.C, limit: 20,
  fixed: { [n.G1]: 'G', [n.G2]: 'G', [n.S1]: 'S', [n.S2]: 'S' },
  locks: [n.GL], keys: [n.G1, n.G2], locks2: [n.SL1, n.SL2], keys2: [n.S1, n.S2], inside: [9, 11],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'topsFirst', expect: 'none', peek: false, gone: tops, goneFaces: true },
    { name: 'rightDoor', expect: 'none', peek: false, tiles: block.filter(i => !leftDoor.includes(i)) }],
  route, pressure: .9, closeOk: true,
  hand: { clock: n.C, spare: 0, routeTest: 'all', baits: [{ at: 1, take: [at(8, 11, 2)], why: 'open the right door' }] },
};
