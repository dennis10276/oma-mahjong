// Buried B9 "The escape is too slow" (layout 3109 "Shelf"). The clock C in the bottom row of a buried pyramid band at the top; a field
// below. The left way (L0, L2) is short but its
// tiles fill the tray at L2 - and L2's twin is the face-down tile FD in the field under two tiles: the escape. It works, but costs three
// moves the clock does not have. One plain tile at the right moment keeps the tray from filling instead.
// Wrong paths: the left with the escape; the left without; the long right side.
const U = require('./band_util.js'), lay = 3109, n = U.named(lay), at = (x, y, z) => U.at(lay, x, y, z);
const keys = [at(8, 7, 2), at(9, 7, 1), at(6, 7, 2), at(7, 7, 1)], K1 = at(9, 7, 1), K2 = at(7, 7, 1);
const left = [at(2, 2, 2), at(4, 2, 2), at(6, 2, 2), at(1, 3, 1), at(3, 3, 1), at(5, 3, 1), n.L0, n.L2];
const right = [at(8, 2, 2), at(7, 3, 1), at(9, 3, 1), at(10, 4, 0), at(8, 4, 0), n.R6];
const field = U.where(lay, t => t[1] >= 6 && t[1] <= 8 && t[2] > 0), esc = [n.U, at(1, 11, 1), n.FD];
module.exports = {
  id: 'b9', title: 'The escape is too slow (buried)',
  idea: 'The short way fills the tray, and a face-down twin in the field is ready to save it - but digging it out costs three moves the clock does not have. One plain tile at the right moment keeps the tray from filling.',
  layout: lay, block: [...new Set([...left, ...right, ...field, ...esc])], target: n.C, limit: 11,
  fixed: { [n.FD]: 'E', [n.L2]: 'E', [n.U]: 'u', [at(1, 11, 1)]: 'u' }, down: [n.FD], inside: [5, 8],   // the two tiles over the escape are twins: digging it out costs moves, not slots
  tests: [{ name: 'all', expect: 'win', peek: false },
    { name: 'leftNoHelp', expect: 'none', tiles: [...left, ...esc] },
    { name: 'leftEscape', expect: 'win', tiles: [...left, ...esc], limit: 14, peekForced: true }],
  hand: { clock: n.C, spare: 1, routeTest: 'all', downTiles: [n.FD], baits: [] },
};
