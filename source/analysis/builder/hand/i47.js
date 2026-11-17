// Idea 47 "The melting pair" (layout 2022, lower part). The clock (53) is frozen 4: its roof (73, 76) melts it twice. Its two side tiles
// (52, 54) are a pair: taking both - though one open side is enough - finishes the melting for no slot. The other melters (48, 58) wait for
// twins far away.
module.exports = {
  id: 'i47', title: 'The melting pair',
  idea: 'The clock is frozen four times; its roof melts it twice. Its two side tiles are a pair: take both, though one side would do, and the clock melts without a tray slot.',
  layout: 2022, block: [73, 76, 52, 54, 48, 58, 72, 74, 47, 49, 51, 55, 57, 59, 70, 75, 77], target: 53, limit: 13,
  fixed: { 52: 'P', 54: 'P' }, inside: [3, 6], ice: { 53: 4 },
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'noPair', expect: 'none', peek: false, tiles: [73, 76, 52, 48, 58, 72, 74, 47, 49, 51, 55, 57, 59, 70, 75, 77] }],
  hand: { clock: 53, spare: 1, routeTest: 'all', baits: [] },
};
