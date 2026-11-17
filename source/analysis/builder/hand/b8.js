// Buried B8 "The clock closes the pair" (layout 3108 "Gate"). The clock C sits in the middle row of a buried pyramid band; reach it from
// the left (L2, L0) or the right (R6 ...). One cover of the clock (S5) is silver-locked; the silver keys lie one on each side of the band
// (KL at the left, KR at the right) - whichever side you take, you need a trip to the other. The clock's twin is L0, the far left end of
// its row: the left way takes it early and it waits all the way - it looks like the side to avoid - but the clock closes that pair at
// the end. The right way leaves no room for the clock. Wrong paths: go right; take the right key first and stay right; avoid L0.
const U = require('./band_util.js'), lay = 3108, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const KL = at(1, 5, 1), KR = at(9, 7, 1);
module.exports = {
  id: 'b8', title: 'The clock closes the pair (buried)',
  idea: 'The far tile of the clock\'s row has the clock\'s picture: the side that takes it carries it all the way down. That looks wrong - but the clock itself closes the pair at the end. The other side leaves no room for the clock.',
  layout: lay, block: U.where(lay, t => (t[1] >= 5 && t[1] <= 7 && t[2] > 0) || (t[1] === 6 && t[2] === 0)),
  target: n.C, limit: 16,
  fixed: { [n.C]: 'ck', [n.L0]: 'ck', [KL]: 'S', [KR]: 'S' }, locks2: [n.S5], keys2: [KL, KR], inside: [5, 8],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'right', expect: 'none', peek: false, tiles: U.where(lay, t => ((t[1] >= 5 && t[1] <= 7 && t[2] > 0) || (t[1] === 6 && t[2] === 0)) && !(t[0] <= 2 && t[1] === 6 && t[2] === 0)) }],
  hand: { clock: n.C, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [at(9, 5, 1)], why: 'start on the right, the side without the long-waiting tile' }] },
};
