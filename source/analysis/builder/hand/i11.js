// Idea 11 "Both are face-down" (layout 1018, hourglass y). At the full tray the tile you need (40) is face-down, and so is its twin far
// away (71): turn one over, remember it, find the other back - together they go without a slot.
module.exports = {
  id: 'i11', title: 'Both are face-down',
  idea: 'At the full tray the tile you need is face-down, and so is its twin far away. Turn one over, find the other back: together they go without a slot.',
  layout: 1018, block: [72, 60, 74, 58, 34, 66, 64, 40, 36, 12, 71], target: 13, limit: 13,
  fixed: { 40: 'X', 71: 'X' }, down: [40, 71], inside: [3, 4],
  tests: [{ name: 'dig', expect: 'win', peekForced: true, firsts: 4 }],
  hand: { clock: 13, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [40, 71] },
};
