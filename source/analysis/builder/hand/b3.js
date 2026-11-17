// Buried B3 "The icicle" (layout 3103 "Drip"). The clock C under its gold-locked roof Q (under the top T6); under C hangs the icicle
// D1 D2 D3, each frozen 1 and melted only by the tile above it - so the clock's going thaws it one tile per move. Keys: K1 at the bottom
// of the top pile, K2 free at the bottom right. The left (X1 over L0, L) is the cheap side and reaches the clock in time - but its
// tiles have buried twins: stuck right after the clock. The right (T8, X9, X7 over R3, R2, R) is long and arrives with
// a full tray - and the icicle melts straight into it (D1 = R, D2 = R2, D3 = the clock). Q pairs with R3, which only the right uncovers.
// Wrong paths: the cheap left; keys late (the tray holds the right's tiles); fearing the full tray at the clock.
module.exports = {
  id: 'b3', title: 'The icicle (buried)',
  idea: 'A frozen column hangs under the clock and thaws one tile per move once the clock goes. The cheap side reaches the clock with room to spare and dies right after; the long side arrives with a full tray - the icicle melts into it.',
  layout: 3103,
  block: [17, 16, 18, 12, 13, 14, 15, 58, 59, 53, 54, 52, 51, 48, 47, 46, 50, 49, 43, 44],
  target: 45, limit: 16,
  fixed: { 55: 'i1', 46: 'i1', 56: 'i2', 47: 'i2', 57: 'ck', 45: 'ck', 50: 'q', 48: 'q', 58: 'G', 59: 'G', 17: 'p1', 15: 'p1', 18: 'p2', 14: 'p2', 53: 'p3', 52: 'p3', 54: 'p4', 51: 'p4' },   // the right way's pairs, set by hand
  ice: { 55: 1, 56: 1, 57: 1 }, locks: [50], keys: [58, 59], inside: [4, 6],
  tests: [{ name: 'right', expect: 'win', peek: false, tiles: [17, 16, 18, 12, 13, 14, 15, 58, 59, 53, 54, 52, 51, 48, 47, 46, 50] },
    { name: 'left', expect: 'win', peek: false, tiles: [17, 16, 18, 12, 13, 14, 15, 58, 59, 53, 50, 49, 43, 44, 29, 30, 34, 35, 42] }],
  tailLose: { tiles: [17, 16, 18, 12, 13, 14, 15, 58, 59, 53, 50, 49, 43, 44, 29, 30, 34, 35, 42], limit: 16 },   // the cheap left reaches the clock and dies right after it
  hand: { clock: 45, clockN: 16, routeTest: 'right', baits: [] },
};
