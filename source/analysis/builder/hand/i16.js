// Idea 16 "The long way is the only way" (layout 2023, Pavilion Vanguard). The clock (36) sits near the left end of a row: one tile (35,
// under 64) clears its left side, three (37, 38, 39) its right side. The short side's tiles wait for twins far away (slots); the long
// side pairs up. Wrong (goal-directed): open the short side. Right: the long way round.
module.exports = {
  id: 'i16', title: 'The long way is the only way',
  idea: 'One side of the clock needs one tile, the other three. The short side fills the tray; only the long way round fits.',
  layout: 2023, block: [64, 65, 66, 67, 35, 37, 38, 39, 68, 40, 41, 69, 42], target: 36, limit: 10,
  fixed: {}, inside: [2, 5],
  tests: [{ name: 'all', expect: 'win', peek: false, firsts: 3 },
          { name: 'short', expect: 'none', peek: false, tiles: [64, 65, 66, 35, 68, 40, 41, 69, 42] },
          { name: 'long', expect: 'win', peek: false, tiles: [64, 65, 66, 67, 37, 38, 39, 68, 40, 41, 69, 42] }],
  hand: { clock: 36, spare: 1, routeTest: 'long', baits: [{ at: 1, take: [64], why: 'open the short side' }] },
};
