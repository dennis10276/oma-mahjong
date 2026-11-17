// New idea N2 "Break the circle" (hand-made layout 3002 "Terrace"). The same loop as N1 (N F M C: F frozen 2, M boxed in by F and the
// clock), but F has a third melter: V (45), straight above it in the row y4 - a tile that touches no side of the loop. A then V, and N:
// F melts, then F, M, the clock. Going round on the right (S, R, P, E, W) is no longer than the loop, but its tiles fill the tray.
// Wrong idea (after N1): "the left is a loop, go round" - the right fills the tray. The loop has a door from the row above.
module.exports = {
  id: 'n2', title: 'Break the circle',
  idea: 'The short way is the same frozen loop - but the wall has a third melter, straight above it in the next row. Ice melts from the row above; sides do not reach there. Break the loop from above; going round fills the tray.',
  layout: 3002, block: [44, 45, 46, 47, 48, 49, 53, 55, 54, 52, 51, 19, 20, 21, 22, 23, 24], target: 50, limit: 8,
  ice: { 48: 2 }, inside: [4, 8],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'right', expect: 'none', peek: false, tiles: [53, 55, 54, 52, 51, 19, 20, 21, 22, 23, 24] },
    { name: 'noBreak', expect: 'none', peek: false, tiles: [47, 48, 49, 53], limit: 30 },
    { name: 'roundCommitted', expect: 'none', peek: false, gone: [55, 54], goneFaces: true }],
  hand: { clock: 50, spare: 1, routeTest: 'all', baits: [] },   // going round = S then R (R lies under S, so no single bait): test 'roundCommitted'
};
