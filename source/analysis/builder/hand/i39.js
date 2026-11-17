// Idea 39 "Gold opens the way to melt silver" (castle, layout 1020, right wing). The clock (41) is silver-locked. Silver key 19 is frozen
// (2): its roof 50 melts it once, and the only other melters on the way (13, 25) are gold-locked. Gold key 37 lies under the free silver
// key 64, the other gold key is 59. Gold -> the locked melter -> silver melts -> clock.
module.exports = {
  id: 'i39', title: 'Gold opens the way to melt silver',
  idea: 'The clock is silver-locked and a silver key is frozen; the tiles that can melt it are gold-locked, and a gold key lies under the other silver key.',
  layout: 1020, block: [68, 71, 50, 52, 54, 59, 64, 37, 13, 25, 19, 44, 46, 56, 62, 36, 31], target: 41, limit: 16,
  fixed: { 59: 'G', 37: 'G', 64: 'S', 19: 'S' }, inside: [3, 5],
  locks: [13, 25], keys: [59, 37], locks2: [41], keys2: [64, 19], ice: { 19: 2 },
  tests: [{ name: 'dig', expect: 'win', peek: false, firsts: 3 }, { name: 'noGold', expect: 'none', peek: false, tiles: [68, 71, 50, 52, 54, 64, 19, 44, 46, 56, 62, 36, 31] }],
  hand: { clock: 41, spare: 1, routeTest: 'dig', baits: [] },
};
