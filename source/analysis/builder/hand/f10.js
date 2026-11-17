// Family F10 "Melt before the lid" (layout 1000; the ice cousin of F1). The clock 8 lies under the lid 40, frozen 5. The dig itself melts
// it four times (59, 63, 42, 48); the fifth melt must come from 34 (under 56), beside it. Dig down first and the dig's tiles wait while
// you fetch the last melt - the tray overflows. Melt it from the side first, then dig.
module.exports = {
  id: 'f10', title: 'Melt before the lid',
  idea: 'The lid over the clock is frozen 5; the dig melts it only 4 times. The last melt sits beside it under another tile. Dig down first and the tray is full of dig tiles when you need that melt: melt first.',
  layout: 1000, block: [63, 67, 64, 59, 42, 40, 52, 48, 6, 7, 62, 66, 41, 49, 56, 34, 57], target: 8, limit: 15,
  ice: { 40: 5 }, inside: [3, 7],
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'digFirst', expect: 'none', peek: false, gone: [63, 67, 64, 59], goneFaces: true }],
  hand: { clock: 8, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [63], why: 'dig down to the lid first' }] },
};
