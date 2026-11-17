// Buried B12 "The bridge melts from both ends" (layout 3112 "Span"). The clock C in a floor row under covers: left L1, L3 (under T2)
// over N F M, right P, R (under S) over C W E. C is frozen 3 and its only melters are M, W and its cover P - both sides must come down.
// S, the right side's top, is silver-locked (silver keys K1, K2 in the piles). The two sides' tiles are twins of each other: dig one
// side first and the tray fills. Wrong paths: the open left side first; fetch the keys, then the right side; one side, then the other.
const U = require('./band_util.js'), lay = 3112, n = U.named(lay);
const piles = U.where(lay, t => (t[1] <= 2 || t[1] >= 10) && t[2] > 0);
module.exports = {
  id: 'b12', title: 'The bridge melts from both ends (buried)',
  idea: 'The frozen clock melts only when both its neighbours are gone - one at each end of its row, each under its own covers. Their tiles are twins of each other: dig both sides in step.',
  layout: lay, block: [n.T2, n.L1, n.L3, n.N, n.F, n.M, n.S, n.P, n.R, n.E, n.W, ...piles], target: n.C, limit: 18,
  fixed: { [n.K1]: 'S', [n.K2]: 'S' }, ice: { [n.C]: 3 }, locks2: [n.S], keys2: [n.K1, n.K2], inside: [7, 10],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'leftFirst', expect: 'none', peek: false, gone: [n.T2, n.L1, n.L3, n.N], goneFaces: true }],
  hand: { clock: n.C, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [n.T2], why: 'dig the open left side first' }] },
};
