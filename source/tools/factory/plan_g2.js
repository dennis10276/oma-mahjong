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
// dontGrab stays (Dennis 2026-11-01: "You can make levels where it would be counterproductive to grab the clock
// early. These just weren't that"), but such a board must show it: see GRAB_MIN below.
const RECIPES = [['chainReaction'], ['deepKeys', 'iceChain'], ['iceLockClock'], ['dontGrab', 'lockedPartners'], ['lockedPartners', 'iceChain'], ['lockedClock'], ['trayJuggleLocked'], ['deepKeys', 'iceChain']];
// "Don't grab the clock" must be true: the human bot made to take the clock as its first move (clock.n = 1)
// needs at least GRAB_MIN more tries than on the board as built (176, 189, 193 in the 175-200 candidate needed
// fewer: 3.27 -> 2.90, 4.85 -> 1.23, 3.98 -> 3.07; tools/factory/grab_early.js)
const GRAB_MIN = +(process.env.GRAB_MIN || 1);
// CRITIC_BOT=<Gemini's g3 human_bot.js>: its critic on every candidate; clockTooLoose is a rejection (Dennis
// 2026-11-01 "too loose is no pass level from now on"), the other flags stay warnings
const critique = process.env.CRITIC_BOT ? require(path.resolve(process.env.CRITIC_BOT)).critique : null;
const SPARE_OF = r => (r.includes('chainReaction') ? 3 : r.includes('iceChain') ? 1 : 2);
const ATTEMPTS = +(process.env.ATTEMPTS || 10);
const hardShare = lv => Math.min(0.7, 0.3 + 0.3 * (lv - 175) / 19);
const isHard = lv => ((lv * 0.6180339887) % 1) < hardShare(lv);     // (spread evenly, not in clumps)
const BANDS = { hard: [5, 7.9], breather: [1.8, 3.5] };
// BAND='3.6,4.8': one band for every level of this run (Dennis 2026-10-31: breathers first, then middle
// ones, then hard ones; the bot rarely lands in the middle, so middle levels are built on their own)
const bandOf = lv => process.env.BAND ? process.env.BAND.split(',').map(Number) : BANDS[isHard(lv) ? 'hard' : 'breather'];
const off = (e, b) => e >= 8 ? 3 : e < b[0] ? b[0] - e : e > b[1] ? e - b[1] : 0;   // (8: the bot hardly ever clears it)
// AVOID='{"182":["lockedClock"]}': recipes a level must not use (variety fix-ups after a run)
const AVOID = JSON.parse(process.env.AVOID || '{}');
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
    const recipe = RECIPES[(lv + attempt) % RECIPES.length], salt = 50 + attempt + (+process.env.SALT || 0);
    if ((AVOID[lv] || []).includes(recipe.join('+'))) continue;
    // (the designer can hang on some piles: once its cached deals are used, they are used again with the next recipe)
    const d = cached.length ? cached[attempt % cached.length] : Hard.makeNow(lv, 1.6, 1, salt, { tiles });
    if (!d.solution || !I.valid(d)) { pg.tried.push('designer: no deal'); continue; }
    let x = { tiles: d.tiles, faces: d.faces.slice(), down: d.down.slice(), gold: (d.gold || []).slice(), obst: d.obst ? I.clone(d.obst) : { ice: {}, locks: [], keys: [] }, clock: d.clock ? { ...d.clock } : null, solution: d.solution.slice() };
    let ok = true;
    for (const k of recipe) { const y = I.IDEAS[k].make(x, I.ctxOf(x), I.rngOf(lv * 31 + salt * 7 + k.length)); if (!y) { ok = false; break; } x = y; }
    if (!ok) { pg.tried.push(recipe.join('+') + ': no place'); continue; }
    if (keys(x).length && x.obst.keys.some(kk => I.ctxOf(x).free0[kk]) && recipe.every(k => !['lockedClock', 'clockOnTopLocked'].includes(k))) { pg.tried.push('free keys'); continue; }
    let z = I.fix(x, SPARE_OF(recipe)); if (!z || !I.valid(z)) { pg.tried.push(recipe.join('+') + ': no exact clock route'); continue; }
    let m; try { m = measureHuman(boardOf(z), { runs: 20, setting: 'dennis', seed: 4711 }); } catch (e) { pg.tried.push('bot error ' + String(e.message).slice(0, 80)); continue; }
    // TUNE=1: outside the band, try the clock spare one and two steps towards it (1-3, the game's rule; Dennis's
    // +2 on 194 took it from 7.85 to 2.5). Kept when it lands closer.
    if (process.env.TUNE && z.clock) {
      const route = z.solution.indexOf(z.clock.i) + 1;
      for (const step of [1, 2]) {
        if (off(m.expectedTries, band) === 0) break;
        const sp = (z.clock.n - route) + (m.expectedTries > band[1] ? 1 : -1);
        if (sp < 1 || sp > 3) break;
        const z2 = { ...z, clock: { ...z.clock, n: route + sp } };
        let m2; try { m2 = measureHuman(boardOf(z2), { runs: 20, setting: 'dennis', seed: 4711 }); } catch (e) { break; }
        pg.tried.push(recipe.join('+') + ' spare ' + sp + ': ' + m2.expectedTries);
        if (off(m2.expectedTries, band) < off(m.expectedTries, band)) { z = z2; m = m2; } else break;
      }
    }
    // critic v1, warnings only (Dennis's notes, checked on every board he rated; analysis/factory/README.md): late squeeze
    // (lost with a third or less of the tiles left in more than 30% of the bot's losses: 185 in 1.63, "tray
    // pressure at the very end", the only rated board above 0.21) and a clock a person can reach (the bot
    // takes it in time in at least 5% of its tries: 194 in 1.63 had 0.4%, "I don't see a faster route";
    // the 5-star blind 194 had 8%)
    const nT = z.tiles.length, at = m.results.flatMap(q => q.attempts), lost = at.filter(q => !q.win && !q.censored);
    const late = lost.filter(q => q.left <= 0.35 * nT).length / Math.max(1, lost.length);
    const reach = z.clock ? at.filter(q => q.clockLeft != null && q.clockLeft < nT).length / Math.max(1, at.length) : 1;
    const critic = { late: +late.toFixed(2), reach: +reach.toFixed(2), flags: [late > 0.3 && 'late squeeze', reach < 0.05 && 'clock out of reach'].filter(Boolean) };
    let grabFirst = null;
    if (recipe.includes('dontGrab') && z.clock) {
      let mg; try { mg = measureHuman({ ...boardOf(z), clock: { i: z.clock.i, n: 1 } }, { runs: 20, setting: 'dennis', seed: 4711 }); } catch (e) { mg = null; }
      grabFirst = mg && mg.expectedTries;
      if (!mg || mg.expectedTries < m.expectedTries + GRAB_MIN) { pg.tried.push(recipe.join('+') + ': grabbing the clock first is not worse (' + m.expectedTries + ' -> ' + grabFirst + ', out)'); save(); continue; }
    }
    let critic3 = null;
    if (critique) { try { critic3 = critique(boardOf(z), { runs: 20, seed: 4711 }).flags; } catch (e) { critic3 = null; } }
    if (critic3 && critic3.includes('clockTooLoose')) { pg.tried.push(recipe.join('+') + ': clock too loose (out)'); save(); continue; }
    pg.tried.push(recipe.join('+') + ': ' + m.expectedTries + (critic.flags.length ? ' (' + critic.flags.join(', ') + ')' : ''));
    const ck = z.clock ? z.clock.n - (z.solution.indexOf(z.clock.i) + 1) : null;
    const row = { level: lv, ok: true, shape: p.shape, n: z.tiles.length, px: p.px, recipe, role: isHard(lv) ? 'hard' : 'breather', band, g2: { exp: m.expectedTries, label: m.label, first: m.firstTryRate, version: m.version }, critic, critic3, grabFirst,
      down: z.down.length, ice: Object.keys(z.obst.ice || {}).length, locks: (z.obst.locks || []).length, keys: keys(z).length, clock: z.clock && z.clock.n, clockSpare: ck,
      design: { level: lv, aspect: 1.6, tiles: z.tiles, faces: z.faces, down: z.down, gold: z.gold, obst: z.obst, clock: z.clock, solution: z.solution } };
    console.log(lv, 'band', band.join('-'), 'attempt', attempt, recipe.join('+'), 'spare', ck, 'exp', m.expectedTries, m.label, 'first', m.firstTryRate, 'late', critic.late, 'reach', critic.reach, critic.flags.join(','));
    // (the critic only warns: Dennis 2026-10-31 "I don't want this [rejecting]. Maybe some are doable."
    //  A flagged level is kept like any other; its flags travel with it so he can test them)
    const score = r => off(r.g2.exp, band);
    if (!pg.best || score(row) < score(pg.best)) { pg.best = { ...row, exp: row.g2.exp }; }
    save();
  }
  const best = pg.best ? { ...pg.best, inBand: off(pg.best.exp, band) === 0, tried: pg.tried, s: Math.round((Date.now() - t0) / 1000) } : { level: lv, ok: false, shape: p.shape, tried: pg.tried };
  delete best.exp;
  fs.appendFileSync(outFile, JSON.stringify(best) + '\n');
  console.log(lv, best.ok ? 'KEPT ' + best.recipe.join('+') + ' exp ' + best.g2.exp + ' (' + (isHard(lv) ? 'hard ' : 'breather ') + band.join('-') + (best.inBand ? '' : ', closest') + ')' : 'NONE');
}
