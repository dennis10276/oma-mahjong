/* Level factory: lay a batch on a smooth curve (Claude, 2026-10-31). The depth-first solver (assign_curve.js)
   only looks a few boards deep and, on a flat curve with few boards near it, ends with easier levels after
   harder ones. Dennis: "the curve should get harder and harder". This one anneals: start from the pool
   sorted by difficulty, then swap boards in and out and between levels, keeping a move when the total gets
   better (and sometimes when not, to get out of dead ends). Total per level: |tries - curve| + MONO per try
   that a level is easier than the one before + same puzzle as the level before + idle specials / critic
   warnings; rule breaks (big board off every 10th level, base shape twice within 10 levels, more than 75%
   shared tile spots within 10 levels or with the live levels before the batch) cost 100 each.
     CURVE=start,slope[,jumpAt,jump] TARGET_AT='{"190":2.3}' node assign_anneal.js <from> <to> <inventory.jsonl> [out]  */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js')); global.Layouts = L;
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const Hard = require(path.join(ROOT, 'www', 'hard.js')), F = require('./piles_for.js');
const [from, to, invFile, out] = [+process.argv[2], +process.argv[3], process.argv[4], process.argv[5]];
const rd = f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const CURVE = (process.env.CURVE || '3.85,0.0212,200,0.5').split(',').map(Number), AT = JSON.parse(process.env.TARGET_AT || '{}');
const MONO = +(process.env.MONO || 1.5), MAXR = +(process.env.MAXR || 7), MAX_EXP = +(process.env.MAX_EXP || 6);
const target = lv => AT[lv] != null ? AT[lv] : CURVE[0] + CURVE[1] * (lv - from) + (CURVE[2] && lv >= CURVE[2] ? CURVE[3] : 0);
// Dennis 2026-11-01, after playing 176, 189 and 193 (all 'Don't grab the clock'): "too loose is no pass level
// from now on. The clock is just free to take and no reason for it to be there." So a board with Gemini's
// clockTooLoose flag (critic3, from plan_g2 with CRITIC_BOT) or built with dontGrab never goes into a batch.
const banned = r => (r.critic3 || []).includes('clockTooLoose') || (r.recipe || []).includes('dontGrab');
const inv = rd(invFile).filter(r => r.g2 && r.g2.exp <= MAX_EXP && !banned(r));
for (const r of inv) { r._t = r.design.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]); r._s = F.spots(r._t)[0]; r._base = r.shape.split(' · ')[0]; r._big = r._t.length > 88; r._recipe = r.recipe.join('+'); }
const N = inv.length, levels = []; for (let lv = from; lv <= to; lv++) levels.push(lv);
const K = levels.length;
const compat = inv.map(() => new Uint8Array(N));
for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) compat[a][b] = compat[b][a] = inv[a]._base !== inv[b]._base && F.share(inv[a]._t, inv[b]._s) <= 0.75 && F.share(inv[b]._t, inv[a]._s) <= 0.75 ? 1 : 0;
const before = []; for (let lv = from - 10; lv < from; lv++) before.push([lv, F.spots(Hard.get(lv).tiles)[0]]);
const fitsBefore = inv.map(r => levels.map(lv => before.every(([blv, s]) => lv - blv > 10 || F.share(r._t, s) <= 0.75)));
const warn = r => ((r.critic && r.critic.flags && r.critic.flags.length) ? 1.5 : 0) + (r.idle && r.idle.length ? 3 : 0);
function total(p) {
  let c = 0; const per = {};
  for (let k = 0; k < K; k++) {
    const r = inv[p[k]], lv = levels[k];
    c += Math.abs(r.g2.exp - target(lv)) + warn(r);
    if (r._big !== (lv % 10 === 0)) c += 100;
    if (!fitsBefore[p[k]][k]) c += 100;
    for (let j = Math.max(0, k - 10); j < k; j++) if (!compat[p[k]][p[j]]) c += 100;
    if (k) {
      const prev = inv[p[k - 1]];
      if (prev._recipe === r._recipe) c += 1.5;
      const free = AT[lv] != null || AT[levels[k - 1]] != null || (CURVE[2] && CURVE[2] === lv);
      if (!free) c += MONO * Math.max(0, prev.g2.exp - r.g2.exp);
    }
    per[r._recipe] = (per[r._recipe] || 0) + 1;
  }
  for (const v of Object.values(per)) if (v > MAXR) c += 20 * (v - MAXR);
  return c;
}
// start: for every level the closest unused board of the right size, then sorted within the normal levels
const rng = L.rng(+(process.env.SEED || 1));
let best = null;
for (let restart = 0; restart < +(process.env.RESTARTS || 6); restart++) {
  const used = new Set(), p = [];
  for (let k = 0; k < K; k++) {
    const lv = levels[k], big = lv % 10 === 0;
    let bi = -1, bc = 1e9;
    for (let i = 0; i < N; i++) if (!used.has(i) && inv[i]._big === big) { const c = Math.abs(inv[i].g2.exp - target(lv)) + warn(inv[i]) + rng() * 0.6; if (c < bc) { bc = c; bi = i; } }
    p.push(bi); used.add(bi);
  }
  let cur = total(p), T = 3;
  for (let step = 0; step < +(process.env.STEPS || 60000); step++, T *= 0.99993) {
    const q = p.slice(), k = Math.floor(rng() * K);
    if (rng() < 0.5) { const j = Math.floor(rng() * K); if (inv[q[j]]._big !== inv[q[k]]._big) continue; [q[k], q[j]] = [q[j], q[k]]; }
    else { const i = Math.floor(rng() * N); if (q.includes(i) || inv[i]._big !== inv[q[k]]._big) continue; q[k] = i; }
    const c = total(q);
    if (c < cur || rng() < Math.exp((cur - c) / T)) { p.splice(0, K, ...q); cur = c; }
  }
  if (!best || cur < best.cost) best = { cost: cur, p: p.slice() };
}
const rows = best.p.map((i, k) => { const r = inv[i], lv = levels[k]; const { _t, _s, _base, _big, _recipe, ...rest } = r;
  return { ...rest, builtAs: r.builtAs || r.level, level: lv, target: +target(lv).toFixed(2), design: { ...r.design, level: lv } }; });
for (const r of rows) console.log(r.level, String(r.target).padEnd(5), '->', String(r.g2.exp).padEnd(5), r.recipe.join('+').padEnd(26), r.shape, r.design.tiles.length > 88 ? '(big)' : '', (r.idle && r.idle.length) ? 'IDLE ' + r.idle.join(',') : '', (r.critic && r.critic.flags && r.critic.flags.length) ? '(' + r.critic.flags.join(', ') + ')' : '');
console.log('cost', best.cost.toFixed(2), best.cost >= 100 ? 'RULES BROKEN' : 'all rules kept');
if (out && best.cost < 100) fs.writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
