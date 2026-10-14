/* The levels exactly as the game makes them (board.js begin + specials.js), for the simulations. */
'use strict';
const L = require('../../www/layouts.js');
function game(level, aspect, opts = {}) {
  const spec = L.forLevel(level, aspect, 1, opts.track || '');
  const d = L.makeDeal(spec);
  const tiles = spec.tiles, nb = L.neighbors(tiles), n = tiles.length;
  // gold (only matters for where ice and locks may go)
  const r = L.rng(spec.seed + 555);
  let gold = [];
  if (level >= 20) { const anyF = d.faces.filter(f => f < 100); const f = anyF[Math.floor(r() * anyF.length)]; gold = d.faces.map((x, i) => x === f ? i : -1).filter(i => i >= 0).slice(0, 2); }
  let rules = null;
  if (level >= L.MECH.ice) {
    const ob = L.obstacles(tiles, d.faces, { level, seed: spec.seed, avoid: new Set([...(d.down || []), ...gold]), ez: 0 });
    if (ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length)) rules = { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] };
  }
  const down = new Uint8Array(n); (d.down || []).forEach(i => down[i] = 1);
  return { level, tiles, nb, faces: d.faces, down, rules, clock: null, oldBot: d.w, spec };
}
module.exports = { game, L };
