// Idea 10 "The face-down pair melts" (layout 1034, hourglass x). The clock (8) is frozen. At the full tray the way on is a face-down pair,
// and the dig tile in that pair (7, beside the clock) is also its last melter (ice 3: 45, 48 on it, 7 beside it): the move you are forced into is the one that frees the clock.
module.exports = {
  id: 'i10', title: 'The face-down pair melts',
  idea: 'The clock is frozen and the tray fills on the way. At the full tray a face-down pair is the only way on - and its tile next to the clock is the last melter the clock needs.',
  layout: 1034, block: [72, 83, 70, 69, 52, 6, 48, 7, 45, 80], target: 8, limit: 12,
  fixed: { 7: 'X', 80: 'X' }, down: [80], inside: [2, 4], ice: { 8: 3 },
  tests: [{ name: 'dig', expect: 'win', peekForced: true, firsts: 2 }],
  hand: { clock: 8, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: [80] },
};
