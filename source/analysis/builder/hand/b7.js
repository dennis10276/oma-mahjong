// Buried B7 "Trust the full tray" (layout 3107 "Steps"). A pyramid on the left with the clock C deep in it; rows step down to the right.
// One cover of the clock is gold-locked (keys: K1 in the pyramid under a top, K2 free on the steps). The clock has no spare move. On the
// way the tray goes up to three again and again, and each time the next dig tile matches. Two free tiles on the steps (c1, the corner)
// are twins of waiting tiles: clearing the tray with them "to be safe" costs the move the clock does not have.
const U = require('./band_util.js'), lay = 3107, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const pyr = U.where(lay, t => t[0] <= 6 && t[1] <= 8 && (t[2] > 0 || t[1] === 4)), c2 = at(10, 0, 0), K1 = at(5, 1, 1), K2 = at(9, 5, 1);
module.exports = {
  id: 'b7', title: 'Trust the full tray (buried)',
  idea: 'The tray reaches three again and again on the way down, and every time the next tile matches. Clearing it first with the free twins on the steps costs a move the clock does not have.',
  layout: lay, block: [...pyr, K2, n.c1, c2], target: n.C, limit: 16,
  fixed: { [n.c1]: 'x1', [at(2, 2, 2)]: 'x1', [c2]: 'x2', [at(1, 5, 1)]: 'x2', [K1]: 'G', [K2]: 'G' }, locks: [at(3, 3, 1)], keys: [K1, K2], inside: [5, 8],
  tests: [{ name: 'all', expect: 'win', peek: false, tiles: [...pyr, K2] }],   // the dig wins without the cleaners: clearing is never needed
  hand: { clock: n.C, spare: 0, routeTest: 'all', baits: [{ at: 'full', take: [n.c1], why: 'clear the tray with the free twin first' }] },
};
