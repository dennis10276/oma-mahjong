// Idea 14 "Crossing" (layout 2022). The clock (48) is silver-locked. The silver key right on it (73) carries a gold lock - it shows
// both signs; the other silver key (69) lies free in the corner. Gold first: 76 is free, 42 is under 66. Wrong: take the free silver
// key early - it waits in the tray through the whole gold dig.
module.exports = {
  id: 'i14', title: 'Crossing',
  idea: 'The clock is silver-locked, and the silver key lying on it carries a gold lock. Gold comes first; the free silver key taken early only waits.',
  layout: 2022, block: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 49, 50, 51, 52, 53, 54, 55, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 76], target: 48, limit: 15,
  fixed: { 69: 'S', 73: 'S', 76: 'G', 42: 'G' }, inside: [6, 9],
  locks2: [48], keys2: [69, 73], locks: [73], keys: [76, 42],
  tests: [{ name: 'dig', expect: 'win', peek: false, firsts: 3 }, { name: 'silverFirst', expect: 'none', peek: false, tray0: ['S'], gone: [69] }],
  hand: { clock: 48, spare: 1, routeTest: 'dig', baits: [{ at: 1, take: [69], why: 'take the free silver key first' }] },
};
