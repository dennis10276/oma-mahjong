// Idea 22 "The clock's twin is behind silver" (layout 1000, hourglass). The clock (57) stands free on the spine. Its twin (39) lies in
// the lower block under 58 and 60, and 58 is silver-locked; the silver keys are the free corner 71 and 51 (under 68, 70). Taking the
// clock first makes it wait through the silver chain and the tray overflows.
module.exports = {
  id: 'i22', title: "The clock's twin is behind silver",
  idea: 'The clock stands free, but its twin lies under a silver-locked tile. A clock taken first waits in the tray through the whole silver chain.',
  layout: 1000, block: [71, 70, 68, 51, 65, 58, 60, 61, 45, 38, 69, 47, 55, 44, 39], target: 39, limit: 11,
  fixed: { 57: 'C', 39: 'C', 71: 'S', 51: 'S' }, inside: [3, 5], locks2: [58], keys2: [71, 51],
  tests: [{ name: 'dig', expect: 'win', peek: false }, { name: 'clockFirst', expect: 'none', peek: false, tray0: ['C'], gone: [57] }],
  hand: { clock: 57, clockN: 13, routeTest: 'dig', routeSuffix: [57], baits: [{ at: 1, take: [57], why: 'take the free clock first' }] },
};
