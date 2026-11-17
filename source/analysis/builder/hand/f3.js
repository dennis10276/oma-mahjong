// DROPPED (2026-11-17): reduces to taking a free key early (the worn-out early-key trap); kept as a record, no board.
// Family F3 "The keys pair across colours" (layout 1000). The clock 8 lies under a gold-locked lid (40) and a silver-locked lid (48).
// The two gold keys (71, 62) have different pictures: each one's twin is a silver key (71 = 66, 62 = 60). Opening gold first leaves both
// gold keys waiting; the way is to take each gold key with its silver twin - a pair - so the keys never cost more than one slot.
module.exports = {
  id: 'f3', title: 'The keys pair across colours',
  idea: 'The two gold keys are not twins: each gold key\'s twin is a silver key. Open gold first and both gold keys wait. Take each gold key with its silver twin.',
  layout: 1000, block: [63, 67, 64, 59, 42, 40, 52, 48, 6, 7, 41, 49, 71, 62, 66, 60], target: 8, limit: 16,
  fixed: { 71: 'A', 66: 'A', 62: 'B', 60: 'B' }, inside: [3, 6],
  locks: [40], keys: [71, 62], locks2: [48], keys2: [66, 60],
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'goldFirst', expect: 'none', peek: false, gone: [71, 62], tray0: ['A', 'B'] }],
  hand: { clock: 8, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [71, 62], why: 'open gold first: take both gold keys' }] },
};
