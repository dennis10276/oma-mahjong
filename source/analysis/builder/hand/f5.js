// Family F5 "The escape is too slow" (layout 1011). The clock 14 (bridge) lies under the left tower. Digging straight down fills the
// tray, and a face-down pair is ready to save it (18, the twin of 13, under 61 and 48) - but uncovering and taking it costs three clock
// moves (14 in all, clock 13). The way: one free tile from the right tower (70), taken at the right moment, pairs and the tray never
// fills (12 moves). After many boards where the face-down pair saves you, here it is too slow.
module.exports = {
  id: 'f5', title: 'The escape is too slow',
  idea: 'Digging down the left tower fills the tray, and a face-down pair is ready to save it (its twin under 61 and 48) - but uncovering and taking it costs three moves, the clock allows one. One free tile from the other tower, taken at the right moment, pairs and keeps the tray from filling.',
  layout: 1011, block: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 66, 68, 70, 58, 54, 56, 35, 43, 31, 41, 17, 16, 15, 61, 48, 18], target: 14, limit: 13,
  fixed: { 18: 'E', 13: 'E', 61: 'U', 48: 'U', 68: 'r1', 58: 'r1', 66: 'r2', 15: 'r2', 54: 'r3', 43: 'r3', 41: 'r4', 35: 'r4', 17: 'r5', 31: 'r5', 16: 'r6', 14: 'c', 12: 'c' }, free: [69, 67, 71, 55, 57, 40, 59, 42, 30, 34, 70, 56], inside: [3, 6], down: [18],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'left', expect: 'none', tiles: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 61, 48, 18] },
    { name: 'leftEscape', expect: 'win', tiles: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 61, 48, 18], limit: 16, peekForced: true }],
  hand: { clock: 14, spare: 1, routeTest: 'all', downTiles: [18], baits: [] },   // the wrong plan is a whole side: tests 'left' (no win in time) and 'leftEscape' (only with the face-down pair, too late)
};
