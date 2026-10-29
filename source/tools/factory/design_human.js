/* Level factory, step 2 with the human-like bot (Claude, 2026-10-29). Batch 2 (tuned to the strong
   bot) was "too easy" where the strong bot struggled for no reason. Codex's human-v0 (measureHuman,
   'dennis' setting; built with Gemini's controller) passes Dennis's own factory games, so now:
   1. the game's designer deals each pile many times (deals are cached);
   2. human-v0 plays each deal 2 x 20 times (two seeds): kept near the aim for first-try wins, 50% at level 175
      sliding to 40% at 270 (Dennis 2026-10-28: about 50% for him, slowly harder), and the hard part
      not only at the end (late losses under 25%; Dennis on 184: "tiny part is the end");
      if no deal is close, the closest is tuned by swapping two pictures (the known way through stays
      valid); the final rate is measured again with 3 x 20 other games;
   3. the frozen strong bot (measure) must clear it within 6 tries in each of 3 runs: a way out.
     node source/tools/factory/design_human.js <piles.json> <out.jsonl> <human_bot.js> <measure.js> [levels]  */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js')); global.Layouts = L;
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const RULES0 = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'js', 'rules.js'), 'utf8') + ';RULES', {});
global.RULES = { hard: { ...RULES0.hard, minTile: 52, minTileBig: 52 } };
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const { game } = require('./design.js');

const DEALS = +(process.env.DEALS || 32), BAND = 0.10, SWAPS = 8, MAX = 6, SALTS = [1, 2, 3], LATE = 0.25;
const aim = lv => 0.50 - 0.10 * Math.min(1, Math.max(0, (lv - 175) / 95));
const [pilesFile, outFile, humanPath, measurePath, only] = process.argv.slice(2);
const { measureHuman } = require(path.resolve(humanPath)), { measure } = require(path.resolve(measurePath));
const want = only ? only.split(',').map(Number) : null;
const piles = JSON.parse(fs.readFileSync(pilesFile, 'utf8')).filter(p => !want || want.includes(p.level));
const cacheDir = outFile + '.cache'; fs.mkdirSync(cacheDir, { recursive: true });
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).level) : []);
const boardOf = d => ({ tiles: d.tiles, faces: d.faces, down: d.down, obst: d.obst, clock: d.clock });
// (games within one seed are not independent enough: the rate moves 0.2-0.45 between seeds on the
//  same deal, so every estimate pools several seeds of 20 games)
function human(d, runs, seed, seeds = 2) {
  let first = 0, late = 0, before = 0, mid = 0, slow = 0, version = null;
  try {
    for (let s = 0; s < seeds; s++) {
      const r = measureHuman(boardOf(d), { runs, setting: 'dennis', seed: seed + s * 7919 });
      first += r.firstTryRate / seeds; slow = Math.max(slow, r.slowestMove || 0); version = r.version;
      const ph = r.lossPhase || {}; late += (ph.late || 0) / seeds; before += (ph.beforeClock || 0) / seeds; mid += (ph.mid || 0) / seeds;
    }
  } catch (e) { return { first: null, error: String(e.message || e).slice(0, 160) }; }
  const r3 = x => +x.toFixed(3);
  return { first: r3(first), phase: { beforeClock: r3(before), mid: r3(mid), late: r3(late) }, slow, version, games: runs * seeds };
}
const late = h => (h.phase && h.phase.late) || 0;
const fits = (h, a) => h.first !== null && Math.abs(h.first - a) <= BAND && late(h) < LATE;

for (const p of piles) {
  if (done.has(p.level)) continue;
  const lv = p.level, a = aim(lv), t0 = Date.now(), tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
  const cf = path.join(cacheDir, lv + '.json');
  const cache = fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : { deals: [] };
  for (let salt = cache.deals.length; salt < DEALS; salt++) {
    const d = Hard.makeNow(lv, 1.6, 1, salt, { tiles });
    cache.deals.push(d.solution && d.clock ? d : null); fs.writeFileSync(cf, JSON.stringify(cache));
  }
  // every deal, 20 human-like games
  const rated = [];
  // (a quick look of 10 games first; only deals near the aim get the full 2 x 20)
  cache.deals.forEach((d, k) => {
    if (!d) return;
    if (!d.h) { const q = human(d, 10, 500 + k, 1); d.h = q.first !== null && Math.abs(q.first - a) <= 0.3 ? human(d, 20, 1000 + k) : q; fs.writeFileSync(cf, JSON.stringify(cache)); }
    if (d.h.first !== null) rated.push([d, k]);
  });
  rated.sort((x, y) => (Math.abs(x[0].h.first - a) + (late(x[0].h) >= LATE ? 1 : 0)) - (Math.abs(y[0].h.first - a) + (late(y[0].h) >= LATE ? 1 : 0)));
  console.log(lv, 'aim', a.toFixed(2), 'deals', rated.map(([d, k]) => k + ':' + d.h.first).join(' '));
  let row = null;
  for (const [d0, k] of rated.slice(0, 4)) {
    let best = d0, swaps = 0;
    // tune by swapping two pictures (the designer's way through must stay valid)
    if (!fits(best.h, a)) {
      const g = game(d0, L), r = L.rng(lv * 97 + k);
      for (let s = 0; s < SWAPS && !fits(best.h, a); s++) {
        const faces = best.faces.slice(), n = faces.length, i = Math.floor(r() * n), j = Math.floor(r() * n);
        if (faces[i] === faces[j]) continue;
        [faces[i], faces[j]] = [faces[j], faces[i]];
        if (!Hard.validSolution({ ...g, faces }, best.solution)) continue;
        const c = { ...best, faces }; c.h = human(c, 20, 3000 + s);
        if (c.h.first === null) continue;
        const score = h => Math.abs(h.first - a) + (late(h) >= LATE ? 0.5 : 0);
        if (score(c.h) < score(best.h)) { best = c; swaps++; }
      }
    }
    if (!fits(best.h, a)) { console.log(lv, 'deal', k, 'not in band after', swaps, 'swaps', best.h.first); continue; }
    const fin = human(best, 20, 777000 + lv, 3);
    if (!(fin.first !== null && Math.abs(fin.first - a) <= BAND + 0.03 && late(fin) < LATE)) { console.log(lv, 'deal', k, 'final measurement off', fin.first); continue; }
    let m; try { m = measure(boardOf(best), { salts: SALTS, maxTries: MAX }); } catch (e) { m = { triesPerSalt: [null], error: String(e).slice(0, 160) }; }
    const ok = m.triesPerSalt.every(x => x !== null && x <= MAX);
    console.log(lv, 'deal', k, 'human', fin.first, 'phase', JSON.stringify(fin.phase), 'strong bot', m.triesPerSalt.join('/'), ok ? 'KEPT' : 'no way out');
    if (!ok) continue;
    row = { level: lv, shape: p.shape, n: best.tiles.length, px: p.px, shared: p.shared, aim: +a.toFixed(3), deal: k, swaps, ok: true,
      human: fin, humanScreen: best.h.first, bot: m.triesPerSalt, botLoss: m.lossTypes, slowestMs: Math.round(Math.max(m.slowestMove || 0, fin.slow || 0)),
      down: best.down.length, ice: Object.keys((best.obst || {}).ice || {}).length, locks: ((best.obst || {}).locks || []).length,
      clock: best.clock.n, clockSpare: best.clock.n - (best.solution.indexOf(best.clock.i) + 1), s: Math.round((Date.now() - t0) / 1000),
      design: { v: best.v, level: lv, aspect: 1.6, tiles: best.tiles, faces: best.faces, down: best.down, gold: best.gold, obst: best.obst, clock: best.clock, solution: best.solution, info: { rate: fin.first, strong: null } } };
    break;
  }
  if (!row && rated.length >= DEALS - 2) row = { level: lv, ok: false, shape: p.shape };
  if (row) fs.appendFileSync(outFile, JSON.stringify(row) + '\n');
}
