// Hand design 6, "silver opens the melter" (Claude, 2026-11-16; silver keys). The clock is gold-locked; gold key K2 is frozen (1). On
// the way, its only melter L is silver-locked; O is a lonely outside neighbour of K2 (twin buried). Silver keys first, then L melts K2.
module.exports = {
  title: 'Silver opens the melter',
  idea: 'A gold key is frozen. The tile that melts it on the way is silver-locked, so the silver keys come first. Melting the key from outside, or taking the free gold key early, costs.',
  layout: [1006, 1004, 1020, 1000, 2023, 2021, 2022, 1008, 1037, 1038, 1035, 1041, 2024, 2025, 2026, 23, 1023, 1036, 1040, 1021, 1001, 1002, 1003, 1013, 1027, 1034, 1005, 1018],
  vars: ['C', 'K1', 'K2', 'S1', 'S2', 'L', 'O'],
  rel: [['deep', 'C', 3], ['iceNb', 'L', 'K2'], ['iceNb', 'O', 'K2'], ['far', 'K2', 'C'], ['far', 'S1', 'S2'], ['far', 'K1', 'K2'], ['notOn', 'K2', 'L'], ['notOn', 'K2', 'O'], ['notOn', 'L', 'O'],
        ['notOn', 'L', 'S1'], ['notOn', 'L', 'S2'], ['minLayer', 'O', 1]],
  clock: 'C', spare: 1, ice: { K2: 1 }, locks: ['C'], keys: ['K1', 'K2'], locks2: ['L'], keys2: ['S1', 'S2'], digPairs: 0.25, pressure: 2,
  route: ['S1', 'S2', 'L', 'K1', 'K2', 'C'],
  pairs: { k: ['K1', 'K2'], s: ['S1', 'S2'], l: ['L'], o: ['O'], c: ['C'] },
  baits: [{ at: 'auto', take: ['O'], why: 'melt the gold key from outside' }, { at: 'auto', take: ['K1'], why: 'take the free gold key early' }],
};
