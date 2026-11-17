// Buried B2 "Break the circle" (layout 3102 "Lattice"). Left: rows A V B / N F M under four covers and one top T. F is frozen 4: N, M,
// its covers L1, L3 and V (straight above it) melt it - without V only three, and M is boxed in by F and the clock: a loop. V is
// gold-locked, and the gold keys K1, K2 lie in the right pile under S. Fetching the keys pulls you right; going round (E, W) fills the
// tray. The keys are for V: open the door into the loop and melt F with N, L1, L3, V.
// Wrong paths: go round once the keys are in hand; open the left without the keys; melt F with N, L1, L3 only (the loop).
module.exports = {
  id: 'b2', title: 'Break the circle (buried)',
  idea: 'The keys lie on the right and pull you round that way - but going round fills the tray. They open the tile above the frozen wall, the only door into the loop on the left.',
  layout: 3102,
  block: [63, 60, 62, 59, 61, 53, 52, 58, 54, 55, 45, 46, 47, 56, 57, 48, 49, 50],
  target: 51, limit: 17,
  fixed: { 60: 'G', 62: 'G' }, locks: [46], keys: [60, 62], ice: { 49: 4 }, inside: [6, 8],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'round', expect: 'none', peek: false, tiles: [63, 60, 62, 59, 61, 53, 52] },
    { name: 'noBreak', expect: 'none', peek: false, tiles: [63, 60, 62, 59, 61, 58, 54, 55, 56, 57, 48, 49, 50], limit: 30 }],
  hand: { clock: 51, spare: 1, routeTest: 'all', baits: [{ at: 'auto', take: [53], why: 'keys in hand, go round on the right' }] },
};
