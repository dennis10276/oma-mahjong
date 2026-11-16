// Hand design 3, "the dig melts the key" (approved idea, 2026-11-14; never used). Gold key K1 is frozen (2); two of its neighbours
// (W1, W2) are tiles the way to the clock takes anyway. Outside neighbours O1, O2 are free early (twins buried). Wrong: prepare the
// ice first with O1, O2 (the lesson of every earlier level): two tiles parked. Right: dig on; the ice melts on the way.
module.exports = {
  title: "The dig melts the key",
  idea: "A gold key is frozen (2). Two tiles you dig anyway touch it. Melting it first from outside costs the clock.",
  layout: [1006, 1004, 1020, 1000, 2023, 2021, 2022, 1008, 1037, 1038, 1035, 1041, 2024, 2025, 2026, 23, 1023, 1036, 1040],
  vars: ['C', 'K1', 'K2', 'W1', 'W2', 'O1', 'O2'],
  rel: [['notFree', 'C'], ['iceNb', 'W1', 'K1'], ['iceNb', 'W2', 'K1'], ['iceNb', 'O1', 'K1'], ['iceNb', 'O2', 'K1'], ['far', 'K1', 'C'],
        ['notOn', 'K1', 'W1'], ['notOn', 'K1', 'W2'], ['notOn', 'K1', 'O1'], ['notOn', 'K1', 'O2'], ['notOn', 'W1', 'O1'], ['notOn', 'W2', 'O1'], ['notOn', 'W1', 'O2'], ['notOn', 'W2', 'O2']],
  clock: 'C', spare: 1, ice: { K1: 2 }, locks: ['C'], keys: ['K1', 'K2'], digPairs: 0.3, pressure: 1.8,
  route: ['W1', 'W2', 'K1', 'K2', 'C'],
  pairs: { k: ['K1', 'K2'], o1: ['O1'], o2: ['O2'], w1: ['W1'], w2: ['W2'], c: ['C'] },
  baits: [{ at: 'auto', take: ['O1'], why: 'prepare the key ice from outside' }, { at: 'auto', take: ['O2'], why: 'prepare the key ice from outside' }],
};
