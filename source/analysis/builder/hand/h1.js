// Hand board H1 "The corner holds the twin" (Claude, 2026-11-16), layout 1006 (hourglass, 3 layers). Designed tile by tile; every
// order of the dig checked exactly (scratchpad h1_orders.js): 6 winning orders, all start at 71.
// The clock (9) lies under 38, 41, 61, 63, 64, 69 with 10 beside it. The dig's pictures: 64+61, 63+38, 11+69, 47+10; 71 waits for a
// buried twin (24). Start at the far edge (71, 47, 11, 69, 63): the tray is full (71, 47, 63) when 41 must go. 41's twin is the
// face-down corner tile 70, far from the clock: turn it over and take them together. Wrong (goal-directed): start with 63, the free
// tile beside the clock; or take the corner 70 early.
module.exports = {
  title: 'The corner holds the twin',
  idea: 'The clock lies deep. Every tile of the dig waits for a twin further down, so only one order works, and when the tray is full the next tile\'s twin is a face-down tile far away in a corner.',
  layout: 1006, exact: true, peek: true, peekNeeded: true, spare: 1, clock: 9,
  route: [71, 47, 11, 69, 63, [70, 41], 10, 61, 64, 38, 9],
  downTiles: [70],
  pairs: { p0: [64, 61], p1: [63, 38], p2: [11, 69], p3: [47, 10], p4: [71, 24], pk: [70, 41], ck: [9] },
  baits: [{ at: 1, take: [63], why: 'start beside the clock' }, { at: 1, take: [70], why: 'take the face-down corner early' }],
  digPairs: 0.3, pressure: 1.8,
};
