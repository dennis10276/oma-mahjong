// Round 5, R3 "The tile on it melts it" (layout 3203 "Thaw"). The clock C lies deep in the bottom pyramid; its cover LK, under all
// four tops, is gold-locked. Gold key K1 lies on the pyramid's floor edge under three covers - one of them is also the clock's cover,
// so the two digs share a tile and their order decides the tray. Gold key K2 is frozen 2 in the top band, boxed in its row, with the
// top KT on it: KT and one side neighbour both melt it (the tile ON a frozen tile counts, MECHANICS.md) - two side melters is one
// move too many for a clock with no spare.
const U = require('./band_util.js'), lay = 3203, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const pyr = U.where(lay, t => t[0] >= 2 && t[0] <= 8 && t[1] >= 6).filter(i => i !== n.C);
const topRow = U.where(lay, t => t[2] >= 1 && t[1] <= 3);
const block = [...pyr, at(1, 11, 1), at(0, 10, 0), ...topRow];
const route = [n.KT, at(1, 3, 1), at(3, 3, 1), n.K2, at(4, 10, 2), at(1, 11, 1), at(3, 11, 1), at(4, 8, 2), at(3, 9, 1), at(0, 10, 0), n.K1,
  at(6, 8, 2), at(6, 10, 2), at(3, 7, 1), at(5, 7, 1), n.LK, at(2, 8, 0)];
module.exports = {
  id: 'r3', title: 'The tile on it melts it',
  idea: 'The frozen key needs two melts: the top on it counts as one, so the top and one side tile free it. Its partner key shares a cover with the clock.',
  layout: lay, block, target: n.C, limit: 18, ice: { [n.K2]: 2 }, locks: [n.LK], keys: [n.K1, n.K2], inside: [11, 13],
  fixed: { [n.K1]: 'G', [n.K2]: 'G' },
  tests: [{ name: 'all', expect: 'win' }],
  route, pressure: .9,
  hand: { clock: n.C, spare: 0, routeTest: 'all', baits: [{ at: 1, take: [at(9, 3, 1)], why: 'melt the key from both sides' }] },
};
