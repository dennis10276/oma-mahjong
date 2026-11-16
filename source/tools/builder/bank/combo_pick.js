#!/usr/bin/env node
'use strict';
/* Pick 21 boards for 350-370 from combo-350 (eval*.json + checked/). Rules (Dennis 2026-11-16): ordinary 72-88 tiles, >= 58 px,
   <= 8 rows; tens (350/360/370) 96 tiles, >= 53.5 px (layouts under 58 px only there); no towers; pressure after the trap ~2
   (1.3-3); every combination once (a combination = its set of wrong ideas + base gates); a layout not again within 8 levels and
   never the same main idea on two levels in a row; ordered by trap strength (ideas, links, tempting wrong moves that lose).
     node source/tools/builder/bank/combo_pick.js  ->  combo-350/picked/level-<n>.json + picked.md */
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../../../analysis/builder/bank/combo-350'), OUT = path.join(DIR, 'picked');
const ev = {}; for (const f of fs.readdirSync(DIR).filter(f => /^eval(-\d+)?\.json$/.test(f))) Object.assign(ev, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const rows = Object.values(ev).filter(r => fs.existsSync(path.join(DIR, 'checked', r.file)) && r.routeOk && !r.straight);
const baseOf = f => f.replace(/-L\d+-s\d+\.json$/, '');
const strength = r => (r.ideas || []).length * 10 + (r.links || 0) * 3 + Math.min(r.biting, 14) + r.trapMoments * .5;
const ok = r => r.pressure >= 1.3 && r.pressure <= 3 && r.biting >= 5;
const big = rows.filter(r => r.tiles === 96 && r.px >= 53.5 && ok(r)), ord = rows.filter(r => r.tiles >= 72 && r.tiles <= 88 && r.px >= 58 && r.rows <= 8 && ok(r));
const key = r => [...(r.ideas || [])].sort().join('+') + '|' + baseOf(r.file).split(/[+_]/)[0];
const pickBest = (pool, used) => { const by = new Map(); for (const r of pool) { const k = key(r); if (used.has(k)) continue; if (!by.has(k) || strength(r) > strength(by.get(k))) by.set(k, r); } return [...by.values()]; };
const used = new Set(), tens = pickBest(big, used).sort((a, b) => strength(a) - strength(b)).slice(-3); tens.forEach(r => used.add(key(r)));
// 18 ordinary boards: strongest first, one per combination, each layout at most twice; then ordered weakest -> strongest
// with a layout never again within 8 levels and the main idea changing from level to level (small backtracking search).
const cand = pickBest(ord, used).sort((a, b) => strength(b) - strength(a)), chosen = [], perLayout = {};
for (const r of cand) { if (chosen.length >= 18) break; if ((perLayout[r.layout] || 0) >= 2) continue; perLayout[r.layout] = (perLayout[r.layout] || 0) + 1; chosen.push(r); }
chosen.sort((a, b) => strength(a) - strength(b)); console.log("chosen", chosen.length, "tens", tens.length);
const slots = [...Array(21).keys()].map(i => 350 + i), seq = []; let steps = 0;
const fits = (r, at) => { const near = seq.filter(s => Math.abs(s.n - at) <= 8 && s.r.layout === r.layout).length === 0, prev = seq.find(s => s.n === at - 1);
  return near && !(prev && (prev.r.ideas || []).slice().sort().join() === (r.ideas || []).slice().sort().join()); };
// randomised greedy: walk the levels, take the weakest remaining board that fits (spacing, idea change); retry with small shuffles
let best = null; let rs = 7; const rnd = () => (rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let attempt = 0; attempt < 3000 && !(best && best.length === 21); attempt++) {
  seq.length = 0; let left = chosen.map((r, i) => ({ r, w: i + (attempt ? rnd() * 6 : 0) })).sort((a, b) => a.w - b.w).map(x => x.r);
  for (const n of slots) {
    if (n % 10 === 0) { const t = tens[[350, 360, 370].indexOf(n)]; if (t) seq.push({ n, r: t }); continue; }
    const k = left.findIndex(r => fits(r, n)); if (k < 0) continue; seq.push({ n, r: left[k] }); left.splice(k, 1);
  }
  if (!best || seq.length > best.length) best = seq.slice();
  if (best.length === 21) break;
}
seq.length = 0; seq.push(...best);
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const md = ['| level | combination | ideas | links | layout | tiles | px | rows | mirror | k / spare | tempting wrong moves that lose | trap moments | pressure |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const { n, r } of seq) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'checked', r.file), 'utf8'));
  fs.writeFileSync(path.join(OUT, `level-${n}.json`), JSON.stringify({ level: n, source: 'combo ' + baseOf(r.file), idea: (r.ideas || []).join('+'), layout: r.layout, eval: r, design: j.design }));
  md.push(`| ${n} | ${baseOf(r.file)} | ${(r.ideas || []).join(' + ')} | ${r.links} | ${r.layout} | ${r.tiles} | ${r.px} | ${r.rows} | ${r.mirror} | ${r.k} / ${r.spare} | ${r.biting} | ${r.trapMoments} | ${r.pressure} |`);
}
fs.writeFileSync(path.join(DIR, 'picked.md'), `# 350-370 picks (${seq.length})\n\nCandidates: ${ord.length} ordinary, ${big.length} tens after the rules; ${new Set(ord.map(key)).size} different combinations.\n\n` + md.join('\n') + '\n');
console.log(md.join('\n')); console.log('candidates', ord.length, big.length, 'combinations', new Set(ord.map(key)).size);
