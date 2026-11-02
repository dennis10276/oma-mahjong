/* Level factory: levels designed around traps (Claude, 2026-11-02).
   Dennis: "use the bot to design the levels with traps they will struggle with. That way we rely less on
   randomness of the board but everything is thought about and feels fun." And: "we can also calculate how much
   room in the tray there is for luck. If unlucky you still make it through if the tray is as empty as it can be
   at that point." First run: "only 6 designed levels, different concepts, all on curve."

   Each level gets one trap concept (the traps the family's recordings showed):
     clockBesideLock  132: a lock right beside the clock looks like "the clock needs the keys"; it doesn't, and the
                      clock has no moves to spare for the detour (Gerda lost 54 of 70 tries there to the clock)
     dontGrab         the clock is free but its partner is buried: taking it early costs a tray spot while digging
                      (kept only when the bot taking the clock first needs at least 1 try more)
     oneFreeSpot      the clock under a few tiles whose partners are buried and locked: you dig with one spot
                      to spare (Dennis keeps a spot free: the tray reached 3 in 11% of his takes, Gerda's 19%)
     iceBeforeKeys    91: ice, a lock, then the clock - melting the ice too early fills the tray
     buriedChain      frozen tiles guard the keys, the keys open the clock's lock, the clock is buried
     combo (big)      buried chain + partners behind locks
   A board is kept only when
     - not luck: at most LUCK_SHARE (0.3) of the family rating comes from hidden tiles (the same board with every tile
       face-up rates at least 70% as hard); roomProfile (luck moments on the emptiest way) is reported only, it
       overstates luck (a free face-down tile can be turned over before you take it);
     - the family profile (human-g6.1) lands on the level's target (within TOL), the clock's spare tuned 1-3;
     - Gemini's critic does not call the clock too loose (on dontGrab: out; otherwise the spare is tightened);
     - Dennis's profile can do it (expected tries at most DENNIS_MAX);
     - every special matters (taking it off changes the family rating by 0.3+ or its first-try rate by 0.15+);
     - most of the family profile's lost tries happen at the trap (its tiles in the tray or just taken, or the
       clock running out): at least ATTR of them.
     HUMAN_BOT=<g6.1 human_bot.js> CRITIC_BOT=<g3 human_bot.js> node design_traps.js <piles.json> <plan.json> <out.jsonl>
   plan.json: [{"level":175,"pile":1100,"concept":"clockBesideLock","target":7.0}, ...]                     */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const I = require(path.join(ROOT, 'tools', 'lab', 'ideas.js'));
const Hard = require(path.join(ROOT, 'www', 'hard.js')), L = global.Layouts;
const { measureHuman } = process.env.HUMAN_BOT ? require(path.resolve(process.env.HUMAN_BOT)) : {};
const critique = process.env.CRITIC_BOT ? require(path.resolve(process.env.CRITIC_BOT)).critique : null;
const [pilesFile, planFile, outFile] = process.argv.slice(2);
const LUCK_SHARE = +(process.env.LUCK_SHARE || 0.3), TOL = +(process.env.TOL || 0.5), DENNIS_MAX = +(process.env.DENNIS_MAX || 6), ATTR = +(process.env.ATTR || 0.6), ATTEMPTS = +(process.env.ATTEMPTS || 10);
I.setExact(true);
const boardOf = d => ({ tiles: d.tiles, faces: d.faces, down: d.down, obst: d.obst, clock: d.clock });
const meas = (d, setting, capture) => measureHuman(boardOf(d), { runs: 20, setting, seed: 4711, ...(capture ? { capture: true } : {}) });
const tilesOf = d => d.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t);
const coverOf = (nb, i) => { const s = new Set(), st = [i]; while (st.length) { const j = st.pop(); for (const a of nb.above[j]) if (!s.has(a)) { s.add(a); st.push(a); } } return s; };
const special = (b, i) => (b.clock && b.clock.i === i) || (b.obst && ((b.obst.keys || []).includes(i) || (b.obst.locks || []).includes(i) || (b.obst.ice || {})[i]));

// ---------- the new trap: a lock beside the clock that the clock does not need ----------
function clockBesideLock(b, c) {
  const P = c.P, n = c.n;
  const cands = P.filter(i => !special(b, i) && c.pos[i] > 3 && c.pos[i] < n * 0.4 && coverOf(c.nb, i).size >= 2 && coverOf(c.nb, i).size <= 5);
  for (const ck of cands) {
    for (const j of [...c.nb.left[ck], ...c.nb.right[ck], ...c.nb.above[ck]]) {
      if (special(b, j) || c.pos[j] < c.pos[ck] + 3) continue;        // the lock is not on the way to the clock
      const key = c.pairs.find(([a, q]) => c.pos[a] > c.pos[ck] && c.pos[q] > c.pos[ck] && c.pos[a] < c.pos[j] && c.pos[q] < c.pos[j] && !special(b, a) && !special(b, q) && coverOf(c.nb, a).size >= 1 && coverOf(c.nb, q).size >= 1);
      if (!key) continue;
      const x = I.clone(b);
      x.obst = { ice: Object.fromEntries(Object.entries((b.obst && b.obst.ice) || {}).filter(([t]) => ![ck, j, key[0], key[1]].includes(+t))), locks: [j], keys: [key[0], key[1]] };
      x.clock = { i: ck, n: 999 }; x.down = x.down.filter(t => ![ck, j].includes(t));
      return x;
    }
  }
  return null;
}
// extra: a second trap the designer may add (Dennis 2026-11-02: "You may also combine different traps"); every other
// attempt uses one, so a level gets the single trap or a combination, whichever lands on the curve
const CONCEPTS = {
  clockBesideLock: { title: 'A lock beside the clock', recipe: ['clockBesideLock'], spare: 1, extra: ['iceChain', 'trayJuggleFrozen'] },
  dontGrab: { title: "Don't grab the clock", recipe: ['dontGrab'], spare: 2, extra: ['lockedPartners', 'iceChain'] },
  oneFreeSpot: { title: 'One free spot', recipe: ['trayJuggleLocked'], spare: 2, extra: ['iceChain', 'chainReaction'] },
  iceBeforeKeys: { title: 'Ice, lock, then the clock', recipe: ['iceLockClock'], spare: 1, extra: ['deepKeys', 'lockedPartners'] },
  buriedChain: { title: 'Buried chain', recipe: ['chainReaction'], spare: 3, extra: ['lockedPartners', 'trayJuggleFrozen'] },
  combo: { title: 'Buried chain + partners behind locks', recipe: ['chainReaction', 'lockedPartners'], spare: 3, extra: ['iceChain'] },
};
const TITLE = { clockBesideLock: 'A lock beside the clock' };
const titleOf = recipe => recipe.map(k => TITLE[k] || I.IDEAS[k].title).join(' + ');
function applyRecipe(d, recipe, rng) {
  let x = { tiles: d.tiles, faces: d.faces.slice(), down: d.down.slice(), gold: (d.gold || []).slice(), obst: d.obst ? I.clone(d.obst) : { ice: {}, locks: [], keys: [] }, clock: d.clock ? { ...d.clock } : null, solution: d.solution.slice() };
  for (const k of recipe) {
    const y = k === 'clockBesideLock' ? clockBesideLock(x, I.ctxOf(x)) : I.IDEAS[k].make(x, I.ctxOf(x), rng);
    if (!y) return null; x = y;
  }
  return x;
}

// ---------- room for luck: the emptiest way through ----------
function roomProfile(d, width = 48) {
  const tiles = tilesOf(d), nb = L.neighbors(tiles), n = tiles.length, o = d.obst || {}, f = d.faces;
  const rules = { iceNb: L.iceNeighbors(tiles), ice: o.ice || {}, locks: new Set(o.locks || []), keys: o.keys || [] };
  const alive0 = new Uint8Array(n).fill(1), down0 = new Set(d.down), ck = d.clock;
  // up to the clock: the exact way the designer made (the clock leaves no room to wander); from there the beam
  const start = { alive: alive0.slice(), tray: [], blindMax: 0, sum: 0, blind: 0, tight: 0, moves: 0, tightTiles: [] };
  const pre = ck ? d.solution.slice(0, d.solution.indexOf(ck.i) + 1) : [];
  for (const i of pre) {
    const q = start.tray.findIndex(t => f[t] === f[i]), blind = down0.has(i);
    start.blindMax = Math.max(start.blindMax, blind ? start.tray.length : 0); start.blind += blind ? 1 : 0; start.tight += blind && start.tray.length >= 2 ? 1 : 0; if (blind && start.tray.length >= 2) start.tightTiles.push(i);
    start.tray = q >= 0 ? start.tray.filter((_, k) => k !== q) : start.tray.concat(i); start.alive[i] = 0; start.moves++; start.sum += start.tray.length;
    if (start.tray.length >= 4) return { ok: false };
  }
  let beam = [start];
  for (let step = pre.length; step < n; step++) {
    const next = [], seen = new Set();
    for (const s of beam) {
      for (let i = 0; i < n; i++) {
        if (!L.takeable(i, s.alive, nb, rules, alive0)) continue;
        const q = s.tray.findIndex(t => f[t] === f[i]);
        const tray = q >= 0 ? s.tray.filter((_, k) => k !== q) : s.tray.concat(i);
        if (tray.length >= 4) continue;
        const moves = s.moves + 1;
        const alive = s.alive.slice(); alive[i] = 0;
        const key = alive.join('') + '|' + tray.map(t => f[t]).sort((a, b) => a - b).join(',');
        if (seen.has(key)) continue; seen.add(key);
        const blind = down0.has(i);
        next.push({ alive, tray, moves, blindMax: Math.max(s.blindMax, blind ? s.tray.length : 0), sum: s.sum + tray.length, blind: s.blind + (blind ? 1 : 0), tight: s.tight + (blind && s.tray.length >= 2 ? 1 : 0), tightTiles: blind && s.tray.length >= 2 ? s.tightTiles.concat(i) : s.tightTiles });
      }
    }
    if (!next.length) return { ok: false };
    next.sort((a, b) => a.tight - b.tight || a.sum - b.sum);
    beam = next.slice(0, width);
  }
  const b = beam.find(s => !s.tray.length) || beam[0];
  return { ok: !b.tray.length, blindMax: b.blindMax, blindTakes: b.blind, tightBlind: b.tight, room: 3 - b.blindMax, tightTiles: b.tightTiles };
}

// ---------- where the family profile loses ----------
function trapTiles(d) {
  const tiles = tilesOf(d), nb = L.neighbors(tiles), o = d.obst || {}, s = new Set();
  if (d.clock) { s.add(d.clock.i); for (const j of coverOf(nb, d.clock.i)) s.add(j); }
  for (const i of [...(o.locks || []), ...(o.keys || []), ...Object.keys(o.ice || {}).map(Number)]) s.add(i);
  const faces = new Set([...s].map(i => d.faces[i]));
  return { tiles: s, faces };
}
function attribution(d, m) {
  const T = trapTiles(d); let lost = 0, at = 0;
  for (const r of m.results) for (const a of r.attempts) {
    if (a.win || a.censored) continue; lost++;
    if (a.why === 'clock') { at++; continue; }
    const ds = a.decisions || [], last = ds.slice(-4).map(x => x.index), tray = ds.length ? ds[ds.length - 1].state.tray : [];
    if (last.some(i => T.tiles.has(i)) || tray.some(fc => T.faces.has(fc))) at++;
  }
  return lost ? +(at / lost).toFixed(2) : null;
}
function specialsMatter(d, m0) {
  const ob = d.obst || {}, out = {};
  const test = (k, b2) => { const m = meas(b2, 'family'); out[k] = { without: m.expectedTries, matters: Math.abs(m0.expectedTries - m.expectedTries) >= 0.3 || Math.abs(m.firstTryRate - m0.firstTryRate) >= 0.15 }; };
  if (ob.ice && Object.keys(ob.ice).length) test('ice', { ...d, obst: { ...ob, ice: {} } });
  if (ob.locks && ob.locks.length) test('locks', { ...d, obst: { ...ob, locks: [], keys: [] } });
  if (d.clock) test('clock', { ...d, clock: null });
  return out;
}

module.exports = { roomProfile, trapTiles };
if (require.main === module) {
const piles = JSON.parse(fs.readFileSync(pilesFile, 'utf8')), plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).level) : []);
for (const p of plan) {
  if (done.has(p.level)) continue;
  // p.piles: several piles, one per attempt in turn (a trap needs the right structure; some piles have none)
  const pileIds = p.piles || [p.pile], C = CONCEPTS[p.concept], lv = p.level;
  const progFile = outFile + '.progress.json', prog = fs.existsSync(progFile) ? JSON.parse(fs.readFileSync(progFile, 'utf8') || '{}') : {};
  const pg = prog[lv] = prog[lv] || { next: 0, best: null, tried: [] };
  const save = () => fs.writeFileSync(progFile, JSON.stringify(prog));
  const off = e => Math.max(0, Math.abs(e - p.target) - TOL);
  for (let attempt = pg.next; attempt < ATTEMPTS && !(pg.best && pg.best.pass); attempt++) {
    pg.next = attempt + 1; save();
    const salt = 70 + attempt, note = s => { pg.tried.push(attempt + ': ' + s); save(); };
    const pile = piles.find(q => q.level === pileIds[attempt % pileIds.length]), tiles = pile.tiles.map(([x, y, z]) => ({ x, y, z }));
    const d0 = Hard.makeNow(lv, 1.6, 1, salt, { tiles });
    if (!d0.solution || !I.valid(d0)) { note('designer: no deal'); continue; }
    // attempts cycle: the trap alone, + one extra trap, + two extra traps (with luck taken out, the traps carry the difficulty)
    const nx = Math.min(attempt % 3, C.extra.length), recipe = [...C.recipe, ...C.extra.slice(0, nx).map((_, k) => C.extra[(Math.floor(attempt / 3) + k) % C.extra.length])];
    const x = applyRecipe(d0, recipe, I.rngOf(lv * 31 + salt * 7));
    if (!x) { note(recipe.join('+') + ': no place for the trap'); continue; }
    let z = I.fix(x, C.spare); if (!z || !I.valid(z)) { note('no exact clock route'); continue; }
    const route = z.solution.indexOf(z.clock.i) + 1;
    // the deal's face-down tiles stay; the luck check comes after the rating (luckShare, below)
    const T = trapTiles(z), downAll = z.down.slice();
    let room = roomProfile(z);
    // the family rating onto the target by the clock's spare (1-3)
    let m = meas(z, 'family', true), sp = z.clock.n - route;
    for (let k = 0; k < 2 && off(m.expectedTries) > 0; k++) {
      const s2 = sp + (m.expectedTries > p.target ? 1 : -1); if (s2 < 1 || s2 > 3) break;
      const z2 = { ...z, clock: { ...z.clock, n: route + s2 } }; if (!I.valid(z2)) break;
      const m2 = meas(z2, 'family', true); note('spare ' + s2 + ': ' + m2.expectedTries);
      if (off(m2.expectedTries) < off(m.expectedTries)) { z = z2; m = m2; sp = s2; } else break;
    }
    // How much of the difficulty is hidden tiles (Dennis 2026-11-03: "If boards really had so many luck moments how
    // can I and the bot do as well?" - luck moments counted tiles you can turn over before taking them): the family
    // profile on the board with every tile face-up; the share it loses is luck and memory, the rest traps, clock and
    // tray planning. Known boards: 150 0.12, 132 0.12, Dennis's blind 183/185/194 0-0.07, release 185 0.24; 91 0.74,
    // 149 0.60, factory 2-175 0.74 (analysis/factory/luck-share.jsonl). Above LUCK_SHARE: face-down tiles only on the
    // traps (and their twins), measured again; still above: out.
    const shareOf = (zz, mm) => { const mo = meas({ ...zz, down: [] }, 'family'); return Math.max(0, +((mm.expectedTries - mo.expectedTries) / Math.max(1, mm.expectedTries)).toFixed(2)); };
    let luck = shareOf(z, m);
    if (luck > LUCK_SHARE) {
      const z2 = { ...z, down: z.down.filter(i => T.tiles.has(i) || T.faces.has(z.faces[i])) };
      if (I.valid(z2)) { const m2 = meas(z2, 'family', true), l2 = shareOf(z2, m2); note(`hidden-tile share ${luck}: face-down ${z.down.length} -> ${z2.down.length}: family ${m2.expectedTries}, share ${l2}`); z = z2; m = m2; luck = l2; }
      if (luck > LUCK_SHARE) { note('too much luck (' + luck + ')'); continue; }
    }
    // Gemini's critic: a loose clock is out on dontGrab, otherwise the spare goes down
    let flags = critique ? critique(boardOf(z), { runs: 20, seed: 4711 }).flags : [];
    if (flags.includes('clockTooLoose')) {
      if (p.concept === 'dontGrab') { note('clock too loose (out)'); continue; }
      while (flags.includes('clockTooLoose') && sp > 1) { sp--; z = { ...z, clock: { ...z.clock, n: route + sp } }; m = meas(z, 'family', true); flags = critique(boardOf(z), { runs: 20, seed: 4711 }).flags; }
      if (flags.includes('clockTooLoose')) { note('clock too loose at 1 spare (out)'); continue; }
    }
    let grabFirst = null;
    if (p.concept === 'dontGrab') { grabFirst = meas({ ...z, clock: { ...z.clock, n: 1 } }, 'family').expectedTries; if (grabFirst < m.expectedTries + 1) { note('grabbing the clock first is not worse (' + m.expectedTries + ' -> ' + grabFirst + ')'); continue; } }
    let sm = specialsMatter(z, m), idle = Object.entries(sm).filter(([, v]) => !v.matters).map(([k]) => k);
    // ice or locks that change nothing (Dennis 2026-11-02: "you can remove the ice or place it somewhere where it
    // does matter"): first take them off; if the level then falls off the curve, try the ice again elsewhere
    // (a frozen chain along the way through, three placements), keeping the first where it matters
    if (idle.some(k => k !== 'clock')) {
      const strip = { ...z, obst: { ...z.obst, ...(idle.includes('ice') ? { ice: {} } : {}), ...(idle.includes('locks') ? { locks: [], keys: [] } : {}) } };
      const ms = meas(strip, 'family', true), sms = specialsMatter(strip, ms), idleS = Object.entries(sms).filter(([, v]) => !v.matters).map(([k]) => k);
      note(`idle ${idle.join(',')} taken off: family ${ms.expectedTries}${idleS.length ? ' (idle ' + idleS.join(',') + ')' : ''}`);
      let pick = off(ms.expectedTries) === 0 && !idleS.length ? { z: strip, m: ms, sm: sms } : null;
      if (!pick && idle.includes('ice')) {
        for (let r = 0; r < 3 && !pick; r++) {
          const y = I.IDEAS.iceChain.make(strip, I.ctxOf(strip), I.rngOf(lv * 97 + salt * 13 + r));
          const y2 = y && I.fix({ ...y, clock: { ...strip.clock } }, sp);
          if (!y2 || !I.valid(y2)) continue;
          const my = meas(y2, 'family', true), smy = specialsMatter(y2, my), idleY = Object.entries(smy).filter(([, v]) => !v.matters).map(([k]) => k);
          note(`ice placed again (${r}): family ${my.expectedTries}${idleY.length ? ' (idle ' + idleY.join(',') + ')' : ''}`);
          if (!idleY.length && off(my.expectedTries) <= off(m.expectedTries)) pick = { z: y2, m: my, sm: smy };
        }
      }
      if (pick) { z = pick.z; m = pick.m; sm = pick.sm; idle = []; sp = z.clock ? z.clock.n - (z.solution.indexOf(z.clock.i) + 1) : sp; }
    }
    const md = meas(z, 'dennis'), attr = attribution(z, m);
    const pass = off(m.expectedTries) === 0 && md.expectedTries <= DENNIS_MAX && (attr === null || attr >= ATTR) && !idle.length;
    note(`${recipe.join('+')}: family ${m.expectedTries} (target ${p.target}) | Dennis ${md.expectedTries} | at the trap ${attr} | idle ${idle.join(',') || '-'} | room ${room.room}${pass ? ' | PASS' : ''}`);
    const row = { level: lv, concept: p.concept, title: titleOf(recipe), recipe, shape: pile.shape, pile: pile.level, n: z.tiles.length, target: p.target,
      g61: { exp: m.expectedTries, first: m.firstTryRate, version: m.version }, dennis: { exp: md.expectedTries, first: md.firstTryRate },
      atTrap: attr, luckShare: luck, room, specials: sm, critic: flags, grabFirst, clockSpare: sp, pass,
      down: z.down.length, ice: Object.keys(z.obst.ice || {}).length, locks: (z.obst.locks || []).length,
      design: { level: lv, aspect: 1.6, tiles: z.tiles, faces: z.faces, down: z.down, gold: z.gold, obst: z.obst, clock: z.clock, solution: z.solution } };
    const score = r => (r.pass ? 0 : 10) + off(r.g61.exp) * 2 + Math.max(0, r.dennis.exp - DENNIS_MAX) + Math.max(0, ATTR - (r.atTrap ?? 1)) * 3 + (Object.values(r.specials).some(v => !v.matters) ? 2 : 0);
    if (!pg.best || score(row) < score(pg.best)) pg.best = row;
    save();
  }
  const best = pg.best ? { ...pg.best, tried: pg.tried } : { level: lv, concept: p.concept, ok: false, tried: pg.tried };
  fs.appendFileSync(outFile, JSON.stringify(best) + '\n');
  console.log(lv, p.concept, best.g61 ? `family ${best.g61.exp} Dennis ${best.dennis.exp} atTrap ${best.atTrap} room ${best.room.room} ${best.pass ? 'PASS' : '(closest)'}` : 'NONE');
}
}
