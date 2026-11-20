// Round 5, R2 "Which neighbour to leave" (layout 3202 "Frost"; no locks). The clock C lies in the roof's middle row, frozen 4; its
// melters are the top T on it and its four roof neighbours W, E, N, S - T plus three of the four. N has nothing on it and looks the
// cheapest, but it is boxed in its row (3 moves); S hides under T and a corner top (4). The only way in time: T, W, E and N - 11
// moves, the clock with no spare. Pictures laid along that route keep the tray at 2-3; face-down tiles may be the way through.
const U = require('./band_util.js'), lay = 3202, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const band = U.where(lay, t => t[2] >= 1 && t[1] >= 3 && t[1] <= 6).filter(i => i !== n.C);
const route = [at(8, 4, 2), at(9, 5, 1), n.T, n.E, at(2, 4, 2), at(1, 5, 1), n.W, at(1, 3, 1), at(3, 3, 1), n.N];
module.exports = {
  id: 'r2', title: 'Which neighbour to leave',
  idea: 'The frozen clock needs the top on it and three of its four neighbours. The open-looking one (nothing on it) is boxed in its row; only one choice of three is in time.',
  layout: lay, block: band, target: n.C, limit: 11, ice: { [n.C]: 4 }, inside: [3, 6],
  fixed: {},
  tests: [{ name: 'all', expect: 'win' }],
  route, pressure: .9,
  hand: { clock: n.C, spare: 0, routeTest: 'all', baits: [{ at: 1, take: [at(2, 8, 2)], why: 'dig toward S' }] },
};
