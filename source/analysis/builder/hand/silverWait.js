// Hand design 4, "the gold key waits for silver" (Claude, 2026-11-16; silver keys). The clock is gold-locked; gold key K2 carries a
// silver lock (it shows both signs). Silver key S2 is frozen (1); M, a tile the way takes anyway, melts it; O is a lonely outside
// neighbour of S2 (twin buried). Wrong: take the visible gold key K1 early (it parks until silver opens K2); melt S2 from outside with O.
module.exports = {
  title: "The gold key waits for silver",
  idea: "One gold key carries a silver lock. A silver key is frozen; the way melts it. Taking the free gold key early, or melting from outside, costs.",
  layout: [1004, 1020, 1000, 2023, 2021, 2022, 1008, 1037, 1038, 1035, 1041, 2024, 2025, 2026, 23, 1023, 1036, 1040],
  vars: ['C', 'K1', 'K2', 'S1', 'S2', 'M', 'O'],
  rel: [['deep', 'C', 3], ['iceNb', 'M', 'S2'], ['iceNb', 'O', 'S2'], ['far', 'K1', 'C'], ['far', 'K2', 'C'], ['far', 'S1', 'S2'], ['far', 'K1', 'K2'],
        ['notOn', 'S2', 'M'], ['notOn', 'S2', 'O'], ['notOn', 'M', 'O'], ['notOn', 'K2', 'K1'], ['notOn', 'S2', 'K1']],
  clock: 'C', spare: 1, ice: { S2: 1 }, locks: ['C'], keys: ['K1', 'K2'], locks2: ['K2'], keys2: ['S1', 'S2'], digPairs: 0.25, pressure: 2,
  route: ['M', 'S1', 'S2', 'K2', 'K1', 'C'],
  pairs: { k: ['K1', 'K2'], s: ['S1', 'S2'], m: ['M'], o: ['O'], c: ['C'] },
  baits: [{ at: 'auto', take: ['K1'], why: 'take the free gold key early' }, { at: 'auto', take: ['O'], why: 'melt the silver key from outside' }],
};
