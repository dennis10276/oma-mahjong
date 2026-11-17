// Family F2 "The clock is face-down" (layout 1011, the H with a bridge). The clock 14 is the left bridge tile, face-down; the way to it
// is the left tower (12, 13 at the bottom). Every dig ends with three tiles waiting. The way on: turn the clock over, see its picture,
// and take it together with its free twin far right (64) - no slot. The clock releases its bridge partner 15, the twin of a waiting tile.
// The bait: take the free twin 64 early "to have it ready" - it waits through the whole dig and the tray overflows.
module.exports = {
  id: 'f2', title: 'The clock is face-down',
  idea: 'The clock lies face-down. At the end the tray is full, but the clock itself can be turned over and taken with its free twin - no slot needed. Taking that twin early only makes it wait.',
  layout: 1011, block: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 15, 64], target: 14, limit: 15,
  fixed: { 14: 'CT', 64: 'CT' }, inside: [3, 6], down: [14],
  tests: [{ name: 'dig', expect: 'win', peekForced: true }, { name: 'twinFirst', expect: 'none', gone: [64], tray0: ['CT'] }],
  hand: { clock: 14, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [14], baits: [{ at: 1, take: [64], why: 'take the clock\'s free twin early' }] },
};
