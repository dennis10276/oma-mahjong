/* Level factory: put a batch on the game's own curve (Claude, 2026-10-31). Dennis: "the difficulty curve
   should stay the same from before"; "make more easy/middle and the hard ones keep for 300 or so".
   Each level gets the difficulty class of the live level it replaces (g2.1 expectedTries, curve-live-g21.jsonl):
   easy 1-1.6, normal 1.6-2.8, tricky 2.8-4.2, peak 4.2-6 (the live 8s become peaks; harder boards wait).
   Rules: big boards (more than 88 tiles) on every 10th level and only there; no base shape twice within 10
   levels; tile spots shared <= 75% with any level within 10 (and the live levels before the batch);
   neighbours preferably use different puzzles, no puzzle more than MAXR (7) times; critic warnings count against a board.
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
const inv = rd(invFile).filter(r => r.g2 && r.g2.exp <= +(process.env.MAX_EXP || 6));
const tilesOf = r => r.design.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]);
for (const r of inv) { r._t = tilesOf(r); r._s = F.spots(r._t)[0]; r._base = r.shape.split(' · ')[0]; r._big = r._t.length > 88; r._class = classOf(r.g2.exp); r._recipe = r.recipe.join('+'); }
const before = {}; for (let lv = from - 10; lv < from; lv++) before[lv] = F.spots(Hard.get(lv).tiles)[0];
const levels = []; for (let lv = from; lv <= to; lv++) levels.push(lv);
// CURVE='start,slope[,jumpAt,jump]' (Dennis 2026-10-31: no copying of the old curve's ups and downs: pick it up
// at 175 at the hardest judged level of 150-175 (155: 3.85) and keep getting harder; 200 a small jump, 201 on
// from there). TARGET_AT='{"190":2.3}' sets single levels (190: a big breather is fine). Without CURVE: the
// class of the live level, as before.
const CURVE = process.env.CURVE ? process.env.CURVE.split(',').map(Number) : null, AT = JSON.parse(process.env.TARGET_AT || '{}');
const target = lv => AT[lv] != null ? AT[lv] : CURVE ? CURVE[0] + CURVE[1] * (lv - from) + (CURVE[2] && lv >= CURVE[2] ? CURVE[3] : 0) : Math.min(5.5, live[lv]);
const cost = (r, lv) => (CURVE ? 0 : r._class === classOf(target(lv)) ? 0 : 3) + Math.abs(r.g2.exp - target(lv)) + ((r.critic && r.critic.flags && r.critic.flags.length) ? 1.5 : 0) + (r.idle && r.idle.length ? 3 : 0);
// (fast: every pair checked once; a lower bound on what the remaining levels can still cost)
const N = inv.length, compat = inv.map(() => new Uint8Array(N));
for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
  const okp = inv[a]._base !== inv[b]._base && F.share(inv[a]._t, inv[b]._s) <= 0.75 && F.share(inv[b]._t, inv[a]._s) <= 0.75;
  compat[a][b] = compat[b][a] = okp ? 1 : 0;
}
const fitsBefore = inv.map(r => levels.map(lv => Object.entries(before).every(([blv, s]) => lv - blv > 10 || F.share(r._t, s) <= 0.75)));
const C = inv.map(r => levels.map(lv => cost(r, lv)));
const minRest = levels.map((_, k) => levels.slice(k).reduce((a, __, m) => a + Math.min(...inv.map((r, i) => (r._big === (levels[k + m] % 10 === 0) ? C[i][k + m] : 99))), 0));
const pick = [], used = new Uint8Array(N), perRecipe = {}, MAXR = +(process.env.MAXR || 7), MONO = +(process.env.MONO || 0);   // (no puzzle more than MAXR times: variety)
let nodes = 0, best = null;
function ok(i, k) {
  const lv = levels[k], r = inv[i];
  if (r._big !== (lv % 10 === 0) || !fitsBefore[i][k]) return false;
  for (let j = Math.max(0, k - 10); j < k; j++) if (!compat[i][pick[j]]) return false;
  return true;
}
function dfs(k, total) {
  if (++nodes > 2000000) return;
  if (best && total + (k < levels.length ? minRest[k] : 0) >= best.total) return;
  if (k === levels.length) { best = { total, pick: pick.slice() }; return; }
  const cands = [];
  // MONO: harder and harder (Dennis): a level easier than the one before costs MONO per try (not around the
  // levels set by TARGET_AT, e.g. the big breather on 190, nor at a curve jump)
  const prevExp = k ? inv[pick[k - 1]].g2.exp : null, free = k === 0 || AT[levels[k]] != null || AT[levels[k - 1]] != null || (CURVE && CURVE[2] === levels[k]);
  for (let i = 0; i < N; i++) if (!used[i] && (perRecipe[inv[i]._recipe] || 0) < MAXR && ok(i, k)) cands.push([i, C[i][k] + (k && inv[pick[k - 1]]._recipe === inv[i]._recipe ? 1.5 : 0) + (free ? 0 : MONO * Math.max(0, prevExp - inv[i].g2.exp))]);
  cands.sort((a, b) => a[1] - b[1]);
  for (const [i, c] of cands.slice(0, 6)) { const rc = inv[i]._recipe; used[i] = 1; pick[k] = i; perRecipe[rc] = (perRecipe[rc] || 0) + 1; dfs(k + 1, total + c); perRecipe[rc]--; used[i] = 0; }
}
dfs(0, 0);
if (best) best.pick = best.pick.map(i => inv[i]);
if (!best) { console.log('no arrangement found (' + nodes + ' tried)'); process.exit(1); }
const rows = best.pick.map((r, k) => { const lv = levels[k]; const { _t, _s, _base, _big, _class, _recipe, ...rest } = r;
  return { ...rest, builtAs: r.builtAs || r.level, level: lv, liveExp: live[lv], cls: _class, design: { ...r.design, level: lv } }; });
for (const r of rows) console.log(r.level, String(+target(r.level).toFixed(2)).padEnd(5), '->', String(r.g2.exp).padEnd(5), r.cls.padEnd(7), r.recipe.join('+').padEnd(26), r.shape, r.critic && r.critic.flags && r.critic.flags.length ? '(' + r.critic.flags.join(', ') + ')' : '');
console.log('cost', best.total.toFixed(2), 'searched', nodes);
if (out) fs.writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
