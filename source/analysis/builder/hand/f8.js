// Family F8 "The twin is beside the clock" (layout 1011). The clock 14 is the left bridge tile; its partner 15 lies uncovered right
// beside it. 40, on the short (left) way down, has 15's picture - its twin looks close, but 15 is boxed in by the clock and 16 and only
// frees when the clock goes: on the left way 40 waits through the whole dig and the tray overflows. The right way (16, 15, 14) takes 15
// itself just before the clock.
module.exports = {
  id: 'f8', title: 'The twin is beside the clock',
  idea: 'A tile on the short way has its twin lying uncovered right beside the clock - but that twin only frees when the clock is gone, so the tile waits the whole way down. Come from the other side.',
  layout: 1011, block: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 66, 68, 70, 58, 54, 56, 35, 43, 31, 41, 17, 16, 15], target: 14, limit: 14,
  fixed: { 15: 'R', 40: 'R' }, inside: [5, 10],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'left', expect: 'none', peek: false, tiles: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 66, 68, 70] }],
  hand: { clock: 14, spare: 1, routeTest: 'all', baits: [{ at: 2, take: [69], why: 'keep digging the short way down' }] },   // the whole left way: test 'left'
};
