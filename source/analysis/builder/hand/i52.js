// Idea 52 "The gold key lies on the silver key" (heart, layout 1035). Gold key 71 lies on silver key 52 (the other silver key, 57, is free
// just below). The other gold key (49) is under 66, and 66 is silver-locked. The clock (40, gold-locked) sits under the four top tiles.
// Order: 71 waits -> silver pair -> 66 -> 49 matches 71 -> gold opens -> the clock. Natural wrong start: the clock's roof.
module.exports = {
  id: 'i52', title: 'The gold key lies on the silver key',
  idea: 'A gold key lies on a silver key, and the other gold key is behind a silver lock. Lift the gold key, open silver, fetch the second gold key, and only then the clock.',
  layout: 1035, block: [71, 52, 57, 55, 66, 49, 58, 44, 64, 65, 67, 70, 42, 43, 48, 53], target: 40, limit: 14,
  fixed: { 71: 'G', 49: 'G', 52: 'S', 57: 'S' }, inside: [3, 6],
  locks: [40], keys: [71, 49], locks2: [66], keys2: [52, 57],
  tests: [{ name: 'dig', expect: 'win', peek: false, firsts: 3 }],
  hand: { clock: 40, spare: 1, routeTest: 'dig', baits: [{ at: 1, take: [67], why: 'start at the clock roof' }, { at: 1, take: [70], why: 'start at the clock roof' }] },
};
