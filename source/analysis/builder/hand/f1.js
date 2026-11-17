// Family F1 "Keys before the lid" (hourglass, layout 1000). The clock (8) lies under a gold-locked lid (40, under 59 and 63); the gold keys
// are at the other end (69 on top of the lower block, 46 under 65 and 69). Dig down to the lid first and the dig's tiles wait while you
// fetch the keys - the tray overflows. Fetch the keys first, then dig.
module.exports = {
  id: 'f1', title: 'Keys before the lid',
  idea: 'The way to the clock runs through a gold-locked tile, and the keys are at the other end. Dig down to the lock first and those tiles wait while you fetch the keys: get the keys first.',
  layout: 1000, block: [63, 67, 64, 59, 42, 40, 52, 48, 6, 7, 62, 66, 41, 49, 71, 69, 65, 54, 50, 46, 70, 68], target: 8, limit: 20,
  fixed: { 69: 'G', 46: 'G' }, inside: [4, 8], locks: [40], keys: [69, 46],
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'digFirst', expect: 'none', peek: false, gone: [63, 67, 59, 64], goneFaces: true }],
  hand: { clock: 8, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [63], why: 'dig to the lock first' }] },
};
