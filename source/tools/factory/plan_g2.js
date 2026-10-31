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
   Planned first with an aim of 2.5 tries at 175 rising to 4.0 at 194; see below why it changed.
   First run (2026-10-31): the bot's ratings are mostly 1-2 or 6-8 tries, and the easy locked clock won
   4 of the first 7 levels as "closest". Second run: the clock spare hardly moves the rating (8 -> 8,
   6.1 -> 6.25, 5.8 -> 5.4 -> 5.4), so it is no knob. So each level now has a role: a hard level
   (expectedTries 5-7.9; blind test: bot 6.2-7.8 was Dennis 4-6, "very hard but fun hard") or a breather
   (1.8-3.5; bot 3.0 was Dennis 3, "I liked it"); the share of hard levels rises from 30% at 175 to 60%
   at 194. Each level starts with its own recipe (the list rotates with the level, so neighbours differ)
   and keeps the first attempt in its band, else the closest. (8 = the bot hardly ever clears it: out.)
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
const ATTEMPTS = +(process.env.ATTEMPTS || 10);
const hardShare = lv => Math.min(0.7, 0.3 + 0.3 * (lv - 175) / 19);
const isHard = lv => ((lv * 0.6180339887) % 1) < hardShare(lv);     // (spread evenly, not in clumps)
const BANDS = { hard: [5, 7.9], breather: [1.8, 3.5] };
const bandOf = lv => BANDS[isHard(lv) ? 'hard' : 'breather'];
const off = (e, b) => e < b[0] ? b[0] - e : e > b[1] ? e - b[1] : 0;
I.setExact(true);
const want = only ? only.split(',').map(Number) : null;
const piles = JSON.parse(fs.readFileSync(pilesFile, 'utf8')).filter(p => !want || want.includes(p.level));
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).level) : []);
const boardOf = d => ({ tiles: d.tiles, faces: d.faces, down: d.down, obst: d.obst, clock: d.clock });
const keys = b => (b.obst && b.obst.keys) || [];
const sameTiles = (a, b) => a.length === b.length && a.every((t, k) => t.x === b[k].x && t.y === b[k].y && t.z === b[k].z);

for (const p of piles) {
  if (done.has(p.level)) continue;
  const lv = p.level, band = bandOf(lv), t0 = Date.now(), tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
  // (progress is saved after every attempt, so a stopped run goes on where it was)
  const progFile = outFile + '.progress.json', prog = fs.existsSync(progFile) ? JSON.parse(fs.readFileSync(progFile, 'utf8')) : {};
  const pg = prog[lv] = prog[lv] || { next: 0, best: null, tried: [] };
  const save = () => fs.writeFileSync(progFile, JSON.stringify(prog));
  // designer deals already made for this pile (DEALS_DIR), only when they are for this very pile
  const cf = process.env.DEALS_DIR && path.join(process.env.DEALS_DIR, lv + '.json');
  const cached = cf && fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')).deals.filter(d => d && sameTiles(d.tiles, tiles)) : [];
  for (let attempt = pg.next; attempt < ATTEMPTS && !(pg.best && off(pg.best.exp, band) === 0); attempt++) {
    pg.next = attempt + 1; save();
    const recipe = RECIPES[(lv + attempt) % RECIPES.length], salt = 50 + attempt;
    // (the designer can hang on some piles: once its cached deals are used, they are used again with the next recipe)
    const d = cached.length ? cached[attempt % cached.length] : Hard.makeNow(lv, 1.6, 1, salt, { tiles });
    if (!d.solution || !I.valid(d)) { pg.tried.push('designer: no deal'); continue; }
    let x = { tiles: d.tiles, faces: d.faces.slice(), down: d.down.slice(), gold: (d.gold || []).slice(), obst: d.obst ? I.clone(d.obst) : { ice: {}, locks: [], keys: [] }, clock: d.clock ? { ...d.clock } : null, solution: d.solution.slice() };
    let ok = true;
    for (const k of recipe) { const y = I.IDEAS[k].make(x, I.ctxOf(x), I.rngOf(lv * 31 + salt * 7 + k.length)); if (!y) { ok = false; break; } x = y; }
    if (!ok) { pg.tried.push(recipe.join('+') + ': no place'); continue; }
    if (keys(x).length && x.obst.keys.some(kk => I.ctxOf(x).free0[kk]) && recipe.every(k => !['lockedClock', 'clockOnTopLocked'].includes(k))) { pg.tried.push('free keys'); continue; }
    const z = I.fix(x, SPARE_OF(recipe)); if (!z || !I.valid(z)) { pg.tried.push(recipe.join('+') + ': no exact clock route'); continue; }
    let m; try { m = measureHuman(boardOf(z), { runs: 20, setting: 'dennis', seed: 4711 }); } catch (e) { pg.tried.push('bot error ' + String(e.message).slice(0, 80)); continue; }
    pg.tried.push(recipe.join('+') + ': ' + m.expectedTries);
    const ck = z.clock ? z.clock.n - (z.solution.indexOf(z.clock.i) + 1) : null;
    const row = { level: lv, ok: true, shape: p.shape, n: z.tiles.length, px: p.px, recipe, role: isHard(lv) ? 'hard' : 'breather', band, g2: { exp: m.expectedTries, label: m.label, first: m.firstTryRate, version: m.version },
      down: z.down.length, ice: Object.keys(z.obst.ice || {}).length, locks: (z.obst.locks || []).length, keys: keys(z).length, clock: z.clock && z.clock.n, clockSpare: ck,
      design: { level: lv, aspect: 1.6, tiles: z.tiles, faces: z.faces, down: z.down, gold: z.gold, obst: z.obst, clock: z.clock, solution: z.solution } };
    console.log(lv, 'band', band.join('-'), 'attempt', attempt, recipe.join('+'), 'spare', ck, 'exp', m.expectedTries, m.label, 'first', m.firstTryRate);
    if (!pg.best || off(row.g2.exp, band) < off(pg.best.g2.exp, band)) { pg.best = { ...row, exp: row.g2.exp }; }
    save();
  }
  const best = pg.best ? { ...pg.best, inBand: off(pg.best.exp, band) === 0, tried: pg.tried, s: Math.round((Date.now() - t0) / 1000) } : { level: lv, ok: false, shape: p.shape, tried: pg.tried };
  delete best.exp;
  fs.appendFileSync(outFile, JSON.stringify(best) + '\n');
  console.log(lv, best.ok ? 'KEPT ' + best.recipe.join('+') + ' exp ' + best.g2.exp + ' (' + (isHard(lv) ? 'hard ' : 'breather ') + band.join('-') + (best.inBand ? '' : ', closest') + ')' : 'NONE');
}
