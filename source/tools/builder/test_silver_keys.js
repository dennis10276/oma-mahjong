'use strict';
// The silver key set in the builder engine: the fast context (Ctx.ok) must agree with the game's own rule (layouts.js takeable)
// on random boards with both sets, a silver key under a gold lock included; clockShortest's lower bound must stay admissible.
const E = require('./engine.js'), L = global.Layouts, assert = require('assert');
const pick = require('./builder.js').LAYOUTS;
let rng = 7; const r = n => ((rng = (rng * 1103515245 + 12345) >>> 0) % n);
let checks = 0;
for (let t = 0; t < 40; t++) {
  const lay = pick[r(40)], tiles = lay.tiles, n = tiles.length, faces = [...Array(n).keys()].map(i => i >> 1);
  const ids = [...Array(n).keys()].sort(() => r(3) - 1);
  const keys = [ids[0], ids[1]], keys2 = [ids[2], ids[3]];
  faces[keys[1]] = faces[keys[0]]; faces[keys2[1]] = faces[keys2[0]];
  const locks = [ids[4], ids[5], keys2[0]], locks2 = [ids[6], ids[7]];
  const d = { tiles, faces, down: [], obst: { ice: { [ids[8]]: 2 }, keys, locks, keys2, locks2 }, clock: null, solution: [] };
  const g = E.game(d);
  for (let s = 0; s < 30; s++) {
    const alive = Uint8Array.from({ length: n }, () => r(4) ? 1 : 0), st = { alive, tray: [], moves: 0, clockTaken: true };
    const C = new (E._Ctx || Object)(g, alive, [], 0);
    for (let i = 0; i < n; i++) {
      const ref = !!alive[i] && L.takeable(i, alive, g.nb, g.rules, new Uint8Array(n).fill(1));
      if (E._Ctx) assert.strictEqual(C.ok(i), ref, 'Ctx.ok vs rule, tile ' + i); checks++;
      assert.strictEqual(E.legal(g, st).includes(i), ref, 'legal vs rule');
    }
  }
}
console.log('silver keys: ' + checks + ' tile checks agree');
