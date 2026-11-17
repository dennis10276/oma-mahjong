// Idea 9 "The clock goes to the tray too": the dig leaves the tray full, so the clock itself would be the 4th tile. Its twin is the
// face-down corner 71 at the far end of the hourglass: turn it over and take them together.
module.exports = {
  id: 'i9', title: 'The clock goes to the tray too',
  idea: 'The dig leaves the tray full, so the clock itself would be the 4th tile. Its twin is a face-down tile at the far end: turn it over and take them together.',
  layout: 1000, block: [63, 6, 59, 67, 64, 42, 40, 52, 48, 7, 71, 0], target: 8, limit: 13,
  fixed: { 8: 'C', 71: 'C' }, down: [71], inside: [4, 4],
  tests: [{ name: 'dig', expect: 'win', peekForced: true }],
  hand: { clock: 8, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [71] },
};
