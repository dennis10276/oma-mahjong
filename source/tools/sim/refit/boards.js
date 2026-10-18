/* The boards real players actually got: a designed level from the table of the app version they
   played (tables/levels-<version>.js, read with that version's own hard.js), or a classic level made
   the way the game makes it for their screen shape. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { tableVersion } = require('./board_versions.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const layoutContext = { module: { exports: {} }, Date: { now: () => 0 } };
vm.createContext(layoutContext);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'www', 'layouts.js'), 'utf8'), layoutContext);
const L = layoutContext.module.exports;
const TABLES = process.env.TABLES || path.join(__dirname, 'tables');
const ctxs = {};
function tableCtx(v) {
  v = tableVersion(v);
  if (ctxs[v]) return ctxs[v];
  const f = path.join(TABLES, `levels-${v}.js`), h = path.join(TABLES, `hard-${v}.js`);
  if (!fs.existsSync(f) || !fs.existsSync(h)) return (ctxs[v] = null);
  const ctx = { console, Layouts: L }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(h, 'utf8').replace("typeof module !== 'undefined'", 'false') + ';this.Hard = Hard;', ctx);
  vm.runInContext(fs.readFileSync(f, 'utf8') + ';this.HL = HARD_LEVELS;', ctx);
  const early = path.join(TABLES, `early-${v}.js`);
  if (fs.existsSync(early)) vm.runInContext(fs.readFileSync(early, 'utf8'), ctx);
  return (ctxs[v] = ctx);
}
const rulesOf = (tiles, ob) => ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
// a game for the test player from a designed level
function designed(v, lv) {
  const c = tableCtx(v); if (!c) return null;
  const d = lv >= c.HL.from ? c.Hard.get(lv) : tableVersion(v) === '1.55' && c.Hard.appliesEarly(lv, '') ? c.Hard.earlySpec(lv).made : null;
  if (!d) return null;
  const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), n = tiles.length;
  const down = new Uint8Array(n); d.down.forEach(i => down[i] = 1);
  return { key: `t${v}:${lv}`, tiles, nb, faces: d.faces, down, rules: rulesOf(tiles, d.obst), clock: d.clock || null };
}
// a classic level as board.js + specials.js make it (normal track)
function classic(lv, aspect) {
  const spec = L.forLevel(lv, aspect, 1, ''), d = L.makeDeal(spec), tiles = spec.tiles, nb = L.neighbors(tiles), n = tiles.length;
  const r = L.rng(spec.seed + 555); let gold = [];
  if (lv >= 20) { const anyF = d.faces.filter(f => f < 100); const f = anyF[Math.floor(r() * anyF.length)]; gold = d.faces.map((x, i) => x === f ? i : -1).filter(i => i >= 0).slice(0, 2); }
  const ob = lv >= L.MECH.ice ? L.obstacles(tiles, d.faces, { level: lv, seed: spec.seed, avoid: new Set([...(d.down || []), ...gold]), ez: 0 }) : null;
  const down = new Uint8Array(n); (d.down || []).forEach(i => down[i] = 1);
  return { key: `c${aspect}:${lv}`, tiles, nb, faces: d.faces, down, rules: rulesOf(tiles, ob), clock: null };
}
module.exports = { designed, classic, L, tableOf: tableCtx };
