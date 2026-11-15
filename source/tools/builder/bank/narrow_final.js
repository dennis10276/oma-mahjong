#!/usr/bin/env node
'use strict';
/* narrow_final.js: one list of what levels 251-299 become at about 60 px (Dennis 2026-11-15: "Do 3 and search for more ways to narrow
   it without changing too much", "No towers", "keep everthing as symetrical as possible", at most six wide; Codex's placement work).
   Per level, in this order:
     tens (250 ... 300): as released;
     already 58 px or more and at most eight rows: as released;
     a certified completion (placement-lab/completed/level-<n>.json, status passed): narrowed;
     a certified Task 19 draft (narrow/level-<n>.json) that moved at most two tiles onto the pile (no tower): narrowed;
     otherwise as released.
   Every narrowed board is checked again here, independently of the tool that made it: same pictures, specials, face-down tiles and
   clock number; strict replay of its stored route; the engine's shortest clock route equal to the released one; no special tile
   face-down; footprint at least 58 px and at most eight rows; at most six tiles wide (Dennis's own layouts excepted).
     node source/tools/builder/bank/narrow_final.js   ->   source/analysis/builder/footprint60/narrow-final/pack.json + README.md */
const fs = require('fs'), path = require('path');
const E = require('../engine.js'), F = require('../footprint.js');
const BANK = path.resolve(__dirname, '../../../analysis/builder/footprint60'), OUT = path.join(BANK, 'narrow-final');
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8')), same = (a, b) => JSON.stringify(a) === JSON.stringify(b), clone = x => JSON.parse(JSON.stringify(x));
const R = rd(path.join(BANK, 'range-250-300.json'));
const dims = t => { const xs = t.map(p => p[0]), ys = t.map(p => p[1]); return { w: (Math.max(...xs) - Math.min(...xs) + 2) / 2, h: (Math.max(...ys) - Math.min(...ys) + 2) / 2, layers: Math.max(...t.map(p => p[2])) + 1 }; };
const mirror = t => { const xs = t.map(p => p[0]), m = Math.min(...xs) + Math.max(...xs), s = new Set(t.map(p => p.join(','))); return +(t.filter(p => s.has([m - p[0], p[1], p[2]].join(','))).length / t.length).toFixed(2); };
// Dennis 2026-11-15: "The check shouldnt require the same pictures only the pictures that interconnect with the trap", "6.5 is okay",
// dropping finish tiles allowed. For a board with the same tiles: pictures of trap tiles (and every copy of their pictures) unchanged,
// the same pictures overall. For a board with dropped tiles (peel_drop.js, which compares the trap through its tile map): its own record.
function check(a, d, own, trap) {
  const why = [], dropped = d.tiles.length !== a.tiles.length;
  if (!dropped) {
    for (const k of ['down', 'obst']) if (!same(a[k], d[k])) why.push('changed ' + k);
    if (d.clock.i !== a.clock.i) why.push('clock tile changed');
    const tf = new Set([...trap].map(i => a.faces[i]));
    if (!same(a.faces.slice().sort((x, y) => x - y), d.faces.slice().sort((x, y) => x - y))) why.push('picture counts changed');
    if (a.faces.some((f0, i) => f0 !== d.faces[i] && (trap.has(i) || tf.has(f0) || tf.has(d.faces[i])))) why.push('trap pictures changed');
  }
  if (d.clock.n !== a.clock.n) why.push('clock number changed');
  if (!E.replay(d, d.solution, { strict: true }).ok) why.push('stored route does not win');
  const k0 = E.clockShortest(E.game(clone(a)), { nodes: 800000, ms: 15000 }), k1 = E.clockShortest(E.game(clone(d)), { nodes: 800000, ms: 15000 });
  if (!k0 || !k1 || k0.unsure || k1.unsure || k0.k !== k1.k) why.push('shortest clock route ' + (k0 && k0.k) + ' -> ' + (k1 && k1.k));
  const sp = new Set([d.clock.i, ...d.obst.locks, ...d.obst.keys, ...Object.keys(d.obst.ice || {}).map(Number)]);
  if ((d.down || []).some(i => sp.has(i))) why.push('special face-down');
  const fp = F.measure(d, { minimum: 58 }); if (!fp.ok) why.push('footprint ' + fp.tilePx.toFixed(1) + ' px, ' + fp.rows + ' rows');
  const dm = dims(d.tiles); if (dm.w > 6.5) why.push(dm.w + ' wide'); if (dm.h > 8) why.push(dm.h + ' rows');
  return { ok: !why.length, why, fp, k: k1 && k1.k };
}
const rows = [], pack = { baselineCommit: R.baselineCommit, made: new Date().toISOString(), rows: [] };
for (let lv = 251; lv <= 299; lv++) {
  if (lv % 10 === 0) continue;
  const before = R.rows.find(r => r.level === lv).before, a = before.design, f0 = F.measure(a, { minimum: 58 }), d0 = dims(a.tiles);
  const row = { level: lv, source: before.source, released: { px: +f0.tilePx.toFixed(1), w: d0.w, h: d0.h, layers: d0.layers } };
  if (f0.ok) { row.outcome = 'as released (already ' + f0.tilePx.toFixed(1) + ' px)'; rows.push(row); continue; }
  const cands = [], trap = require('./narrow_proof.js').prepare(before).M;
  const cf = path.join(BANK, 'narrow/placement-lab/completed', `level-${lv}.json`);
  if (fs.existsSync(cf)) { const j = rd(cf); if (j.status === 'passed' && j.check && j.check.design) cands.push({ from: 'completion: ' + j.method, design: j.check.design, own: /Your complete layout/.test(j.method || ''), cert: j.check.certificate }); }
  const pf = path.join(BANK, 'peel-drop', `level-${lv}.json`);
  if (fs.existsSync(pf)) { const j = rd(pf); cands.push({ from: 'peel_drop: ' + j.how + ` (${j.moved || 0} slid, ${j.dropped} dropped, ${j.picturesExchanged} picture exchanges)`, design: j.design }); }
  const tf = path.join(BANK, 'narrow', `level-${lv}.json`);
  if (fs.existsSync(tf)) { const j = rd(tf), d = j.design; const capped = d.tiles.filter((p, i) => p[2] > a.tiles[i][2]).length; if (capped <= 2) cands.push({ from: 'Task 19: ' + (j.hop ? 'hop ' + j.hop : 'column/row out'), design: d }); }
  let done = false;
  for (const c of cands) {
    const r = check(a, c.design, c.own, trap);
    if (!r.ok) { (row.rejected = row.rejected || []).push(c.from.slice(0, 40) + ': ' + r.why.join(', ')); continue; }
    const dm = dims(c.design.tiles), moved = c.design.tiles.length === a.tiles.length ? c.design.tiles.filter((p, i) => !same(p, a.tiles[i])).length : (a.tiles.length - c.design.tiles.length) + ' dropped';
    Object.assign(row, { outcome: 'narrowed', from: c.from, px: +r.fp.tilePx.toFixed(1), w: dm.w, h: dm.h, layers: dm.layers, moved, mirror: mirror(c.design.tiles), tiles: c.design.tiles.length, keptClockRoute: c.design.tiles.length !== a.tiles.length || same(c.design.solution.slice(0, c.design.solution.indexOf(c.design.clock.i) + 1), a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1)) });
    pack.rows.push({ level: lv, ok: true, draft: { design: c.design }, footprint: r.fp, from: c.from, certificate: c.cert || null });
    done = true; break;
  }
  if (!done) row.outcome = 'as released (no certified narrow version)';
  rows.push(row);
  console.log(lv, row.outcome === 'narrowed' ? `narrowed ${row.released.px} -> ${row.px} px, ${row.w}x${row.h}, ${row.layers} layers, mirror ${row.mirror}; ${row.from.slice(0, 60)}` : row.outcome + (row.rejected ? ' | ' + row.rejected.join(' | ') : ''));
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'pack.json'), JSON.stringify(pack));
const n = rows.filter(r => r.outcome === 'narrowed').length, ok = rows.filter(r => /already/.test(r.outcome)).length;
fs.writeFileSync(path.join(OUT, 'README.md'), `# Levels 251-299 at about 60 px: what each level becomes\n\n${n} narrowed, ${ok} already large enough, ${rows.length - n - ok} stay as released. The tens (250-300) stay as released.\nMade by \`tools/builder/bank/narrow_final.js\` from Codex's placement completions and Task 19 drafts; every narrowed board re-checked there.\nNothing is released.\n\n| level | outcome | tile px | width x rows | layers | tiles moved | mirror | how |\n|---|---|---|---|---|---|---|---|\n` +
  rows.map(r => r.outcome === 'narrowed' ? `| ${r.level} | narrowed | ${r.released.px} -> ${r.px} | ${r.released.w}x${r.released.h} -> ${r.w}x${r.h} | ${r.released.layers} -> ${r.layers} | ${r.moved} | ${r.mirror} | ${r.from} |` : `| ${r.level} | ${r.outcome} | ${r.released.px} | ${r.released.w}x${r.released.h} | ${r.released.layers} | | | ${(r.rejected || []).join('; ')} |`).join('\n') + '\n');
console.log(`narrowed ${n}, already ${ok}, as released ${rows.length - n - ok}`);
