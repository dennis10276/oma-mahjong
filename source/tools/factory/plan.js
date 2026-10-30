/* Level factory: planned levels (Claude, 2026-10-29). Dennis on batch 3: "too easy; the strong bot
   needing 1/1/1 tries is a bad sign; I shouldn't be able to make it without thinking. Don't focus on
   deals but really plan the levels." So a level is built around puzzles he rated highly in the lab
   (tools/lab/ideas.js, 2026-10-23/24), two per level so the pressure lasts:
     - a key puzzle: lockedPartners (5 stars: "once you realise you have to take the keys first and then
       the alarm because of tray space, that's cool"), deepKeys (4), dontGrab (4);
     - a clock puzzle: iceChain (5: "nice hardness"), chainReaction (5: "fun"), lockedClock (4),
       trayJuggleLocked (4: "having to plan and find out what to do when").
   The clock is the true shortest way to it plus 2 spare moves (Dennis: "give the clock 1/2 more turns").
   Checks:
     - not without thinking: the strong bot (seeing only what a person sees) fails its first try in at
       least 2 of 3 runs;
     - a way out: it clears every run within 6 tries;
     - the human-like bot (human-v0, 'dennis') is reported, not used to pick.
     node source/tools/factory/plan.js <piles.json> <out.jsonl> <measure.js> <human_bot.js> [levels]   */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const I = require(path.join(ROOT, 'tools', 'lab', 'ideas.js'));   // (sets its own RULES and level table)
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const [pilesFile, outFile, measurePath, humanPath, only] = process.argv.slice(2);
const { measure } = require(path.resolve(measurePath)), { measureHuman } = require(path.resolve(humanPath));
// Dennis's verdicts on batches 4-5 (2026-10-30): chainReaction 5 stars "very fun" (right), lockedClock 4
// (right), lockedPartners + iceChain and deepKeys + iceChain fun and original but a bit easy ("feels like
// the clock has more than 2 spare moves"): those two get 1 spare move. From the lab also trayJuggleLocked,
// dontGrab, iceLockClock (4 stars each).
const RECIPES = [['chainReaction'], ['lockedPartners', 'iceChain'], ['lockedClock'], ['deepKeys', 'iceChain'], ['trayJuggleLocked'], ['dontGrab', 'lockedPartners'], ['iceLockClock'], ['chainReaction']];
const SPARE_OF = r => (r.includes('iceChain') ? 1 : 2), MAX = 6, SALTS = [1, 2, 3];
I.setExact(true);
const want = only ? only.split(',').map(Number) : null;
const piles = JSON.parse(fs.readFileSync(pilesFile, 'utf8')).filter(p => !want || want.includes(p.level));
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).level) : []);
const boardOf = d => ({ tiles: d.tiles, faces: d.faces, down: d.down, obst: d.obst, clock: d.clock });
const keys = b => (b.obst && b.obst.keys) || [];

for (const p of piles) {
  if (done.has(p.level)) continue;
  const lv = p.level, t0 = Date.now(), tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
  // (progress is saved after every attempt, so a run that is stopped goes on where it was)
  const progFile = outFile + '.progress.json', prog = fs.existsSync(progFile) ? JSON.parse(fs.readFileSync(progFile, 'utf8')) : {};
  const pg = prog[lv] = prog[lv] || { next: 0, fallback: null, tried: [], t: 0 };
  const save = () => fs.writeFileSync(progFile, JSON.stringify(prog));
  let row = null, fallback = pg.fallback, tried = pg.tried;
  for (let attempt = pg.next; attempt < 18 && !row && attempt < +(process.env.ATTEMPTS || 10); attempt++) {
    pg.next = attempt + 1; save();
    const recipe = RECIPES[(lv + attempt) % RECIPES.length], salt = 50 + attempt;
    // designer deals already made for this pile (DEALS_DIR: the factory's deal cache) are used first;
    // the designer can take very long on some piles
    const cached = process.env.DEALS_DIR && fs.existsSync(path.join(process.env.DEALS_DIR, lv + '.json')) ? JSON.parse(fs.readFileSync(path.join(process.env.DEALS_DIR, lv + '.json'), 'utf8')).deals.filter(Boolean) : [];
    const ta = Date.now(); const d = cached.length ? cached[attempt % cached.length] : Hard.makeNow(lv, 1.6, 1, salt, { tiles }); if (process.env.VERBOSE) console.log(lv, attempt, 'designer', Date.now() - ta, 'ms');
    if (!d.solution || !I.valid(d)) continue;
    let x = { tiles: d.tiles, faces: d.faces.slice(), down: d.down.slice(), gold: (d.gold || []).slice(), obst: d.obst ? I.clone(d.obst) : { ice: {}, locks: [], keys: [] }, clock: d.clock ? { ...d.clock } : null, solution: d.solution.slice() };
    let ok = true;
    for (const k of recipe) { const y = I.IDEAS[k].make(x, I.ctxOf(x), I.rngOf(lv * 31 + salt * 7 + k.length)); if (!y) { ok = false; break; } x = y; }
    if (!ok) { tried.push(recipe.join('+') + ': no place'); console.log(lv, 'attempt', attempt, recipe.join('+'), 'no place'); continue; }
    if (keys(x).length && x.obst.keys.some(kk => I.ctxOf(x).free0[kk]) && recipe.every(k => !['lockedClock', 'clockOnTopLocked'].includes(k))) { tried.push('free keys'); continue; }   // (free keys make the route obvious)
    const tb = Date.now(); const z = I.fix(x, SPARE_OF(recipe)); if (process.env.VERBOSE) console.log(lv, attempt, recipe.join('+'), 'fix', Date.now() - tb, 'ms'); if (!z) { tried.push(recipe.join('+') + ': no exact clock route'); continue; }
    // a quick look first (salt 1, up to 3 tries): a first-try win or no clear in 4 ends it cheaply
    const run = (salts, max) => { try { return measure(boardOf(z), { salts, maxTries: max }); } catch (e) { return { triesPerSalt: salts.map(() => null), lossTypes: {} }; } };
    const m1 = run([1], 3);
    let m = m1;
    if (m1.triesPerSalt[0] !== null && m1.triesPerSalt[0] >= 2) {
      const m23 = run([2, 3], 4); m = { triesPerSalt: [m1.triesPerSalt[0], ...m23.triesPerSalt], lossTypes: { ...m1.lossTypes } };
      for (const [k, v] of Object.entries(m23.lossTypes || {})) m.lossTypes[k] = (m.lossTypes[k] || 0) + v;
    }
    const t = m.triesPerSalt, fails1 = t.filter(v => v !== 1).length, clear = t.length === 3 && t.every(v => v !== null && v <= MAX);
    const verdict = t[0] === 1 ? 'too easy (first try)' : !clear ? 'no way out' : fails1 < 2 ? 'too easy (strong bot ' + t.join('/') + ')' : 'ok';
    tried.push(recipe.join('+') + ': strong bot ' + t.join('/') + ' ' + verdict);
    console.log(lv, 'attempt', attempt, recipe.join('+'), 'strong bot', t.join('/'), JSON.stringify(m.lossTypes), verdict);
    // TIGHT=1 (Dennis 2026-10-29: "let the too tight ones through so I can test those too; maybe that's what
    // we want, new ideas the bot hasn't learned yet"): a level the strong bot cannot clear is kept too. It
    // is still winnable: the stored way through passes every rule and the clock.
    const tight = process.env.TIGHT && verdict === 'no way out' && I.valid(z);
    if (verdict !== 'ok' && !tight) continue;
    // the human-like bot (two seeds x 20 games): places the level in the order, above all where the strong
    // bot has a blind spot (Dennis on a level it could not clear: "seems easy, idk why the strong bot
    // struggled ... just place it better on difficulty")
    let h = null; try { let f = 0; for (const sd of [4242 + lv, 9999 + lv]) f += measureHuman(boardOf(z), { runs: 20, setting: 'dennis', seed: sd }).firstTryRate / 2; h = { first: +f.toFixed(3) }; } catch (e) { h = { error: String(e.message).slice(0, 120) }; }
    const ck = z.clock ? z.clock.n - (z.solution.indexOf(z.clock.i) + 1) : null;
    row = { level: lv, ok: true, tight: !!tight, shape: p.shape, n: z.tiles.length, px: p.px, recipe, bot: t, botLoss: m.lossTypes, human: h,
      down: z.down.length, ice: Object.keys(z.obst.ice || {}).length, locks: (z.obst.locks || []).length, keys: keys(z).length, clock: z.clock && z.clock.n, clockSpare: ck,
      s: Math.round((Date.now() - t0) / 1000), tried,
      design: { level: lv, aspect: 1.6, tiles: z.tiles, faces: z.faces, down: z.down, gold: z.gold, obst: z.obst, clock: z.clock, solution: z.solution } };
    // (Dennis 2026-10-30: the levels the strong bot could not clear were "not that hard", the 2/3-try ones
    //  "the hardest so far": a too-tight one is only a fallback while a 2/3-try one is looked for)
    if (row.tight) { if (!fallback) { fallback = row; pg.fallback = row; save(); } row = null; }
  }
  if (!row && fallback) row = fallback;
  fs.appendFileSync(outFile, JSON.stringify(row || { level: lv, ok: false, shape: p.shape, tried }) + '\n');
  console.log(lv, row ? (row.tight ? 'KEPT (tight) ' : 'KEPT ') + row.recipe.join('+') + ' strong ' + row.bot.join('/') + ' human ' + (row.human && row.human.first) : 'NONE');
}
