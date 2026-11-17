// Idea 29 "The twin is behind both colours" (house, layout 1038). The clock (68) stands free on the roof. Its twin (41) lies under 69 and
// 70; 70 is gold-locked; one gold key is the chimney (0), which carries a silver lock; the silver keys are 71 (free) and 48 (under 71).
// Silver -> gold -> twin -> clock. A clock taken first waits in the tray through the whole chain.
module.exports = {
  id: 'i29', title: 'The twin is behind both colours',
  idea: 'The clock is free; its twin lies under a gold-locked tile, and a gold key carries a silver lock. Silver, then gold, then the twin, and only then the clock.',
  layout: 1038, block: [71, 56, 48, 49, 0, 65, 69, 70, 44, 45, 52, 53, 41, 47, 59, 61, 57], target: 41, limit: 13,
  fixed: { 68: 'C', 41: 'C', 0: 'G', 65: 'G', 71: 'S', 48: 'S' }, inside: [3, 5],
  locks: [70], keys: [0, 65], locks2: [0], keys2: [71, 48],
  tests: [{ name: 'dig', expect: 'win', peek: false }, { name: 'clockFirst', expect: 'none', peek: false, tray0: ['C'], gone: [68] }],
  hand: { clock: 68, clockN: 15, routeTest: 'dig', routeSuffix: [68], baits: [{ at: 1, take: [68], why: 'take the free clock first' }] },
};
