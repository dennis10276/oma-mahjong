// Hand design 2, "one pair, two melts" (approved idea, 2026-11-14; never used). The clock (frozen 1) and a gold key (frozen 1) each
// need one more neighbour gone. Each has a lonely neighbour (N1, N2: twins buried), and ONE pair P touches both ices (P1 the clock,
// P2 the key). Wrong: melt each ice with its own neighbour (two tiles parked). Right: the pair that touches both.
module.exports = {
  title: "One pair, two melts",
  idea: "The clock and a key each need one more neighbour gone. One pair touches both. Melting each with its own lonely neighbour parks two tiles.",
  layout: [1006, 1004, 1020, 1000, 2023, 2021, 2022, 1008, 1037, 1038, 1035, 1041, 2024, 2025, 2026, 23, 1023, 1036, 1040],
  vars: ['C', 'K1', 'K2', 'P1', 'P2', 'N1', 'N2'],
  rel: [['deep', 'C', 3], ['iceNb', 'P1', 'C'], ['iceNb', 'P2', 'K1'], ['iceNb', 'N1', 'C'], ['iceNb', 'N2', 'K1'], ['far', 'P1', 'K1'], ['far', 'P2', 'C'],
        ['far', 'K1', 'C'], ['notOn', 'C', 'P1'], ['notOn', 'C', 'N1'], ['notOn', 'K1', 'P2'], ['notOn', 'K1', 'N2']],
  clock: 'C', spare: 1, ice: { C: 1, K1: 1 }, locks: ['C'], keys: ['K1', 'K2'], digPairs: 0.15, pressure: 2.2,
  route: ['P1', 'P2', 'K1', 'K2', 'C'],
  pairs: { k: ['K1', 'K2'], p: ['P1', 'P2'], n1: ['N1'], n2: ['N2'], c: ['C'] },
  baits: [{ at: 'auto', take: ['N1'], why: 'melt the clock with its own lonely neighbour' }, { at: 'auto', take: ['N2'], why: 'melt the key with its own lonely neighbour' }],
};
