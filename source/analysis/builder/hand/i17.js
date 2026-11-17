// Idea 17 "The twin is under the lock" (vase, layout 1037). The clock (67) stands free on the vase's neck. Its twin (52) lies on the left
// shoulder under 71, and 71 is gold-locked; the gold keys are on the right (70 free, 7 under 55 and 70). A clock taken first waits
// through keys -> lock -> twin and the tray overflows; right: keys, then 71, then 52, and only then the clock.
module.exports = {
  id: 'i17', title: 'The twin is under the lock',
  idea: 'The clock stands free on the neck, but its twin lies under a gold-locked tile and the keys are on the other side. Take the clock first and it waits through the whole chain.',
  layout: 1037, block: [70, 55, 7, 53, 71, 54, 52, 6, 3, 2, 0, 1, 4], target: 52, limit: 10,
  fixed: { 67: 'C', 52: 'C', 70: 'G', 7: 'G' }, inside: [2, 4], locks: [71], keys: [70, 7],
  tests: [{ name: 'dig', expect: 'win', peek: false }, { name: 'clockFirst', expect: 'none', peek: false, tray0: ['C'], gone: [67] }],
  hand: { clock: 67, clockN: 12, routeTest: 'dig', routeSuffix: [67], baits: [{ at: 1, take: [67], why: 'take the free clock first' }] },
};
