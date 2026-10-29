/* Level factory, step 2 by the bot (Claude, 2026-10-29). Dennis played batch 1 (tuned to the calibrated
   test players): all three "too easy". His rule: tune to Codex's strong human-information bot; a level
   the bot clears on its first try is too easy, the more tries it needs the harder. So:
   1. the game's designer deals each pile many times; the calibrated Dennis test player only sorts the
      deals (hardest first) and drops hopeless ones;
   2. the bot (wip/personal-bots measure(), seeing only what a person sees, remembering earlier tries)
      plays salt 1; a deal is kept only if it needs at least MIN tries there, then salts 2 and 3:
      every run must clear within MAX tries (a way out a person can find), the average must reach the
      level's aim, and at most one run may win on the first try.
   Aim: average bot tries from 2.0 at level 175 to 3.0 at 270 (to be tuned by Dennis's verdicts).
     node source/tools/factory/design_bot.js <piles.json> <out.jsonl> <measure.js> [levels]          */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js')); global.Layouts = L;
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const RULES0 = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'js', 'rules.js'), 'utf8') + ';RULES', {});
global.RULES = { hard: { ...RULES0.hard, minTile: 52, minTileBig: 52 } };
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const { rate } = require('./design.js');

const DEALS = +(process.env.DEALS || 12), MIN = 2, MAX = 6, SALTS = [1, 2, 3];
const aim = lv => 2 + Math.min(1, Math.max(0, (lv - 175) / 95));
const D = 'Dennisisdebeste', M = 'Mrs. Doubtfire';

const [pilesFile, outFile, measurePath, only] = process.argv.slice(2);
const { measure } = require(path.resolve(measurePath));
const want = only ? only.split(',').map(Number) : null;
const piles = JSON.parse(fs.readFileSync(pilesFile, 'utf8')).filter(p => !want || want.includes(p.level));
const cacheDir = outFile + '.cache'; fs.mkdirSync(cacheDir, { recursive: true });
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).level) : []);
const boardOf = d => ({ tiles: d.tiles, faces: d.faces, down: d.down, obst: d.obst, clock: d.clock });
const play = (d, salts) => { try { return measure(boardOf(d), { salts, maxTries: MAX }); } catch (e) { return { triesPerSalt: salts.map(() => null), error: String(e).slice(0, 160) }; } };

for (const p of piles) {
  if (done.has(p.level)) continue;
  const lv = p.level, t0 = Date.now(), tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
  // deals (kept between runs: the slow part is the bot)
  const cf = path.join(cacheDir, lv + '.json');
  const cache = fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : { deals: [], tried: {} };
  for (let salt = cache.deals.length; salt < DEALS; salt++) {
    const d = Hard.makeNow(lv, 1.6, 1, salt, { tiles });
    if (!d.solution || !d.clock) { cache.deals.push(null); continue; }
    d.q = rate(d, D, 200, 7001 + salt);
    cache.deals.push(d); fs.writeFileSync(cf, JSON.stringify(cache));
  }
  const order = cache.deals.map((d, k) => [d, k]).filter(([d]) => d && d.q.first >= 0.03).sort((a, b) => a[0].q.first - b[0].q.first);
  let row = null;
  for (const [d, k] of order) {
    if (cache.tried[k]) continue;
    const m1 = play(d, [SALTS[0]]), t1 = m1.triesPerSalt[0];
    let verdict = t1 === null ? 'no clear' : t1 < MIN ? 'too easy' : null, all = [t1], m = m1;
    if (!verdict) {
      const m23 = play(d, SALTS.slice(1)); all = [t1, ...m23.triesPerSalt]; m = { ...m23, lossTypes: { ...m1.lossTypes } };
      for (const [t, c] of Object.entries(m23.lossTypes || {})) m.lossTypes[t] = (m.lossTypes[t] || 0) + c;
      m.slowestMove = Math.max(m1.slowestMove || 0, m23.slowestMove || 0);
      const avg = all.reduce((a, b) => a + (b || 0), 0) / all.length;
      verdict = all.some(x => x === null) ? 'no clear' : all.filter(x => x === 1).length > 1 ? 'too easy' : avg < aim(lv) - 0.34 ? 'too easy' : 'ok';
    }
    cache.tried[k] = { bot: all, verdict }; fs.writeFileSync(cf, JSON.stringify(cache));
    console.log(lv, 'deal', k, 'test player', d.q.first, 'bot', all.join('/'), verdict);
    if (verdict !== 'ok') continue;
    const qd = rate(d, D, 600, 31001 + lv), qm = rate(d, M, 600, 41001 + lv);
    row = { level: lv, shape: p.shape, n: d.tiles.length, px: p.px, shared: p.shared, aim: aim(lv), deal: k, ok: true,
      bot: all, botAvg: +(all.reduce((a, b) => a + b, 0) / all.length).toFixed(2), botLoss: m.lossTypes, slowestMs: Math.round(m.slowestMove || 0),
      dennis: qd, mrsD: qm, down: d.down.length, ice: Object.keys((d.obst || {}).ice || {}).length, locks: ((d.obst || {}).locks || []).length,
      clock: d.clock.n, clockSpare: d.clock.n - (d.solution.indexOf(d.clock.i) + 1), s: Math.round((Date.now() - t0) / 1000),
      design: { v: d.v, level: lv, aspect: 1.6, tiles: d.tiles, faces: d.faces, down: d.down, gold: d.gold, obst: d.obst, clock: d.clock, solution: d.solution, info: { rate: qm.first, strong: qd.first } } };
    break;
  }
  if (!row && order.every(([, k]) => cache.tried[k])) row = { level: lv, ok: false, shape: p.shape, tried: cache.tried };
  if (row) { fs.appendFileSync(outFile, JSON.stringify(row) + '\n'); console.log(lv, row.ok ? 'KEPT bot ' + row.bot.join('/') : 'NONE'); }
}
