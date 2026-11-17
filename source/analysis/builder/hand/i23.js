// Idea 23 "The clock's twin is frozen" (layout 2023, Pavilion Vanguard). The clock (76) stands free and alone. Its twin (51) is frozen
// (3): its roof (72, 75) melts it twice, one more neighbour must go. A clock taken first waits in the tray through the melting.
module.exports = {
  id: 'i23', title: "The clock's twin is frozen",
  idea: 'The clock stands free, but its twin is frozen three times; the clock taken first waits in the tray while you melt the twin.',
  layout: 2023, block: [68, 69, 72, 75, 50, 52, 46, 45, 47, 55, 59, 60, 77, 73, 51], target: 51, limit: 11,
  fixed: { 76: 'C', 51: 'C' }, inside: [3, 6], ice: { 51: 3 },
  tests: [{ name: 'dig', expect: 'win', peek: false }, { name: 'clockFirst', expect: 'none', peek: false, tray0: ['C'], gone: [76] }],
  hand: { clock: 76, clockN: 12, routeTest: 'dig', routeSuffix: [76], baits: [{ at: 1, take: [76], why: 'take the free clock first' }] },
};
