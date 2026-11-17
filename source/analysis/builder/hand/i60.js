// Idea 60 (two chains) "The silver key belongs to the second half" (Twin Pagodas, layout 2017). Chain 1: the clock (40, corner, under 56 and
// 68) is gold-locked; gold keys 70 (free on top) and 5 (under 44 under 59 under 70). Chain 2: after the clock, 60 is silver-locked; one
// silver key (71) sits free on top of the left pagoda, the other (0) lies under the clock. 71 looks like something to take now - but its
// partner only appears when the clock is gone, and the gold dig needs all three slots.
module.exports = {
  id: 'i60', title: 'The silver key belongs to the second half',
  idea: 'A free silver key sits on top, but its partner lies under the clock. Taken early it waits through the whole gold dig; it belongs to the part after the clock.',
  layout: 2017, block: [70, 59, 44, 5, 4, 43, 68, 56, 40, 0, 71, 57, 69, 41, 45, 58, 1, 6], target: 60, limit: 16,
  fixed: { 70: 'G', 5: 'G', 71: 'S', 0: 'S' }, inside: [3, 6], locks: [40], keys: [70, 5], locks2: [60], keys2: [71, 0],
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'silverFirst', expect: 'none', peek: false, gone: [71], tray0: ['S'] }],
  hand: { clock: 40, spare: 1, routeTest: 'all', secondChain: true, baits: [{ at: 1, take: [71], why: 'take the free silver key now' }] },
};
