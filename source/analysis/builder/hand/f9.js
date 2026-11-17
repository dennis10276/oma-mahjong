// Family F9 "The bridge melts from both ends" (layout 1011). The clock 14 (left bridge tile) is frozen 2, and its only ice neighbours
// are its bridge partners 13 (under the left tower) and 15 (freed from the right tower via 16). So both towers must come down - and
// their tiles are twins across the towers: digging one tower first fills the tray. Dig both towers in step.
module.exports = {
  id: 'f9', title: 'The bridge melts from both ends',
  idea: 'The frozen clock melts only when both its bridge partners are gone, one under each tower. The towers\' tiles are twins of each other: dig one tower first and the tray fills - dig both in step.',
  layout: 1011, block: [69, 67, 71, 55, 57, 40, 59, 42, 12, 30, 34, 13, 66, 68, 70, 58, 54, 56, 35, 43, 31, 41, 17, 16, 15], target: 14, limit: 25,
  ice: { 14: 2 }, inside: [9, 12],
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'leftFirst', expect: 'none', peek: false, gone: [69, 67, 55, 59], goneFaces: true }],
  hand: { clock: 14, spare: 1, routeTest: 'all', baits: [{ at: 1, take: [67], why: 'dig one tower first' }] },
};
