// Buried B4 "Keys before the lid" (layout 3104 "Well"). Two pyramids. The clock C deep in the top one under four covers and a top; one
// cover, the lid L, is gold-locked and lies hidden under the tops T4, T6 - the lock only shows once you are digging. The gold keys K1,
// K2 are in the bottom pyramid, each at the end of its row under one top. Dig down first and the top's tiles wait in the tray while
// you go for the keys. Wrong paths: dig the top first; one key, then dig; dig from the other top corner.
const U = require('./band_util.js'), lay = 3104, n = U.named(lay);
const top = U.where(lay, t => t[1] >= 2 && t[1] <= 6 && (t[2] > 0 || t[1] === 4)), keysArea = U.where(lay, t => t[1] >= 9 && t[1] <= 10 && t[2] > 0);
module.exports = {
  id: 'b4', title: 'Keys before the lid (buried)',
  idea: 'The clock lies deep in a pyramid; one of its covers is locked, but you only see the lock once you have dug down to it - and the keys are in the other pyramid. Fetch the keys first.',
  layout: lay, block: [...top, ...keysArea], target: n.C, limit: 18,
  fixed: { [n.K1]: 'G', [n.K2]: 'G' }, locks: [n.L], keys: [n.K1, n.K2], inside: [11, 13],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'digFirst', expect: 'none', peek: false, gone: [n.T4, n.T6], goneFaces: true }],
  hand: { clock: n.C, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [n.T4], why: 'dig down to the clock first' }] },
};
