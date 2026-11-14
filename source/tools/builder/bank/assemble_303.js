#!/usr/bin/env node
'use strict';
/* Levels 303 and up, first cut (Dennis 2026-11-14, lab 9: "make these traps with AHA and more chains in 300+ ... the most heavy chains
   like these past 300"): Codex's chained boards with new wrong ideas (chained-v1, tails gentle: a hard trap gets a light part after it)
   carry the range, with the earlier chain boards of batch 303-313 (known wrong ideas, tray pressure B) in between as lighter levels.
   lookalikeCoverThaw is left out ("a little too extreme ... make this like the very end levels").
     node source/tools/builder/bank/assemble_303.js   -> source/analysis/builder/bank/placed-303/level-<n>.json + placed.md */
const fs = require('fs'), path = require('path');
const BANK = path.resolve(__dirname, '../../../analysis/builder/bank'), OUT = path.join(BANK, 'placed-303'), GENTLE = path.resolve(__dirname, '../../../build/traps/chained-gentle');
const E = require('../engine.js'), { expert } = require('./feel.js');
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
// shapes from the one Dennis found easiest to the hardest (his tries in lab 9: waitThawWay 1, waitNested 1, lookalikeThaw 2, roofThawKey 4)
const ORDER = ['waitThawWay', 'waitNested', 'waitThawKey', 'lookalikeThaw', 'lookalikeCover', 'lookalikeWay', 'roofThawKey', 'waitLookalikeRoof', 'waitLookalikeWay'];
const X = path.join(BANK, 'chained-v1/examples'), byShape = {};
for (const f of fs.readdirSync(X).filter(f => /-L\d+-s\d+-p\d+\.json$/.test(f))) {
  const shape = f.split('-')[0]; if (!ORDER.includes(shape)) continue;
  const g = path.join(GENTLE, f), j = rd(fs.existsSync(g) ? g : path.join(X, f));
  (byShape[shape] = byShape[shape] || []).push({ src: 'chained ' + f.replace('.json', ''), what: j.card.trapType || shape, shape, layout: j.brief.layout, design: j.design, gentle: fs.existsSync(g) });
}
// two rounds over the shapes; inside a round, pick the copy whose layout differs from the board before it
const C = []; let last = -1;
for (let round = 0; round < 2; round++) for (const s of ORDER) { const v = byShape[s]; if (!v || !v.length) continue; let k = v.findIndex(b => b.layout !== last); if (k < 0) k = 0; const b = v.splice(k, 1)[0]; C.push(b); last = b.layout; }
const M = []; let big = null;
for (let n = 303; n <= 313; n++) { const j = rd(path.join(BANK, 'pressure-B-250-313', `level-${n}.json`)); const b = { src: 'batch2 ' + n, what: 'chain, known wrong idea', design: j.design }; if (j.design.tiles.length === 96) big = b; else M.push(b); }
const seq = [...C.map((b, i) => [(i + 0.5) / C.length, b]), ...M.map((b, i) => [(i + 0.75) / M.length, b])].sort((a, b) => a[0] - b[0]).map(x => x[1]);
if (big) seq.splice(310 - 303, 0, big);
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const rows = [];
seq.forEach((b, i) => {
  const n = 303 + i, d = b.design; if (!E.replay(d, d.solution, { strict: true }).ok) throw new Error('replay ' + b.src);
  const r = expert(d, { playouts: 16, wrong: false }), pp = +(r.parkAt[1] + r.parkAt[2]).toFixed(1);
  fs.writeFileSync(path.join(OUT, `level-${n}.json`), JSON.stringify({ level: n, source: b.src, design: d }));
  rows.push(`| ${n} | ${b.src} | ${b.layout ?? ''} | ${d.tiles.length} | ${b.what} | ${pp} |`);
});
fs.writeFileSync(path.join(OUT, 'placed.md'), `# Levels 303-${302 + seq.length}: chained traps with new wrong ideas, earlier chain boards in between\n\n| level | source | layout | tiles | trap | pressure parks after the trap |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
console.log(rows.join('\n'));
