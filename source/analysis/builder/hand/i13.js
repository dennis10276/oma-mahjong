// Idea 13 "The silver keys melt the gold key" (layout 2021, Pavilion Terrace). The clock (49) lies under the frozen gold key 75 (ice 3)
// and is gold-locked; the other gold key is 80. Both silver keys (72, 78) touch 75: taking the silver pair melts it twice for no slot.
// The silver locks (85) guard nothing the clock needs, so the silver keys look useless. Wrong: melt 75 with its side tiles 74/76.
module.exports = {
  id: 'i13', title: 'The silver keys melt the gold key',
  idea: 'The clock lies under a frozen gold key. The silver keys open nothing the clock needs, but both touch the frozen key: the silver pair melts it twice without a tray slot.',
  layout: 2021, block: [71, 72, 73, 74, 76, 77, 78, 79, 75, 48, 50, 80, 47], target: 49, limit: 13,
  fixed: { 72: 'S', 78: 'S', 75: 'G', 80: 'G' }, inside: [2, 4],
  ice: { 75: 3 }, locks: [49], keys: [75, 80], locks2: [85], keys2: [72, 78],
  tests: [{ name: 'dig', expect: 'win', peek: false, firsts: 3 }, { name: 'noSilver', expect: 'none', peek: false, tiles: [71, 73, 74, 76, 77, 79, 75, 48, 50, 80, 47] }],
  hand: { clock: 49, spare: 1, routeTest: 'dig' },   // the wrong idea (melting without the silver keys) is the test noSilver
};
