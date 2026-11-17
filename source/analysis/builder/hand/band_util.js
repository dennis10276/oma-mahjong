// helpers for the buried band boards (b8-b11): tile ids by coordinates on a custom layout
const L = require('./layouts-custom.json');
const at = (lay, x, y, z) => L[lay].tiles.findIndex(t => t[0] === x && t[1] === y && t[2] === z);
const where = (lay, f) => L[lay].tiles.map((t, i) => [t, i]).filter(([t]) => f(t)).map(([, i]) => i);
module.exports = { at, where, named: lay => L[lay].named };
