// Idea 27 "The ice ladder" (layout 2026, Little Diamond). The clock (68) stands on top but is frozen, and so are all three tiles that could
// melt it (66, 69, 70), each by its own neighbours: thaw chains lead to the clock (64 -> 66, 67 -> 66 + 69, 71 -> 69 + 70, 72 -> 70).
// Only one chain fits the tray and the clock; the clock is gold-locked and the keys lie deep (49 under 67/69, 58 under 72).
module.exports = {
  id: 'i27', title: 'The ice ladder',
  idea: 'The clock is frozen, and so is every tile that could melt it. Several thaw chains lead up to it; only one fits the tray.',
  layout: 2026, block: [64, 65, 66, 67, 69, 70, 71, 72, 73, 49, 58, 59, 45, 50, 54, 61, 63], target: 68, limit: 14,
  fixed: { 49: 'G', 58: 'G' }, inside: [6, 7], ice: { 68: 1, 66: 1, 69: 1, 70: 1 }, locks: [68], keys: [49, 58],
  tests: [{ name: 'all', expect: 'win', peek: false, firsts: 3 }],
  hand: { clock: 68, spare: 1, routeTest: 'all', baits: [] },
};
