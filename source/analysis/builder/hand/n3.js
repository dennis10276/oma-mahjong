// New idea N3 "The icicle" (hand-made layout 3003 "Icicle"). Under the clock C (41) hangs a frozen column D1, D2, D3: each frozen 1 and
// melted only by the tile above it - so when the clock goes, the icicle thaws one tile per move. D1 is the twin of R, D2 of R2, D3 of the
// clock. The right way (X9, X7, R3, R2, R) reaches the clock with R2 and R waiting; the clock makes three - and then the icicle melts
// straight into the tray. The left way (X1, L0, L) is shorter and also reaches the clock in time, but its waiting tiles have buried twins:
// stuck right after the clock. A careful player who fears the full tray after the clock (Don't rush the clock) must see that here the clock
// itself thaws the matches.
module.exports = {
  id: 'n3', title: 'The icicle',
  idea: 'A frozen column hangs under the clock; each tile is melted only by the one above it. Take the clock and the icicle thaws tile by tile - its pictures are the tiles you bring. The short way brings the wrong ones.',
  layout: 3003, block: [46, 48, 47, 44, 43, 42, 45, 39, 40, 20, 21, 22, 23, 24, 25], target: 41, limit: 8,
  fixed: { 49: 'i1', 42: 'i1', 50: 'i2', 43: 'i2', 51: 'ck', 41: 'ck', 46: 'q', 44: 'q' }, ice: { 49: 1, 50: 1, 51: 1 }, inside: [2, 5],   // Q pairs with R3 (under X9): never free on the short way
  tests: [{ name: 'right', expect: 'win', peek: false, tiles: [46, 48, 47, 44, 43, 42, 20, 21, 22, 23, 24, 25] },
    { name: 'left', expect: 'win', peek: false, tiles: [46, 45, 39, 40] },
    { name: 'leftAfter', expect: 'none', peek: false, trayMax: 2, tiles: [46, 45, 39, 40, 20, 21, 22, 23, 24, 25] }],
  hand: { clock: 41, clockN: 8, routeTest: 'right', baits: [] },   // the short way wins the clock and dies after it: tail_check.js
};
