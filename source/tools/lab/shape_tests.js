/* Look tests (Dennis, 2026-10-24): pile shapes that do not fit 86 tiles at 54 px without towers, made with
   smaller tiles, as playable lab levels for Dennis to judge on his phone (is it nice, is it still easy to
   tap). The game's designer puts pictures and specials on them as on any level near 200; difficulty is not
   tuned. Writes tools/lab/ideas-out/<id>.json; then `node ideas.js merge <first id>` and build the lab.
     node source/tools/lab/shape_tests.js <first id> <shape:px> ...                                    */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js'));
global.Layouts = L; global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'analysis', 'levels-before-variety.js'), 'utf8') + ';HARD_LEVELS');
global.RULES = { hard: { rounds: 4, deals: 4, steps: 4 } };
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const { pile } = require(path.join(ROOT, 'tools', 'sim', 'variety', 'piles.js'));
const tilePx = tiles => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; for (const t of tiles) { const x = t.x / 2 - t.z * 0.14, y = t.y / 2 * 1.24 - t.z * 0.14; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + 1.24); } return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16)); };
const towers = t => { const k = new Set(t.map(p => p.x + ',' + p.y + ',' + p.z)); return t.some(p => p.z > 0 && k.has(p.x + ',' + p.y + ',' + (p.z - 1))); };
const gameG = b => { const tiles = b.tiles.map(([x, y, z]) => ({ x, y, z })), o = b.obst; const rules = o && (Object.keys(o.ice || {}).length || (o.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: o.ice || {}, locks: (o.keys || []).length ? new Set(o.locks) : null, keys: o.keys || [] } : null; return { tiles, nb: L.neighbors(tiles), faces: b.faces, rules, clock: b.clock }; };
const valid = b => Hard.validSolution(gameG(b), b.solution);
let id = +process.argv[2];
for (const spec of process.argv.slice(3)) {
  const [shape, pxs] = spec.split(':'), px = +pxs;
  let best = null;
  // the biggest tiles that still fit, at least px (and below 54: these shapes do not fit at 54)
  for (const ly of [3, 4, 5, 6]) for (const bf of [undefined, 0.3, 0.36, 0.42, 0.5, 0.6]) for (const aspect of [1.6, 1.3, 2, 1.1]) for (const brick of [false, true]) for (let s = 0; s < 3; s++) {
    const p = pile({ shape, seed: 9001 + s * 31 + ly * 7, target: 86, layers: ly, aspect, baseFrac: bf, stack: 0, keep: [0.55, 0.8], twin: 0.35, brick });
    if (!p || Math.abs(p.tiles.length - 86) > 4 || p.tiles.length % 2 || towers(p.tiles)) continue;
    const t = tilePx(p.tiles); if (t < px) continue;
    if (!best || Math.abs(t - px) < Math.abs(best.px - px)) best = { tiles: p.tiles, px: t };
  }
  if (!best) { console.log('no pile for', spec); id++; continue; }
  let d = null; for (let k = 0; k < 4 && !d; k++) { const x = Hard.makeNow(201, 1.6, 1, id * 10 + k, { tiles: best.tiles }); if (x.solution && valid(x)) d = x; }
  if (!d) { console.log('no board for', spec); id++; continue; }
  const board = { tiles: d.tiles, faces: d.faces, down: d.down, gold: d.gold || [], obst: d.obst || { ice: {}, locks: [], keys: [] }, clock: d.clock, solution: d.solution };
  const out = { id, kind: 'shapeTest', level: 'look', title: `${shape} · tiles about ${Math.round(best.px)} px`, idea: `Look test: is this pile shape nice, and are the tiles still big enough to see and tap? (Today's levels use at least 54 px.) The difficulty is not tuned.`, shape, tiles: board.tiles.length, px: +best.px.toFixed(1), board, m: null,
    specials: { down: board.down.length, ice: Object.keys(board.obst.ice || {}).length, locks: (board.obst.locks || []).length, clockSpare: board.clock ? board.clock.n - (board.solution.indexOf(board.clock.i) + 1) : null } };
  fs.writeFileSync(path.join(__dirname, 'ideas-out', id + '.json'), JSON.stringify(out));
  console.log(`idea ${id}: ${shape}, ${board.tiles.length} tiles, tiles ${best.px.toFixed(1)} px`);
  id++;
}
