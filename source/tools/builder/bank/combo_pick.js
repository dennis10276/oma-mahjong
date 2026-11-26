#!/usr/bin/env node
'use strict';
/* Pick 21 boards for 350-370 from combo-350 (eval*.json + checked/). Rules (Dennis 2026-11-16): ordinary 72-88 tiles, >= 58 px,
   <= 8 rows; tens (350/360/370) 96 tiles, >= 53.5 px (layouts under 58 px only there); no towers; certified finish pressure;
   every combination once (a combination = its set of wrong ideas + base gates); a layout not again within 8 levels and
   never the same main idea on two levels in a row; ordered by trap strength (ideas, links, tempting wrong moves that lose).
     node source/tools/builder/bank/combo_pick.js  ->  combo-350/picked/level-<n>.json + picked.md */
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const arg = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const DIR = path.resolve(arg('--bank') ?? path.join(__dirname, '../../../analysis/builder/bank/combo-350'));
const checked = path.resolve(arg('--checked') ?? path.join(DIR, 'checked'));
const outArg = arg('--output'), OUT = path.resolve(outArg ?? path.join(DIR, 'picked'));
const ledger = require('./ledger');
const footprint = require('../footprint');
const profiles = require('../chained_finish_profiles');
const historyFile = arg('--history');
const history = historyFile ? JSON.parse(fs.readFileSync(historyFile, 'utf8')).map(r => ({
  n: r.level, layout: ledger.signature(r.design, r.card),
})) : [];
const ev = {}; for (const f of fs.readdirSync(DIR).filter(f => /^eval(-\d+)?\.json$/.test(f))) Object.assign(ev, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const signature = new Map();
const rows = Object.values(ev).filter(r => {
  const file = path.join(checked, r.file);
  if (!r.routeOk || r.straight || !fs.existsSync(file)) return false;
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { design, card } = record;
  const DT = require('./detower.js');
  if (design.tiles.some((tile, i) => !DT.supportedAt(design.tiles, tile, i))) return false;
  if (historyFile || card.finishVerification || r.finishProfile) {
    const finish = card.finishVerification;
    const brief = { targets: { ordinaryTileFloor: true, bigTileFloor: true, requireSupportedLayout: true } };
    if (!finish || !record.verification?.ok || !profiles.check(record, card.feel, card.tail)
        || !profiles.check(record, finish.independent, card.tail)
        || !footprint.measureForBuild(design, brief).ok || footprint.layoutFailure(design, brief)) return false;
    r.finishProfile = card.finishProfile;
    r.finishReady = true;
  }
  const layout = ledger.signature(design, card);
  signature.set(r.file, layout);
  return !history.some(prior => prior.layout.trap === layout.trap && ledger.sameLayout(prior.layout, layout));
});
const baseOf = f => f.replace(/-L\d+-s\d+(?:-p\d+)?\.json$/, '');
const strength = r => (r.ideas || []).length * 10 + (r.links || 0) * 3 + Math.min(r.biting, 14) + r.trapMoments * .5;
const ok = r => (r.finishProfile ? r.finishReady && !r.edge : r.pressure >= 1.3 && r.pressure <= 3) && r.biting >= 5;
const big = rows.filter(r => r.tiles === 96 && r.px >= 53.5 && ok(r)), ord = rows.filter(r => r.tiles >= 72 && r.tiles <= 88 && r.px >= 58 && r.rows <= 8 && ok(r));
const key = r => [...(r.ideas || [])].sort().join('+') + '|' + baseOf(r.file).split(/[+_]/)[0];
const tens = big.slice().sort((a, b) => strength(b) - strength(a));
const ordinary = ord.slice().sort((a, b) => strength(a) - strength(b));
const slots = [...Array(21).keys()].map(i => 350 + i), seq = [];
const fits = (r, at) => { const layout = signature.get(r.file), prev = seq.find(s => s.n === at - 1);
  const near = !history.some(s => Math.abs(s.n - at) <= 8 && ledger.sameLayout(s.layout, layout))
    && !seq.some(s => Math.abs(s.n - at) <= 8 && ledger.sameLayout(signature.get(s.r.file), layout));
  return near && !(prev && (prev.r.ideas || []).slice().sort().join() === (r.ideas || []).slice().sort().join()); };
// Try layout and idea alternatives at every slot, including tens. Prefer the
// longest consecutive prefix so the result can be exported without gaps.
let best = null, bestPrefix = -1, rs = 7;
const rnd = () => (rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let attempt = 0; attempt < 3000 && !(best && best.length === 21); attempt++) {
  seq.length = 0;
  const ordered = pool => pool.map((r,i) => ({r,w:i+(attempt ? rnd()*6 : 0)})).sort((a,b)=>a.w-b.w).map(x=>x.r);
  const ordLeft = ordered(ordinary), tensLeft = ordered(tens), used = new Set(), perLayout = new Map();
  for (const n of slots) {
    const options = n % 10 === 0 ? tensLeft : ordLeft;
    const r = options.find(r => !used.has(key(r)) && (perLayout.get(r.layout) ?? 0) < 2 && fits(r, n));
    if (!r) continue;
    seq.push({n,r}); used.add(key(r)); perLayout.set(r.layout,(perLayout.get(r.layout)??0)+1);
  }
  const firstGap = slots.findIndex((n,i) => seq[i]?.n !== n);
  const prefix = firstGap < 0 ? slots.length : firstGap;
  if (!best || prefix > bestPrefix || (prefix === bestPrefix && seq.length > best.length)) {
    best = seq.slice(); bestPrefix = prefix;
  }
}
seq.length = 0; seq.push(...best);
if (outArg) fs.mkdirSync(OUT);
else { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); }
const md = ['| level | combination | ideas | links | layout | tiles | px | rows | mirror | k / spare | tempting wrong moves that lose | trap moments | pressure |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const { n, r } of seq) {
  const j = JSON.parse(fs.readFileSync(path.join(checked, r.file), 'utf8'));
  fs.writeFileSync(path.join(OUT, `level-${n}.json`), JSON.stringify({ level: n, source: 'combo ' + baseOf(r.file), idea: (r.ideas || []).join('+'), layout: r.layout, eval: r, design: j.design }));
  md.push(`| ${n} | ${baseOf(r.file)} | ${(r.ideas || []).join(' + ')} | ${r.links} | ${r.layout} | ${r.tiles} | ${r.px} | ${r.rows} | ${r.mirror} | ${r.k} / ${r.spare} | ${r.biting} | ${r.trapMoments} | ${r.pressure} |`);
}
const gaps = slots.filter(n => !seq.some(pick => pick.n === n));
fs.writeFileSync(path.join(outArg ? OUT : DIR, 'picked.md'), `# 350-370 picks (${seq.length})\n\nCandidates: ${ord.length} ordinary, ${big.length} tens after the rules; ${new Set(ord.map(key)).size} different combinations.\n\nUnfilled slots: ${gaps.join(', ') || 'none'}.\n\n` + md.join('\n') + '\n');
console.log(md.join('\n')); console.log('candidates', ord.length, big.length, 'combinations', new Set(ord.map(key)).size);
