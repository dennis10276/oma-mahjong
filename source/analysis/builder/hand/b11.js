// Buried B11 "The twin is beside the clock" (layout 3111 "Arch"). The clock C in the middle row of a buried band under flat rows. The
// left way passes I, a cover over the clock's left side, whose picture is R6's - the clock's right neighbour, which frees only after the
// clock and its own covers. I waits the whole way down. The right way takes R6 itself. Wrong paths: the left; the left via a helper.
const U = require('./band_util.js'), lay = 3111, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const band = U.where(lay, t => (t[1] >= 5 && t[1] <= 7 && t[2] > 0) || (t[1] === 6 && t[2] === 0));
const GK1 = at(1, 1, 1), GK2 = at(9, 11, 1), keyDig = [GK1, GK2, at(8, 11, 2)];
const left = band.filter(i => require('./layouts-custom.json')[lay].tiles[i][0] <= 5 && i !== n.R6);
module.exports = {
  id: 'b11', title: 'The twin is beside the clock (buried)',
  idea: 'A tile on the short way has its twin right beside the clock - but that twin only frees after the clock, so the tile waits the whole way down. Come from the other side.',
  layout: lay, block: [...band, ...keyDig], target: n.C, limit: 19,
  fixed: { [n.I]: 'R', [n.R6]: 'R', [GK1]: 'G', [GK2]: 'G' }, locks: [at(5, 7, 1)], keys: [GK1, GK2], inside: [6, 9],   // + a gold chain on the clock's cover (5,7,1)
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'left', expect: 'none', peek: false, tiles: [...left, ...keyDig] }],
  hand: { clock: n.C, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [at(1, 5, 1)], why: 'start on the short left side' }] },
};
