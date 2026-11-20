// B13 "One move late, in a pair" (layout 3113 "Dale"; Dennis 2026-11-20 "Allow it as a trick": the game checks the clock after a
// whole action, so a face-down pair that holds the clock may end one move past the number). The clock C lies face-up deep in a
// pyramid; one of its covers (LK) is gold-locked (keys K1 under a top, K2 in the notch). Every way down ends with the tray full
// and the clock showing 1 move left: the clock alone would be a 4th tile, and clock + twin look like 2 moves for 1. Its twin T is
// the face-down tile in the far corner: open it, tap the clock - both go as one action, one move late and still in time. The
// moment the clock goes, its left neighbour R frees and matches the dig's last waiting tile. (The clock number is set to the true
// minimum afterwards by late_clock.js, which checks that only the pair is in time.)
const U = require('./band_util.js'), lay = 3113, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const dig = U.where(lay, t => t[0] >= 4 && t[1] >= 3 && t[1] <= 9 && (t[2] > 0 || t[1] === 6));
module.exports = {
  id: 'b13', title: 'One move late, in a pair',
  idea: 'The clock shows one move left, the tray is full, and the clock alone would be a 4th tile. Its twin lies face-down in the far corner: open it and tap the clock - the two go as one action, one move past the number and still in time.',
  layout: lay, block: [...new Set([...dig, n.K2, at(2, 10, 2)])].filter(i => i >= 0 && i !== n.C), target: n.C, limit: 18,
  fixed: { [n.C]: 'ck', [n.T]: 'ck', [at(8, 6, 0)]: 'r', [n.R]: 'r', [n.K1]: 'G', [n.K2]: 'G' }, down: [n.T], locks: [n.LK], keys: [n.K1, n.K2], inside: [6, 9],
  tests: [{ name: 'dig', expect: 'win', peekForced: true, tiles: [...new Set([...dig, n.K2, n.T])].filter(i => i !== n.C) },
    { name: 'twinFirst', expect: 'none', gone: [n.T], tray0: ['ck'], tiles: [...new Set([...dig, n.K2])].filter(i => i !== n.C) }],
  hand: { clock: n.C, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [n.T], baits: [] },
};
