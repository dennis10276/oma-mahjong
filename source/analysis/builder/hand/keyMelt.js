// Hand design 1, "the keys melt the clock" (Claude, 2026-11-16). The clock lies deep, frozen (2) and gold-locked. Both gold keys
// touch it: taking them opens the lock AND melts the clock. Wrong idea (every earlier ice level taught it): melt the clock with the
// free pair P that touches it once the dig opens it - free, matches at once, melts the clock - 2 moves the clock does not have.
module.exports = {
  title: "The keys melt the clock",
  idea: "The clock is frozen and gold-locked. Both keys touch it: taking them opens the lock and melts the clock. Melting it first with the free pair beside it wastes the spare move.",
  layout: [1006, 1004, 1020, 1000, 2023, 2021, 2022, 1008, 1037, 1038, 1035, 1041, 2024, 2025, 2026, 23, 1023, 1036, 1040],
  vars: ['C', 'K1', 'K2', 'P1', 'P2'],
  rel: [['deep', 'C', 4], ['iceNb', 'K1', 'C'], ['iceNb', 'K2', 'C'], ['iceNb', 'P1', 'C'], ['iceNb', 'P2', 'C'], ['side', 'K1', 'C'],
        ['notOn', 'C', 'K1'], ['notOn', 'C', 'K2'], ['notOn', 'C', 'P1'], ['notOn', 'C', 'P2'], ['notOn', 'P1', 'K1'], ['notOn', 'P2', 'K1'], ['notOn', 'P1', 'K2'], ['notOn', 'P2', 'K2']],
  clock: 'C', spare: 1, ice: { C: 2 }, locks: ['C'], keys: ['K1', 'K2'], digPairs: 0.3, pressure: 1.8,
  route: ['K1', 'K2', 'C'],
  pairs: { k: ['K1', 'K2'], p: ['P1', 'P2'], c: ['C'] },
  baits: [{ at: 'auto', take: ['P1', 'P2'], why: 'melt the clock with the free pair first' }],
};
