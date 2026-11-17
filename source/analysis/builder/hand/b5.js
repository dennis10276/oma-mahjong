// Buried B5 "Melt before the lid" (layout 3105 "Ridge"). A pyramid band across the middle. The clock C under four covers and a top;
// one cover, the lid L, is frozen 5: the dig to the clock melts it four times (its tops 44, 45 and its neighbours 38, 39), the fifth
// melt is F3 beside it on the far side, boxed in between L and F1 (under the top 43). The ice number only shows when the tops are off.
// Dig to the clock first and its tiles wait while you fetch 43, F1, F3. Wrong paths: dig from the right; dig the tops first.
const U = require('./band_util.js'), at = (x, y, z) => U.at(3105, x, y, z), SK1 = at(9, 1, 1), SK2 = at(1, 11, 1);
module.exports = {
  id: 'b5', title: 'Melt before the lid (buried)',
  idea: 'One cover of the clock is frozen 5, but the dig melts it only four times - the last melter is on the far side, boxed in. You only see the ice once the tops are off. Melt it before you dig in.',
  layout: 3105,
  block: [43, 44, 45, 46, 36, 37, 38, 39, 40, 41, 42, 69, 68, 67, 26, 31, 34, 23, SK1, at(8, 1, 2), SK2, at(2, 11, 2)],
  target: 66, limit: 19,
  ice: { 67: 5 }, locks2: [39], keys2: [SK1, SK2], fixed: { [SK1]: 'S', [SK2]: 'S' }, inside: [7, 9],   // + a silver chain: 39 (7,5,1) is silver-locked, keys at two row ends
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'digFirst', expect: 'none', peek: false, gone: [46, 45, 39, 40], goneFaces: true }],
  hand: { clock: 66, spare: 1, routeTest: 'all', baits: [] },   // the wrong plan is digging before melting: test 'digFirst'
};
