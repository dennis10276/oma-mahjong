// Idea 64 (two chains) "The clock melts the silver key" (twins, layout 1032). Chain 1: the clock (48) opens from the left (via 40, under the
// free silver key 65) or the right (via 41, under 71/66/62). Chain 2: silver key 46 is frozen 2 - the centre tile 67 melts it once, and
// the cheapest second melter is the clock itself; 47 is silver-locked. Go right: keep 65 for after the clock, when the clock's own going
// melts its partner. Going left takes the silver key now and it waits.
module.exports = {
  id: 'i64', title: 'The clock melts the silver key',
  idea: 'A silver key next to the clock is frozen; the clock itself is its melter. The second chain only starts when the clock goes - keep the other silver key until then.',
  layout: 1032, block: [71, 66, 62, 41, 65, 61, 70, 40, 67, 46, 58, 57, 49, 50, 48, 39, 56, 68, 60, 45, 64, 35, 37], target: 47, limit: 21,
  fixed: { 65: 'S', 46: 'S' }, inside: [3, 5], ice: { 46: 2 }, locks2: [47], keys2: [65, 46],
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'silverFirst', expect: 'none', peek: false, gone: [65], tray0: ['S'] }],
  hand: { clock: 48, spare: 1, routeTest: 'all', secondChain: true, baits: [{ at: 1, take: [65], why: 'take the free silver key / open the left side' }] },
};
