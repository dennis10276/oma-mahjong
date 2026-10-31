/* Level factory: planned levels judged by Gemini's difficulty bot (Claude, 2026-10-31).
   Blind test 1 (Dennis 2026-10-30/31, results kept out of git until predictions were committed): his tries
   187 3, 194 4, 183 5, 185 6; g2.1 rated them 1.3, 6.2, 6.2, 7.8 (same order; g1 was 1.3 ... 22.8). So the
   difficulty bot (measureHuman 'dennis', expectedTries, 2 seeds x 20 games) now picks each level; the
   strong bot is no longer a gate (Dennis: "the levels it couldn't clear are not that hard").
   A level is built around the lab puzzles he rated 4-5 stars (tools/lab/ideas.js), with the clock at the
   exact shortest way plus a spare that follows his notes:
     - chainReaction: 3 (184: "the clock can have an extra move");
     - with iceChain: 1 (187 "I liked it", 194 "very hard but fun hard", both with 1);
     - others: 2.
   Every candidate is valid by construction (the stored way through passes every rule and the clock).
   Aim (expectedTries): 2.5 at level 175 rising to 4.0 at 194 and 5.0 at 270; a level is kept when it
   is within BAND of the aim, else the closest of its attempts.
   First run (2026-10-31): the bot's ratings are mostly 1-2 or 6-8 tries, and the easy locked clock won
   4 of the first 7 levels as "closest". So now: each level starts with its own recipe (the list rotates
   with the level, so neighbours differ), and the clock spare is the fine knob: too hard -> one more
   spare move (up to +3), too easy -> one fewer (never below 1), each measured again.
     node source/tools/factory/plan_g2.js <piles.json> <out.jsonl> <human_bot.js> [levels]       */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const I = require(path.join(ROOT, 'tools', 'lab', 'ideas.js'));   // (sets its own RULES and level table)
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const [pilesFile, outFile, humanPath, only] = process.argv.slice(2);
const { measureHuman } = require(path.resolve(humanPath));
const RECIPES = [['chainReaction'], ['deepKeys', 'iceChain'], ['iceLockClock'], ['dontGrab', 'lockedPartners'], ['lockedPartners', 'iceChain'], ['lockedClock'], ['trayJuggleLocked'], ['deepKeys', 'iceChain']];
const SPARE_OF = r => (r.includes('chainReaction') ? 3 : r.includes('iceChain') ? 1 : 2);
const BAND = 0.6, ATTEMPTS = +(process.env.ATTEMPTS || 8);
const aim = lv => lv <= 194 ? 2.5 + 1.5 * (lv - 175) / 19 : Math.min(5, 4 + (lv - 194) / 76);
I.setExact(true);
const want = only ? only.split(',').map(Number) : null;
const piles = JSON.parse(fs.readFileSync(pilesFile, 'utf8')).filter(p => !want || want.includes(p.level));
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).level) : []);
const boardOf = d => ({ tiles: d.tiles, faces: d.faces, down: d.down, obst: d.obst, clock: d.clock });
const keys = b => (b.obst && b.obst.keys) || [];
const sameTiles = (a, b) => a.length === b.length && a.every((t, k) => t.x === b[k].x && t.y === b[k].y && t.z === b[k].z);

for (const p of piles) {
  if (done.has(p.level)) continue;
  const lv = p.level, a = aim(lv), t0 = Date.now(), tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
  // (progress is saved after every attempt, so a stopped run goes on where it was)
  const progFile = outFile + '.progress.json', prog = fs.existsSync(progFile) ? JSON.parse(fs.readFileSync(progFile, 'utf8')) : {};
  const pg = prog[lv] = prog[lv] || { next: 0, best: null, tried: [] };
  const save = () => fs.writeFileSync(progFile, JSON.stringify(prog));
  // designer deals already made for this pile (DEALS_DIR), only when they are for this very pile
  const cf = process.env.DEALS_DIR && path.join(process.env.DEALS_DIR, lv + '.json');
  const cached = cf && fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')).deals.filter(d => d && sameTiles(d.tiles, tiles)) : [];
  for (let attempt = pg.next; attempt < ATTEMPTS && !(pg.best && Math.abs(pg.best.exp - a) <= BAND); attempt++) {
    pg.next = attempt + 1; save();
    const recipe = RECIPES[(lv + attempt) % RECIPES.length], salt = 50 + attempt;
    const d = cached.length > attempt ? cached[attempt] : Hard.makeNow(lv, 1.6, 1, salt, { tiles });
    if (!d.solution || !I.valid(d)) { pg.tried.push('designer: no deal'); continue; }
    let x = { tiles: d.tiles, faces: d.faces.slice(), down: d.down.slice(), gold: (d.gold || []).slice(), obst: d.obst ? I.clone(d.obst) : { ice: {}, locks: [], keys: [] }, clock: d.clock ? { ...d.clock } : null, solution: d.solution.slice() };
    let ok = true;
    for (const k of recipe) { const y = I.IDEAS[k].make(x, I.ctxOf(x), I.rngOf(lv * 31 + salt * 7 + k.length)); if (!y) { ok = false; break; } x = y; }
    if (!ok) { pg.tried.push(recipe.join('+') + ': no place'); continue; }
    if (keys(x).length && x.obst.keys.some(kk => I.ctxOf(x).free0[kk]) && recipe.every(k => !['lockedClock', 'clockOnTopLocked'].includes(k))) { pg.tried.push('free keys'); continue; }
    // the spare knob: start at the recipe's spare, step towards the aim while the rating moves that way
    const rate = sp => { const z = I.fix(x, sp); if (!z || !I.valid(z)) return null; try { return { z, sp, m: measureHuman(boardOf(z), { runs: 20, setting: 'dennis', seed: 4711 }) }; } catch (e) { return null; } };
    const base = SPARE_OF(recipe); let r = rate(base);
    if (!r) { pg.tried.push(recipe.join('+') + ': no exact clock route'); continue; }
    pg.tried.push(recipe.join('+') + ' spare ' + base + ': ' + r.m.expectedTries);
    for (let step = 0; step < 3 && Math.abs(r.m.expectedTries - a) > BAND; step++) {
      const sp = r.m.expectedTries > a ? r.sp + 1 : r.sp - 1;
      if (sp < 1 || sp > base + 3 || !r.z.clock) break;
      const q = rate(sp); if (!q) break;
      pg.tried.push(recipe.join('+') + ' spare ' + sp + ': ' + q.m.expectedTries);
      if (Math.abs(q.m.expectedTries - a) >= Math.abs(r.m.expectedTries - a) && (q.m.expectedTries - a) * (r.m.expectedTries - a) > 0 && step) break;
      if (Math.abs(q.m.expectedTries - a) < Math.abs(r.m.expectedTries - a)) r = q; else break;
    }
    const z = r.z, m = r.m;
    const ck = z.clock ? z.clock.n - (z.solution.indexOf(z.clock.i) + 1) : null;
    const row = { level: lv, ok: true, shape: p.shape, n: z.tiles.length, px: p.px, recipe, aim: +a.toFixed(2), g2: { exp: m.expectedTries, label: m.label, first: m.firstTryRate, version: m.version },
      down: z.down.length, ice: Object.keys(z.obst.ice || {}).length, locks: (z.obst.locks || []).length, keys: keys(z).length, clock: z.clock && z.clock.n, clockSpare: ck,
      design: { level: lv, aspect: 1.6, tiles: z.tiles, faces: z.faces, down: z.down, gold: z.gold, obst: z.obst, clock: z.clock, solution: z.solution } };
    console.log(lv, 'aim', a.toFixed(2), 'attempt', attempt, recipe.join('+'), 'spare', ck, 'exp', m.expectedTries, m.label, 'first', m.firstTryRate);
    if (!pg.best || Math.abs(row.g2.exp - a) < Math.abs(pg.best.g2.exp - a)) { pg.best = { ...row, exp: row.g2.exp }; }
    save();
  }
  const best = pg.best ? { ...pg.best, inBand: Math.abs(pg.best.exp - a) <= BAND, tried: pg.tried, s: Math.round((Date.now() - t0) / 1000) } : { level: lv, ok: false, shape: p.shape, tried: pg.tried };
  delete best.exp;
  fs.appendFileSync(outFile, JSON.stringify(best) + '\n');
  console.log(lv, best.ok ? 'KEPT ' + best.recipe.join('+') + ' exp ' + best.g2.exp + ' (aim ' + a.toFixed(2) + (best.inBand ? '' : ', closest') + ')' : 'NONE');
}
