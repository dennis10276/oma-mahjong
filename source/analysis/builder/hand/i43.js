// Idea 43 "The twin melts the clock" (layout 2024, Checkerboard Dais). The clock (57) is gold-locked and frozen 5: its four roof tiles
// (72-75) melt it four times; the fifth melter can be its own twin 58 beside it - take the twin, the clock melts, and later the clock
// matches it. The other melters (56, 53, 60) wait for twins far away. The keys lie deep (49 under 68-71, 63 under 76, 77).
module.exports = {
  id: 'i43', title: 'The twin melts the clock',
  idea: 'The clock is locked and frozen five times. Its roof melts it four times; the fifth melter can be its own twin - take the twin, the clock melts, and later the clock simply matches it.',
  layout: 2024, block: [72, 73, 74, 75, 56, 58, 53, 60, 68, 69, 70, 71, 49, 76, 77, 63, 48, 50, 62, 64], target: 57, limit: 20,
  fixed: { 57: 'C', 58: 'C', 49: 'G', 63: 'G' }, inside: [5, 8], ice: { 57: 5 }, locks: [57], keys: [49, 63],
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'noTwin', expect: 'none', peek: false, tiles: [72, 73, 74, 75, 56, 53, 60, 68, 69, 70, 71, 49, 76, 77, 63, 48, 50, 62, 64] }],
  hand: { clock: 57, spare: 1, routeTest: 'all', baits: [] },
};
