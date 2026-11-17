// Idea 30 "Melt the escape first" (vase x, layout 1016). At the full tray the way on is a face-down pair: the late dig tile 30 and its
// face-down twin 65 in the top corner. But 65 is frozen; its melter 66 has its twin (68) far away at the bottom - melting is a visible
// pair, which needs a free slot: do it before the tray fills.
module.exports = {
  id: 'i30', title: 'Melt the escape first',
  idea: 'At the full tray a face-down twin is the way on, but it is frozen, and melting it is a pair that needs a free slot. Melt it before the tray fills.',
  layout: 1016, block: [70, 69, 71, 60, 54, 53, 40, 10, 32, 11, 30, 65, 66, 68, 57], target: 12, limit: 16,
  fixed: { 30: 'X', 65: 'X', 66: 'M', 68: 'M' }, down: [65], ice: { 65: 1 }, inside: [3, 5],
  tests: [{ name: 'dig', expect: 'win', peekForced: true, firsts: 4 }],
  hand: { clock: 12, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [65] },
};
