// Family F7 "Trust the full tray" (layout 1000). The clock 8 gives no spare move. Twice on the way the dig must go up to three
// waiting tiles; each time the next dig tile matches one of them. Two free tiles far away (70, 61) are twins of waiting dig tiles:
// a cautious player clears the tray with them "to be safe" - one move the clock does not have. The full tray is safe here.
module.exports = {
  id: 'f7', title: 'Trust the full tray',
  idea: 'The tray goes to three twice, and that is fine: the next tile of the dig matches. Clearing the tray first with the free twins far away costs a move the clock does not have.',
  layout: 1000, block: [63, 67, 64, 59, 42, 40, 52, 48, 6, 7, 62, 66, 70, 61], target: 8, limit: 11,
  fixed: { 70: 'c1', 64: 'c1', 61: 'c2', 52: 'c2' }, inside: [2, 4],
  tests: [{ name: 'all', expect: 'win', peek: false }],
  hand: { clock: 8, spare: 0, routeTest: 'all', baits: [{ at: 'auto', take: [70], why: 'clear the tray with the free twin first' }] },
};
