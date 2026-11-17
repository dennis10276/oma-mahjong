// Family F4 "The clock closes the pair" (layout 1011). The clock 14 is the left bridge tile: reach it from the left tower (via 13) or from
// the right tower (via 16, 15). The left tower's top tile 67 has the clock's picture: taken first, it waits all the way down - it looks
// like the side to avoid. But at the end the clock matches it and needs no slot; the right side ends with the tray full and the clock a 4th.
module.exports = {
  id: 'f4', title: 'The clock closes the pair',
  idea: 'The tower over the clock starts with the clock\'s own picture, so that tile waits all the way down - it looks like the wrong side. But the clock itself closes that pair at the end; the other side leaves no room for the clock.',
  layout: 1011, block: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 66, 68, 70, 58, 54, 56, 35, 43, 31, 41, 17, 16, 15], target: 14, limit: 15,
  fixed: { 14: 'CT', 67: 'CT' }, inside: [5, 10],
  tests: [{ name: 'all', expect: 'win', peek: false }, { name: 'right', expect: 'none', peek: false, tiles: [66, 68, 70, 58, 54, 56, 35, 43, 31, 41, 17, 16, 15, 69, 71, 57] }],
  hand: { clock: 14, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [66], why: 'start on the side without the clock\'s picture' }] },
};
