// Idea 31 "Unlock the escape first" (vase, layout 1003, four layers). At the full tray the way on is a face-down pair: a late dig tile and
// its face-down twin 74 on top. But 74 is silver-locked, and the silver keys (85, 81) are a visible pair: taking them needs a free slot
// for a moment - do it before the tray fills.
module.exports = {
  id: 'i31', title: 'Unlock the escape first',
  idea: 'At the full tray a face-down twin is the way on, but it is silver-locked. The silver keys are a pair that needs a free slot: take them before the tray fills.',
  layout: 1003, block: [79, 77, 80, 66, 59, 58, 46, 10, 36, 11, 34, 74, 85, 81], target: 12, limit: 16,
  fixed: { 34: 'X', 74: 'X', 85: 'S', 81: 'S' }, down: [74], locks2: [74], keys2: [85, 81], inside: [3, 5],
  tests: [{ name: 'dig', expect: 'win', peekForced: true, firsts: 4 }],
  hand: { clock: 12, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [74] },
};
