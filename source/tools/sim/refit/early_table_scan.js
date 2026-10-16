/* How hard each ready-made early level (main's www/levels-early.js) is for the test players.
     node early_table_scan.js [levels-early.js] > early-table.json */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const file = process.argv[2] || '/home/claude/repo-oma/source/www/levels-early.js';
const T = vm.runInNewContext(fs.readFileSync(file, 'utf8') + ';EARLY_LEVELS');
const out = {};
for (let lv = T.from; lv < T.from + T.levels.length; lv++) {
  const d = Hard.unpack(lv, T.levels[lv - T.from]);
  const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), n = tiles.length, down = new Uint8Array(n); d.down.forEach(i => down[i] = 1);
  const ob = d.obst, rules = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: { ...(ob.ice || {}) }, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
  const g = { tiles, nb: L.neighbors(tiles), faces: d.faces.map(f => f === 63 ? 101 : f), down, rules, clock: null, gold: d.gold };
  out[lv] = Object.fromEntries(['strong', 'sensible', 'average'].map(k => [k, +Hard.rate(g, 200, 21, Hard.persona(k)).rate.toFixed(3)]));
  console.error(lv, JSON.stringify(out[lv]));
}
console.log(JSON.stringify(out));
