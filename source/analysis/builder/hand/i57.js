// Idea 57 "The roof can wait" (Little Elephant, layout 2014). The clock (56) is silver-locked and has one tile on it: 69, a silver key. The
// other silver key (1) lies deep at the far end (under 71, 59, 37, 0, 60, 38). Lift the roof key first - as you dig down - and it waits
// in the tray through the whole far dig; dig the far key out first, then the roof key matches it, and the clock is open.
module.exports = {
  id: 'i57', title: 'The roof can wait',
  idea: 'The clock is silver-locked and its only roof is a silver key; the other silver key lies deep at the far end. The roof key can wait: dig the far key first.',
  layout: 2014, block: [69, 71, 59, 37, 0, 60, 38, 1, 72, 61, 39, 2], target: 56, limit: 10,
  fixed: { 69: 'S', 1: 'S' }, inside: [2, 4], locks2: [56], keys2: [69, 1],
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'roofFirst', expect: 'none', peek: false, gone: [69], tray0: ['S'] }],
  hand: { clock: 56, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [69], why: 'lift the roof key first' }] },
};
