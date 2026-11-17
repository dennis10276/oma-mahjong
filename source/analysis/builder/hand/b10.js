// Buried B10 "Don't rush the clock" (layout 3110 "Pier"). A small pyramid on top, a buried band at the bottom with the clock C in its
// middle row. The left way (L2, L0) is shorter and reaches the clock in time - with the tray full of tiles whose twins are buried: stuck
// right after the clock. The right way (R6, R8, R10) is longer and arrives with room. Wrong paths: the left; the left plus a helper.
const U = require('./band_util.js'), lay = 3110, n = U.named(lay);
const band = U.where(lay, t => (t[1] >= 7 && t[1] <= 9 && t[2] > 0) || (t[1] === 8 && t[2] === 0)), tops = U.where(lay, t => t[1] <= 4 && t[2] === 2);
const GK1 = U.at(lay, 1, 3, 1), GK2 = U.at(lay, 9, 1, 1), keyDig = [GK1, U.at(lay, 2, 2, 2), GK2, U.at(lay, 8, 2, 2)];
const left = band.filter(i => ![n.R6, n.R8, n.R10].includes(i) && !(U.named(lay) && require('./layouts-custom.json')[lay].tiles[i][0] >= 8));
module.exports = {
  id: 'b10', title: 'Don\'t rush the clock (buried)',
  idea: 'The short way reaches the clock in time - and leaves the tray full of tiles whose twins are buried: stuck right after. The long way arrives with room to go on.',
  layout: lay, block: [...band, ...keyDig], target: n.C, limit: 19, inside: [6, 9],
  fixed: { [GK1]: 'G', [GK2]: 'G' }, locks: [U.at(lay, 5, 7, 1)], keys: [GK1, GK2],   // + a gold chain: the clock's cover (5,7,1) is locked, keys in the top pyramid
  tests: [{ name: 'all', expect: 'win', peek: false, trayMax: 2 },
    { name: 'left', expect: 'win', peek: false, tiles: [...left, ...keyDig] },
    { name: 'leftAfter', expect: 'none', peek: false, trayMax: 2, tiles: [...left, ...keyDig, ...tops] }],
  hand: { clock: n.C, clockN: 19, routeTest: 'all', baits: [] },
  tailLose: { tiles: [...left, ...keyDig, ...tops], limit: 19 },   // the short way wins the clock and dies after it
};
