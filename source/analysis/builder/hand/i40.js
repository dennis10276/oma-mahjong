// Idea 40 "One colour at a time" (frame, layout 1004). The clock (26, deep in the lower block) is locked twice: gold and silver. One key
// of each colour lies free on the side walls (gold 53, silver 54); the partners lie side by side under the top (gold 9, silver 8). Take a
// free key of each colour early and two tiles wait through the whole dig; finish one colour before starting the other.
module.exports = {
  id: 'i40', title: 'One colour at a time',
  idea: 'The clock is locked in gold and in silver. One key of each colour lies free; taking both early leaves two tiles waiting through the dig. Finish one colour before starting the other.',
  layout: 1004, block: [65, 63, 62, 45, 37, 24, 36, 25, 66, 67, 53, 6, 49, 7, 43, 54, 11, 50, 10, 8, 9], target: 26, limit: 24,
  fixed: { 53: 'G', 9: 'G', 54: 'S', 8: 'S' }, inside: [5, 8],
  locks: [26], keys: [53, 9], locks2: [26], keys2: [54, 8],
  tests: [{ name: 'dig', expect: 'win', peek: false }, { name: 'bothFirst', expect: 'none', peek: false, tray0: ['G', 'S'], gone: [53, 54] }],
  hand: { clock: 26, spare: 1, routeTest: 'dig', baits: [] },
};
