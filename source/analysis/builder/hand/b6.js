// Buried B6 "The clock is face-down" (layout 3106 "Hill"). A big pyramid; the clock C lies face-down on its floor under four covers and
// a top; one cover (LK) is gold-locked (keys K1 under a top, K2 in the notch on the right). Every way down ends with the tray full.
// The way on: turn the clock over and take it with its twin T, free in the far corner - no slot. The moment the clock goes, its right
// neighbour R frees and matches the last tile of the dig. Wrong paths: arrive full and think you are stuck; keep room with extra
// moves (too slow); take the far corner tile early (it waits all the way).
const U = require('./band_util.js'), lay = 3106, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const dig = U.where(lay, t => t[0] <= 6 && t[1] >= 3 && t[1] <= 9 && (t[2] > 0 || t[1] === 6));
module.exports = {
  id: 'b6', title: 'The clock is face-down (buried)',
  idea: 'The clock lies face-down at the bottom of a pyramid, and every way down ends with a full tray. Turn the clock over: its twin is the free tile in the far corner, and the two go together without a slot.',
  layout: lay, block: [...new Set([...dig, n.K2, at(8, 10, 2)])].filter(i => i >= 0 && i !== n.C), target: n.C, limit: 18,
  fixed: { [n.C]: 'ck', [n.T]: 'ck', [at(2, 6, 0)]: 'r', [n.R]: 'r', [n.K1]: 'G', [n.K2]: 'G' }, down: [n.C], locks: [n.LK], keys: [n.K1, n.K2], inside: [6, 9],
  tests: [{ name: 'dig', expect: 'win', peekForced: true, tiles: [...new Set([...dig, n.K2, n.T])].filter(i => i !== n.C) },
    { name: 'twinFirst', expect: 'none', gone: [n.T], tray0: ['ck'], tiles: [...new Set([...dig, n.K2])].filter(i => i !== n.C) }],
  hand: { clock: n.C, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [n.C], baits: [] },
};
