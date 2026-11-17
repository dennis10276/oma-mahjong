// Idea 12 "Uncover the escape first" (bowtie, layout 1012). At the full tray the way on is a face-down pair: the late dig tile 42 and its
// face-down twin 47. But 47 lies under 63, and 63's twin is 29: clearing 63 is a visible pair, which needs one free slot for a moment -
// so it has to happen before the tray fills. Natural: dig to the clock first; then the escape is still covered.
module.exports = {
  id: 'i12', title: 'Uncover the escape first',
  idea: 'At the full tray a face-down twin is the way on, but it lies under a tile whose twin is far away. Clearing that pair needs a free slot - do it before the tray fills.',
  layout: 1012, block: [66, 68, 58, 38, 70, 60, 54, 62, 42, 36, 46, 6, 47, 63, 29], target: 7, limit: 16,
  fixed: { 42: 'X', 47: 'X', 63: 'Y', 29: 'Y' }, down: [47], inside: [3, 5],
  tests: [{ name: 'dig', expect: 'win', peekForced: true, firsts: 4 }],
  hand: { clock: 7, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [47] },
};
