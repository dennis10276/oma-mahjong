// Hand design 5, "the free key pair is the wrong colour" (Claude, 2026-11-16; silver keys). The clock is gold-locked; both silver keys
// lie free (a free pair, keys!) but open only a silver lock the clock does not need. A gold key is frozen; the way melts it.
module.exports = {
  title: 'The free key pair is the wrong colour',
  idea: 'Both silver keys lie free: a free pair of keys. But the clock is gold-locked; the silver keys open a lock the clock does not need. Taking them costs 2 moves.',
  layout: [1006, 1004, 1020, 1000, 2023, 2021, 2022, 1008, 1037, 1038, 1035, 1041, 2024, 2025, 2026, 23, 1023, 1036, 1040, 1021, 1001, 1002, 1003, 1013, 1027, 1034, 1005, 1018],
  vars: ['C', 'K1', 'K2', 'S1', 'S2', 'L2', 'W'],
  rel: [['deep', 'C', 3], ['iceNb', 'W', 'K2'], ['far', 'S1', 'S2'], ['far', 'S1', 'C'], ['far', 'S2', 'C'], ['far', 'L2', 'C'], ['far', 'K1', 'K2'], ['minLayer', 'S1', 1], ['minLayer', 'S2', 1],
        ['notOn', 'K2', 'W'], ['notOn', 'S1', 'K1'], ['notOn', 'S2', 'K1']],
  clock: 'C', spare: 1, ice: { K2: 1 }, locks: ['C'], keys: ['K1', 'K2'], locks2: ['L2'], keys2: ['S1', 'S2'], digPairs: 0.25, pressure: 2,
  route: ['W', 'K1', 'K2', 'C'],
  pairs: { k: ['K1', 'K2'], s: ['S1', 'S2'], w: ['W'], c: ['C'] },
  baits: [{ at: 'auto', take: ['S1', 'S2'], why: 'take the free silver key pair' }],
};
