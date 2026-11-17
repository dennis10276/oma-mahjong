// Idea 34 "You don't need the keys" (layout 2023). The clock (46) has a one-tile side (45, under 68) - but 45 is gold-locked and the keys
// are far away (79 free, 63 under 79). The lock makes the keys look necessary; they are not: the other side (47, 48, 49) fits the clock,
// the keys do not.
module.exports = {
  id: 'i34', title: "You don't need the keys",
  idea: 'The clock\'s short side is a single gold-locked tile and the keys are far away. The lock makes the keys look necessary - going round the other side is the only way that fits.',
  layout: 2023, block: [68, 69, 70, 71, 72, 73, 74, 45, 47, 48, 49, 79, 63, 64, 58], target: 46, limit: 11,
  fixed: { 79: 'G', 63: 'G' }, locks: [45], keys: [79, 63], inside: [3, 6],
  tests: [{ name: 'all', expect: 'win', peek: false, firsts: 3 },
          { name: 'keys', expect: 'none', peek: false, tiles: [68, 69, 72, 45, 79, 63, 64, 58, 70, 73] },
          { name: 'round', expect: 'win', peek: false, tiles: [68, 69, 70, 71, 72, 73, 74, 47, 48, 49] }],
  hand: { clock: 46, spare: 1, routeTest: 'round', baits: [{ at: 1, take: [79], why: 'go for the keys' }] },
};
