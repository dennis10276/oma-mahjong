#!/usr/bin/env node
'use strict';
/* One sequence from level 250 up, after Dennis's verdicts of 2026-11-14 (labs 9, 10 and Codex's lab on 8265):
   - 250-264: the chain boards we already had (two known wrong ideas, tray pressure B) and the older boards he liked;
   - 265-302: those thinned out, with the easier new-idea chains in between ("can easily sit in the <300 range", "puzzle for 290s",
     "around 275", "early introducing chains");
   - 303 and up: only chains of four with a new wrong idea, from the ones he solved in two or three tries to the ones that took five
     to seven ("300+ approved", "place it 325+"); known-idea chains do not go past 302.
   Boards he judged get the place he named. Left out: lookalikeCoverThaw L18/L36 ("too extreme": far end), waitLookalikeWay-L7 ("too easy,
   not even an AHA"), lookalikeWay-L13 (he got stuck: held), outsideIn / clearLockRoof ("no AHA", "not hard enough to spot") and the four
   new kinds nobody has played yet.
   No repeats: a layout not within 8 levels, never the same shape or the same kind of wrong idea on two levels in a row.
     node source/tools/builder/bank/assemble_all.js  ->  source/analysis/builder/bank/placed-all/level-<n>.json + placed.md */
const fs = require('fs'), path = require('path');
const BANK = path.resolve(__dirname, '../../../analysis/builder/bank'), OUT = path.join(BANK, 'placed-all');
const E = require('../engine.js'), { expert } = require('./feel.js');
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const items = [];
// ---- what we already had: 250-302 as placed (B) + batch 2 (303-313, B)
const batchCard = n => { for (const s of ['', 'rejected/']) { const f = path.join(BANK, 'batch-250-289', s + `level-${n}.json`); if (fs.existsSync(f)) return rd(f).card; } return null; };
const old = [];
for (let n = 250; n <= 302; n++) {
  const j = rd(path.join(BANK, 'placed-250-B', `level-${n}.json`)), m = /^batch (\d+)/.exec(j.source), c = m ? batchCard(m[1]) : null;
  old.push({ src: j.source, design: j.design, was: n, chain: !!m, layout: c ? c.layout : null, shape: c ? c.shape : j.source, idea: c ? 'known:' + c.trap.baits.map(b => b.name).sort().join('+') : 'older' });
}
for (let n = 303; n <= 313; n++) { const j = rd(path.join(BANK, 'pressure-B-250-313', `level-${n}.json`)), c = rd(path.join(BANK, 'batch-303-342', `level-${n}.json`)).card; old.push({ src: 'batch2 ' + n, design: j.design, was: n, chain: true, layout: c.layout, shape: c.shape, idea: 'known:' + c.trap.baits.map(b => b.name).sort().join('+') }); }
const first = old.filter(b => b.was < 265);                                   // 250-264 stay
const rest = old.filter(b => b.was >= 265), keepOlder = rest.filter(b => !b.chain), chains = rest.filter(b => b.chain && b.design.tiles.length !== 96), big = old.filter(b => b.was >= 265 && b.design.tiles.length === 96);
const NEW_BELOW = 17, slotsOld = (302 - 265 + 1) - NEW_BELOW, wantChains = slotsOld - keepOlder.length - 3 - 3;   // three 96-tile boards on 270, 280, 290
const picked = []; for (let i = 0; i < wantChains; i++) picked.push(chains[Math.round(i * (chains.length - 1) / (wantChains - 1))]);
first.forEach((b, i) => items.push({ ...b, target: 250 + i, fixed: 250 + i }));
[...keepOlder, ...picked].sort((a, b) => a.was - b.was).forEach((b, i, a) => items.push({ ...b, target: 265 + i * (302 - 265) / (a.length - 1) }));
big.slice(0, 3).forEach((b, i) => items.push({ ...b, target: 270 + 10 * i, fixed: 270 + 10 * i }));
// ---- the new-idea chains (Codex): v1 with the lightened tails where made, v2
const TIER = { waitThawKey: 1, waitThawWay: 1, waitNested: 1, lookalikeCover: 2, waitLookalikeRoof: 2, lookalikeThaw: 2, lookalikeCoverThaw: 2.5, roofThawKey: 3, lookalikeWay: 3, waitLookalikeWay: 4 };
const SKIP = new Set(['lookalikeCoverThaw-L18-s4-p1', 'lookalikeCoverThaw-L36-s3-p1', 'waitLookalikeWay-L7-s11-p1', 'waitLookalikeWay-L7-s12-p2', 'lookalikeWay-L13-s12-p2']);
// the place Dennis named for a board he played: [from, to]
const PIN = { 'waitThawKey-L4-s11-p1': [274, 277], 'lookalikeCover-L17-s12-p2': [279, 283], 'waitThawKey-L14-s2-p2': [284, 288], 'lookalikeCover-L31-s1-p1': [291, 295], 'waitLookalikeRoof-L18-s5-p1': [295, 299],
  'lookalikeCoverThaw-L12-s12-p2': [299, 302], 'roofThawKey-L18-s4-p1': [303, 320], 'roofThawKey-L23-s12-p2': [303, 320], 'lookalikeWay-L14-s3-p1': [305, 330], 'waitLookalikeRoof-L14-s5-p2': [303, 315], 'waitLookalikeWay-L31-s5-p1': [325, 345] };
const fresh = [], seen = new Set();
const addNew = (id, j) => { const shape = id.split('-')[0]; if (!(shape in TIER) || SKIP.has(id) || seen.has(id)) return; seen.add(id);
  const ideas = [/^wait/.test(shape) && 'waitForTwin', /ookalike/.test(shape) && 'lookalikeChoice', shape === 'roofThawKey' && 'clockRoof'].filter(Boolean); fresh.push({ id, src: 'chained ' + id, design: j.design, layout: j.brief ? j.brief.layout : j.card.layout, shape, tier: TIER[shape], idea: 'new:' + (ideas.sort().join('+') || shape), spare: j.card.clock.spare, pin: PIN[id] || null }); };
for (const [dir, alt] of [['chained-v1/examples', 'chained-gentle'], ['chained-v2/examples', null]]) for (const f of fs.readdirSync(path.join(BANK, dir)).filter(f => /-L\d+-s\d+-p\d+\.json$/.test(f)).sort()) {
  const g = alt && path.join(BANK, alt, f); addNew(f.replace('.json', ''), rd(g && fs.existsSync(g) ? g : path.join(BANK, dir, f)));
}
{ // the lookalikeCoverThaw board he played in Codex's lab (4 stars, "290-310") is stored in the lab file only
  const t = fs.readFileSync(path.join(BANK, 'chained-v2/lab-ideas-original.js'), 'utf8'), L = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)), sel = rd(path.join(BANK, 'chained-v2/lab-selection-original.json'));
  const rows = sel.boards || sel.selection || sel, k = rows.findIndex(r => r.file === 'lookalikeCoverThaw-L12-s12-p2.json'), idea = L.ideas[k];
  if (idea) fresh.push({ id: 'lookalikeCoverThaw-L12-s12-p2', src: 'chained lookalikeCoverThaw-L12-s12-p2', design: idea.board, layout: 12, shape: 'lookalikeCoverThaw', tier: 2.5, idea: 'new:lookalikeChoice', spare: 2, pin: PIN['lookalikeCoverThaw-L12-s12-p2'] });
}
// below 303: the pinned ones plus easy ones on other layouts (not two of a shape close together); the other tier-1 boards stay in reserve
const below = fresh.filter(b => b.pin && b.pin[1] < 303); const lay = new Set(below.map(b => b.layout));
const t1 = fresh.filter(b => b.tier === 1 && !b.pin && !lay.has(b.layout)), t2 = fresh.filter(b => b.tier === 2 && !b.pin && !lay.has(b.layout));
const take = (list, n, shapes) => { const out = []; let s = 0; while (out.length < n && list.length) { const sh = shapes[s++ % shapes.length], i = list.findIndex(b => b.shape === sh && !lay.has(b.layout)); if (i >= 0) { const b = list.splice(i, 1)[0]; lay.add(b.layout); out.push(b); } if (s > 60) break; } return out; };
const e1 = take(t1, 7, ['waitThawWay', 'waitNested', 'waitThawKey']), e2 = take(t2, NEW_BELOW - below.length - 7, ['lookalikeThaw', 'waitLookalikeRoof', 'lookalikeCover']);
below.forEach(b => items.push({ ...b, target: (b.pin[0] + b.pin[1]) / 2 }));
e1.forEach((b, i) => items.push({ ...b, target: 266 + i * 3.6 }));
e2.forEach((b, i) => items.push({ ...b, target: 283 + i * 3.4 }));
const used = new Set([...below, ...e1, ...e2].map(b => b.id));
// 303 and up: tier 2 and 2.5 first, tier 3 rising in, tier 4 from 325
const above = fresh.filter(b => !used.has(b.id) && b.tier >= 2).sort((a, b) => a.tier - b.tier || b.spare - a.spare);
above.forEach((b, i) => { const base = b.tier === 2 ? 303 + i * 1.6 : b.tier === 2.5 ? 306 + (i % 2) * 8 : b.tier === 3 ? 304 : 325; b.t0 = base; });
{ const t3 = above.filter(b => b.tier === 3), t4 = above.filter(b => b.tier === 4), t2b = above.filter(b => b.tier === 2);
  const end = 303 + above.length - 1;
  t2b.forEach((b, i) => { b.target = 303 + i * (end - 8 - 303) / Math.max(1, t2b.length - 1) * 0.75; });
  t3.forEach((b, i) => { b.target = 304 + i * (end - 304) / Math.max(1, t3.length - 1); });
  t4.forEach((b, i) => { b.target = 326 + i * (end - 326) / Math.max(1, t4.length - 1); });
  above.filter(b => b.tier === 2.5).forEach((b, i) => { b.target = 307 + i * 9; });
  above.forEach(b => { if (b.pin) b.target = Math.min(b.pin[1], Math.max(b.pin[0], b.target)); items.push(b); }); }
// ---- order: by target, then keep layouts, shapes and kinds of wrong idea apart
const total = items.length, fixed = new Map(items.filter(b => b.fixed).map(b => [b.fixed, b]));
let pool = items.filter(b => !b.fixed).sort((a, b) => a.target - b.target); const seq = [];
for (let n = 250; n < 250 + total; n++) {
  if (fixed.has(n)) { seq.push(fixed.get(n)); continue; }
  const prev = seq[seq.length - 1], recent = seq.slice(-8).map(b => b.layout).filter(x => x != null);
  const ok = b => !(b.layout != null && recent.includes(b.layout)) && !(prev && (prev.shape === b.shape || (prev.idea === b.idea && b.idea !== 'older'))) && !(b.pin && n < b.pin[0]) && !(n % 10 === 0) === !(b.design.tiles.length === 96 && n % 10 === 0);
  let k = pool.findIndex(b => b.pin && n >= b.pin[1]);                       // a pinned board that must go now
  if (k < 0) k = pool.slice(0, 14).findIndex(ok);
  if (k < 0) k = pool.slice(0, 7).findIndex(b => !(b.pin && n < b.pin[0]) && !(prev && prev.shape === b.shape));
  if (k < 0) k = 0;
  seq.push(pool.splice(k, 1)[0]);
}
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const rows = [];
seq.forEach((b, i) => {
  const n = 250 + i, d = b.design; if (!E.replay(d, d.solution, { strict: true }).ok) throw new Error('replay ' + b.src);
  const r = expert(d, { playouts: 10, wrong: false });
  fs.writeFileSync(path.join(OUT, `level-${n}.json`), JSON.stringify({ level: n, source: b.src, idea: b.idea, shape: b.shape, layout: b.layout, design: d }));
  rows.push(`| ${n} | ${b.src} | ${b.layout ?? ''} | ${d.tiles.length} | ${b.idea} | ${(r.parkAt[1] + r.parkAt[2]).toFixed(1)} | ${b.pin ? 'placed where Dennis said' : ''} |`);
});
fs.writeFileSync(path.join(OUT, 'placed.md'), `# Levels 250-${249 + total}\n\n| level | source | layout | tiles | wrong idea | pressure parks after the trap | |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\nReserve (not placed): ${fresh.filter(b => !used.has(b.id) && b.tier === 1).map(b => b.id).join(', ')}\n`);
console.log(rows.join('\n')); console.log('levels', total, 'reserve tier 1:', fresh.filter(b => !used.has(b.id) && b.tier === 1).length);
