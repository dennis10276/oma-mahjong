/* Level factory: put a batch on the game's own curve (Claude, 2026-10-31). Dennis: "the difficulty curve
   should stay the same from before"; "make more easy/middle and the hard ones keep for 300 or so".
   Each level gets the difficulty class of the live level it replaces (g2.1 expectedTries, curve-live-g21.jsonl):
   easy 1-1.6, normal 1.6-2.8, tricky 2.8-4.2, peak 4.2-6 (the live 8s become peaks; harder boards wait).
   Rules: big boards (more than 88 tiles) on every 10th level and only there; no base shape twice within 10
   levels; tile spots shared <= 75% with any level within 10 (and the live levels before the batch);
   neighbours preferably use different puzzles; critic warnings count against a board.
     node source/tools/factory/assign_curve.js <from> <to> <inventory.jsonl> <out.jsonl>               */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js')); global.Layouts = L;
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const Hard = require(path.join(ROOT, 'www', 'hard.js')), F = require('./piles_for.js');
const [from, to, invFile, out] = [+process.argv[2], +process.argv[3], process.argv[4], process.argv[5]];
const rd = f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const live = Object.fromEntries(rd(path.join(ROOT, 'analysis', 'factory', 'curve-live-g21.jsonl')).map(r => [r.level, r.exp]));
const CLASSES = [['easy', 1, 1.6], ['normal', 1.6, 2.8], ['tricky', 2.8, 4.2], ['peak', 4.2, 6]];
const classOf = e => (CLASSES.find(([, a, b]) => e <= b) || CLASSES[3])[0];
const inv = rd(invFile).filter(r => r.g2 && r.g2.exp <= 6);
const tilesOf = r => r.design.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]);
for (const r of inv) { r._t = tilesOf(r); r._s = F.spots(r._t)[0]; r._base = r.shape.split(' · ')[0]; r._big = r._t.length > 88; r._class = classOf(r.g2.exp); r._recipe = r.recipe.join('+'); }
const before = {}; for (let lv = from - 10; lv < from; lv++) before[lv] = F.spots(Hard.get(lv).tiles)[0];
const levels = []; for (let lv = from; lv <= to; lv++) levels.push(lv);
const target = lv => Math.min(5.5, live[lv]);
const cost = (r, lv) => (r._class === classOf(target(lv)) ? 0 : 3) + Math.abs(r.g2.exp - target(lv)) + ((r.critic && r.critic.flags && r.critic.flags.length) ? 1.5 : 0);
const pick = [], used = new Set();
let nodes = 0, best = null;
function ok(r, k) {
  const lv = levels[k];
  if (r._big !== (lv % 10 === 0)) return false;
  for (let j = Math.max(0, k - 10); j < k; j++) { const o = pick[j]; if (o._base === r._base || F.share(r._t, o._s) > 0.75) return false; }
  for (const [blv, s] of Object.entries(before)) if (lv - blv <= 10 && F.share(r._t, s) > 0.75) return false;
  return true;
}
function dfs(k, total) {
  if (++nodes > 400000) return;
  if (best && total >= best.total) return;
  if (k === levels.length) { best = { total, pick: pick.slice() }; return; }
  const lv = levels[k];
  const cands = inv.filter(r => !used.has(r)).map(r => [r, cost(r, lv) + (k && pick[k - 1]._recipe === r._recipe ? 0.8 : 0)]).sort((a, b) => a[1] - b[1]).slice(0, 8);
  for (const [r, c] of cands) { if (!ok(r, k)) continue; used.add(r); pick[k] = r; dfs(k + 1, total + c); used.delete(r); }
}
dfs(0, 0);
if (!best) { console.log('no arrangement found (' + nodes + ' tried)'); process.exit(1); }
const rows = best.pick.map((r, k) => { const lv = levels[k]; const { _t, _s, _base, _big, _class, _recipe, ...rest } = r;
  return { ...rest, builtAs: r.builtAs || r.level, level: lv, liveExp: live[lv], cls: _class, design: { ...r.design, level: lv } }; });
for (const r of rows) console.log(r.level, String(r.liveExp).padEnd(5), '->', String(r.g2.exp).padEnd(5), r.cls.padEnd(7), r.recipe.join('+').padEnd(26), r.shape, r.critic && r.critic.flags && r.critic.flags.length ? '(' + r.critic.flags.join(', ') + ')' : '');
console.log('cost', best.total.toFixed(2), 'searched', nodes);
if (out) fs.writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
