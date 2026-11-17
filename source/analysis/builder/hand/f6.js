// Family F6 "Don't rush the clock" (layout 1011). The clock 14 (bridge) is one move closer from the left tower than from the right.
// The left way wins the clock - and leaves the tray full with three tiles whose twins are all buried: the level is stuck right after.
// The right way, one move longer, reaches the clock with room to spare. The clock is not the end of the level.
module.exports = {
  id: 'f6', title: 'Don\'t rush the clock',
  idea: 'The short way reaches the clock in time but leaves three tiles waiting with buried twins - stuck right after the clock. The longer way leaves room to go on.',
  layout: 1011, block: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 66, 68, 70, 58, 54, 56, 35, 43, 31, 41, 17, 16, 15], target: 14, limit: 12,
  fixed: { 68: 'r1', 58: 'r1', 66: 'r2', 15: 'r2', 54: 'r3', 43: 'r3', 41: 'r4', 35: 'r4', 17: 'r5', 31: 'r5', 16: 'r6', 14: 'c' },
  free: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 70, 56], inside: [3, 6],
  tests: [{ name: 'all', expect: 'win', peek: false, trayMax: 2 },
    { name: 'left', expect: 'win', peek: false, tiles: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13] },
    { name: 'leftAfter', expect: 'none', peek: false, trayMax: 2, limit: 12, tiles: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 66, 68, 70, 60, 61, 64, 65] }],
  hand: { clock: 14, clockN: 12, routeTest: 'all', baits: [] },   // the bait (the short way) wins the clock and dies after it: checked by tail_check.js (all short-way orders lost after the clock)
};
