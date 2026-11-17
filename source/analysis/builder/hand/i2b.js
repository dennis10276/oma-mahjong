// Idea 2 again through idea_search.js (a check that the generic loop reproduces the hand board)
module.exports = {
  id: 'i2b', title: "Don't take the clock yet", idea: 'The clock is free from the start, but a taken clock waits for its twin deep in the castle, whose dig needs all three slots.',
  layout: 1020, block: [65, 66, 67, 68, 70, 71, 40, 41, 49, 50, 43, 44, 42, 39, 38], target: 38, limit: 14,
  fixed: { 38: 'K', 69: 'K' }, inside: [3, 6],
  tests: [{ name: 'dig', expect: 'win' }, { name: 'clockFirst', expect: 'none', tray0: ['K'] }],
  hand: { clock: 69, clockN: 9, routeTest: 'dig', routeSuffix: [69], baits: [{ at: 1, take: [69], why: 'take the free clock first' }] },
};
