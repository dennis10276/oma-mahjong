/* Pile shape catalogue (Dennis, 2026-10-24): pile shapes without towers, tiles at least 54 px, for Dennis
   to pick from by look (difficulty plays no part). The game's 17 shapes, the 14 added for the variety
   work, random outlines, the shapes of the lab levels of 2026-10-23, and some variations in height
   (flat, tall), islands and stepped ridges. Writes tools/lab/shapes-data.js (SHAPES_DATA).
     node source/tools/lab/shapes.js                                                                 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js'));
global.Layouts = L; global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'analysis', 'levels-before-variety.js'), 'utf8') + ';HARD_LEVELS');
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const { pile, SHAPE_NAMES } = require(path.join(ROOT, 'tools', 'sim', 'variety', 'piles.js'));
const tilePx = tiles => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; for (const t of tiles) { const x = t.x / 2 - t.z * 0.14, y = t.y / 2 * 1.24 - t.z * 0.14; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + 1.24); } return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16)); };
const towers = t => { const k = new Set(t.map(p => p.x + ',' + p.y + ',' + p.z)); return t.some(p => p.z > 0 && k.has(p.x + ',' + p.y + ',' + (p.z - 1))); };
const norm = t => { const mx = Math.min(...t.map(a => a[0])), my = Math.min(...t.map(a => a[1])); return t.map(([x, y, z]) => [x - mx, y - my, z]); };
const mir = t => { const w = Math.max(...t.map(a => a[0])); return t.map(([x, y, z]) => [w - x, y, z]); };
const spots = t => [new Set(norm(t).map(a => a.join())), new Set(norm(mir(t)).map(a => a.join()))];
const ov = (a, b) => { let c = 0; for (const k of a) if (b.has(k)) c++; return c / Math.max(a.size, b.size); };
const played = []; for (let lv = 70; lv < 158; lv++) played.push(spots(Hard.get(lv).tiles)[0]);
const like = t => { const s = spots(t); return Math.max(...played.map(q => Math.max(ov(s[0], q), ov(s[1], q)))); };
function best(shape, o, N = 86) {
  let b = null;
  for (const ly of o.layers) for (const bf of o.base) for (const aspect of [1.6, 1.3, 2, 1.1]) for (const brick of [false, true]) for (let s = 0; s < 3; s++) {
    const p = pile({ shape, seed: 7001 + s * 31 + ly * 7 + Math.round(bf * 100), target: N, layers: ly, aspect, baseFrac: bf, stack: 0, keep: o.keep || [0.55, 0.8], twin: o.twin ?? 0.35, brick });
    if (!p || Math.abs(p.tiles.length - N) > 4 || p.tiles.length % 2 || tilePx(p.tiles) < 54 || towers(p.tiles)) continue;
    const t = p.tiles.map(q => [q.x, q.y, q.z]), lk = like(t);
    if (o.twinOnly && !p.twin) continue;
    if (!b || lk < b.like) b = { tiles: t, like: lk, layers: Math.max(...t.map(a => a[2])) + 1 };
  }
  return b;
}
// a shape that does not fit 86 tiles at 54 px without towers is tried with 72 (shown as such)
const items = [], add = (name, group, shape, o) => { let b = best(shape, o), n = 86; if (!b) { b = best(shape, o, 72); n = 72; } if (b) items.push({ name, group, shape, n: b.tiles.length, small: n === 72, ...b }); else console.log('no pile for', name); };
const NEW = ['ring', 'star', 'wave', 'steps', 'twins', 'arrow', 'moon', 'plus', 'xshape', 'tshape', 'ushape', 'chevron', 'kite', 'castle'];
for (const s of SHAPE_NAMES) add(s, NEW.includes(s) ? 'added for variety' : "the game's shapes", s, { layers: [3, 4, 5, 6], base: [undefined, 0.3, 0.36, 0.42, 0.5] });
// today's lab levels (2026-10-23)
const lab = ['blob11554', 'blob11739', 'blob9112', 'blob9667', 'blob9704', 'blob10000', 'blob10222', 'blob11221'];
for (const s of lab) add(s, 'lab levels', s, { layers: [3, 4, 5, 6], base: [undefined, 0.3, 0.36, 0.42, 0.5] });
// random outlines (other seeds)
for (let k = 0; k < 8; k++) add('blob' + (31001 + k * 977), 'random outlines', 'blob' + (31001 + k * 977), { layers: [3, 4, 5, 6], base: [undefined, 0.3, 0.36, 0.42, 0.5] });
// height and structure variations of a few shapes
for (const s of ['diamond', 'heart', 'ring', 'xshape']) add(s + ' · flat', 'flat (2-3 layers)', s, { layers: [2, 3], base: [undefined, 0.55, 0.65, 0.75] });
for (const s of ['pyramid', 'octagon', 'moon', 'plus']) add(s + ' · tall', 'tall (5-6 layers)', s, { layers: [6, 5, 7], base: [undefined, 0.22, 0.26, 0.3] });
for (const s of ['block', 'oval', 'castle', 'wave']) add(s + ' · two islands', 'two hills', s, { layers: [3, 4, 5], base: [undefined, 0.34, 0.42, 0.5], twin: 1, twinOnly: true });
for (const s of ['bowtie', 'steps', 'hourglass']) add(s + ' · ridges', 'stepped ridges', s, { layers: [3, 4, 5], base: [undefined, 0.36, 0.42, 0.5], keep: [0.8, 0.95] });
fs.writeFileSync(path.join(__dirname, 'shapes-data.js'), '/* made by tools/lab/shapes.js */\nconst SHAPES_DATA = ' + JSON.stringify({ made: new Date().toISOString(), items }) + ';\n');
console.log(items.length, 'shapes');
