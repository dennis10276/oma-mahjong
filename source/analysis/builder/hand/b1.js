// Buried B1 "The circle" (hand-made layout 3101 "Keep"; Dennis 2026-11-17 after lab-three: a new idea standing alone and visible
// is solved by thinking - bury it in a long chain). Chain: two gold keys, each at the bottom of its own pile (K1 top, K2 bottom, five
// moves each) -> the clock's roof P is gold-locked -> a side of the clock. The left side looks cheap: two covers (L1, L3) over N F M.
// Under them: F frozen 4, melted by N, M, L1, L3 - and M is boxed in between F and the clock. The left is a loop, seen only once the
// covers are off. The way is the right: S, R, E, then P (keys) and W.
module.exports = {
  id: 'b1', title: 'The circle (buried)',
  idea: 'The clock\'s left side looks cheap - two covers over three tiles. Under them a frozen wall whose last melter is boxed in by the wall itself: a loop. Lift the covers and the tray already holds them. Go right.',
  layout: 3101,
  block: [17, 16, 18, 12, 13, 14, 15, 55, 53, 52, 54, 48, 49, 50, 51, 56, 67, 66, 62, 65, 61, 63, 64, 57, 58, 59],
  target: 60, limit: 17,
  locks: [65], keys: [55, 56], ice: { 58: 4 }, inside: [11, 13],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'leftFirst', expect: 'none', peek: false, gone: [63], goneFaces: true }],
  hand: { clock: 60, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [63], why: 'open the cheap-looking left side' }] },
};
