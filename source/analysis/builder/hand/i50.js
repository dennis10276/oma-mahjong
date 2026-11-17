// Idea 50 "Its twin is behind silver" (u-shape, layout 1041). The natural first move toward the clock (38) is 77, free on the left arm. But
// 77's twin (41) lies on the right arm under 72, and 72 is silver-locked (keys 61 free, 49 under 80). Taken first, 77 waits through the
// whole silver chain on the other arm; do the silver side first, then the way to the clock.
module.exports = {
  id: 'i50', title: 'Its twin is behind silver',
  idea: 'The obvious first tile toward the clock has its twin on the other arm, under a silver-locked tile. Taken first, it waits through the whole silver chain.',
  layout: 1041, block: [70, 68, 69, 77, 44, 56, 39, 76, 61, 80, 49, 72, 41, 59, 65, 53, 73], target: 38, limit: 14,
  fixed: { 77: 'X', 41: 'X', 61: 'S', 49: 'S' }, inside: [2, 4], locks2: [72], keys2: [61, 49],
  tests: [{ name: 'dig', expect: 'win', peek: false }, { name: 'xFirst', expect: 'none', peek: false, tray0: ['X'], gone: [77] }],
  hand: { clock: 38, spare: 1, routeTest: 'dig', baits: [{ at: 1, take: [77], why: 'take the obvious first tile' }] },
};
