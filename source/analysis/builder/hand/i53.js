// Idea 53 "The keys thaw each other" (layout 2025, Little Apple). Both gold keys (64, 65) are frozen 1 and lie side by side on the clock (41,
// gold-locked). Melt one from outside (66 under it melts 64), take it, and its going melts the other key. Melting both from outside
// (66 and 67) costs a move and a slot.
module.exports = {
  id: 'i53', title: 'The keys thaw each other',
  idea: 'Both keys are frozen and lie side by side on the clock. Melt one from outside; taking it melts the other.',
  layout: 2025, block: [64, 65, 66, 67, 40, 42, 44, 45, 46, 43, 68, 69, 47], target: 41, limit: 9,
  fixed: { 64: 'G', 65: 'G' }, inside: [2, 5], ice: { 64: 1, 65: 1 }, locks: [41], keys: [64, 65],
  tests: [{ name: 'all', expect: 'win', peek: false }],
  hand: { clock: 41, spare: 1, routeTest: 'all', baits: [{ at: 'auto', take: [67], why: 'melt the second key from outside too' }] },
};
