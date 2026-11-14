'use strict';
/* feel.js: the tray pressure a sensible player FEELS after the trap.
   Dennis 2026-11-14 (lab 8, 302 and 303): "I didnt feel the tray pressure after the trap ... make it at least 2 instead of the 1 now."
   The earlier measures missed that: the stored route is not the player's route, a careless (random) player is not Dennis, and "the board
   cannot be cleared with fewer than two waiting" (tail_search.js) is met by brief moments that a good player hardly notices.
   So: play the part after the clock many times as a sensible player and look at how full the tray is while they play.
     The sensible player: takes a tile that matches the tray; else a free pair (both tiles in one go: a tile on its way to its free twin
     is not "waiting"); else has to put a single in the tray and picks the one whose twin is nearest to coming free (twins they cannot
     see count as far away), with a little randomness. Face-down tiles are known once they are free.
   feel(design, {playouts, seed}) -> { win, waiting: [share of decisions with 0,1,2,3 waiting], mean, twoPlus, singles, steps }
     waiting is counted at every decision in the tail (before the action), over all playouts; twoPlus = share with 2 or 3 waiting;
     singles = how many times per playout the player had to park a tile.                                                              */
const Tl = require('./tail.js'), L = require('../../../www/layouts.js');
const SLOTS = L.SLOTS;
function rngOf(seed) { let s = seed >>> 0; return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function feel(design, opts = {}) {
  const P = Tl.prepare(design), F = design.faces, n = P.n, rand = rngOf((opts.seed ?? 1) * 2654435761 + 7), playouts = opts.playouts ?? 300;
  const g = P.g, init = new Uint8Array(n).fill(1);
  const can = (alive, i) => !!alive[i] && (g.rules ? L.takeable(i, alive, g.nb, g.rules, init) : L.isFree(i, alive, g.nb));
  // the tray at the clock, along the stored route
  const start = P.alive.slice(), tray0 = [];
  { const a = new Uint8Array(n).fill(1); for (const t of design.solution.slice(0, P.ci + 1)) { a[t] = 0; const q = tray0.findIndex(x => F[x] === F[t]); if (q >= 0) tray0.splice(q, 1); else tray0.push(t); } }
  const hist = [0, 0, 0, 0]; let wins = 0, steps = 0, singles = 0;
  const depth = (alive, j) => { const seen = new Set(), todo = [j]; while (todo.length) for (const k of g.nb.above[todo.pop()]) if (alive[k] && !seen.has(k)) { seen.add(k); todo.push(k); } return seen.size + (seen.size === 0 && !L.isFree(j, alive, g.nb) ? 1 : 0); };
  for (let p = 0; p < playouts; p++) {
    const alive = start.slice(), tray = tray0.slice(), known = new Uint8Array(n); for (let i = 0; i < n; i++) known[i] = P.down[i] ? 0 : 1;
    let left = 0; for (let i = 0; i < n; i++) left += alive[i];
    let ok = true;
    while (left > 0) {
      const free = []; for (let i = 0; i < n; i++) if (can(alive, i)) { free.push(i); known[i] = 1; }
      if (!free.length) { ok = false; break; }
      hist[Math.min(3, tray.length)]++; steps++;
      const trayF = new Set(tray.map(x => F[x])), m = free.filter(i => trayF.has(F[i]));
      if (m.length) { const t = m[Math.floor(rand() * m.length)]; alive[t] = 0; left--; tray.splice(tray.findIndex(x => F[x] === F[t]), 1); continue; }
      const by = new Map(); for (const i of free) { if (!by.has(F[i])) by.set(F[i], []); by.get(F[i]).push(i); }
      const pairs = []; for (const v of by.values()) if (v.length >= 2) pairs.push([v[0], v[1]]);
      const okPairs = pairs.filter(([a, b]) => tray.length <= SLOTS - 2 || P.down[a] || P.down[b]);
      if (okPairs.length) { const [a, b] = okPairs[Math.floor(rand() * okPairs.length)]; alive[a] = 0; alive[b] = 0; left -= 2; continue; }
      if (tray.length >= SLOTS - 1) { ok = false; break; }                 // a fourth tile would lose
      // park a single: the one whose twin comes free soonest
      let best = [], bestC = Infinity;
      for (const i of free) {
        let c = Infinity; for (let j = 0; j < n; j++) if (j !== i && alive[j] && F[j] === F[i]) c = Math.min(c, known[j] ? depth(alive, j) : 6);
        c += rand() * 1.5;                                                   // a person is not exact
        if (c < bestC - 1e-9) { bestC = c; best = [i]; } else if (Math.abs(c - bestC) < 1e-9) best.push(i);
      }
      const t = best[Math.floor(rand() * best.length)]; alive[t] = 0; left--; tray.push(t); singles++;
    }
    if (ok && tray.length === 0) wins++;
  }
  const sh = hist.map(x => steps ? +(x / steps).toFixed(3) : 0);
  return { win: +(wins / playouts).toFixed(3), waiting: sh, mean: steps ? +((hist[1] + 2 * hist[2] + 3 * hist[3]) / steps).toFixed(2) : 0, twoPlus: +(sh[2] + sh[3]).toFixed(3), singles: +(singles / playouts).toFixed(1), steps: Math.round(steps / playouts) };
}
module.exports = { feel };
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  for (const dir of process.argv.slice(2)) for (const f of fs.readdirSync(dir).filter(f => /^level-\d+\.json$/.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), r = feel(j.design);
    console.log(f.replace('.json', ''), (j.source || (j.card && j.card.shape) || '').slice(0, 26).padEnd(26), 'win', r.win, 'waiting 0/1/2/3', r.waiting.join('/'), 'mean', r.mean, '2+', r.twoPlus);
  }
}

/* expert(design): the same question for a player who never blunders but plays naturally (Dennis clears these boards in one or two tries,
   the sensible player above loses most of them, so its numbers are mostly about dying). At every decision after the clock the expert takes,
   in this order of preference, a tile matching the tray, a free pair, or parks a single (the one whose twin comes free soonest) - but never
   an action after which the board is proven lost (exact engine). Reported over whole won games:
     waiting [0,1,2,3] share of decisions, mean, twoPlus; parks per game; danger = share of decisions where a natural-looking action
     (the preferred kind) would have lost; lostGames = playouts where the budget ran out or no safe action was found. */
function expert(design, opts = {}) {
  const E = require('../engine.js'), g = E.game(structuredClone(design)), F = g.faces, n = g.n;
  const rand = rngOf((opts.seed ?? 1) * 2654435761 + 3), playouts = opts.playouts ?? 20, per = { nodes: opts.nodes ?? 30000, ms: opts.ms ?? 300 };
  let s0 = E.start(g); const ci = design.solution.indexOf(design.clock.i); for (const t of design.solution.slice(0, ci + 1)) s0 = E.step(g, s0, t);
  const hist = [0, 0, 0, 0]; let steps = 0, parks = 0, danger = 0, lost = 0, done = 0; const parkAt = [0, 0, 0]; let wrongSum = 0, wrongN = 0;
  const depth = (alive, j) => { const seen = new Set(), todo = [j]; while (todo.length) for (const k of g.nb.above[todo.pop()]) if (alive[k] && !seen.has(k)) { seen.add(k); todo.push(k); } return seen.size; };
  const safe = s2 => E.winnable(g, s2, per).result !== 'lose';
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  for (let p = 0; p < playouts; p++) {
    let s = s0, ok = true; const h = [0, 0, 0, 0], pa = [0, 0, 0]; let st = 0, pk = 0, dg = 0, ws = 0, wn = 0;
    while (!E.won(g, s)) {
      const free = E.legal(g, s).filter(a => typeof a !== 'object'), trayF = new Set(s.tray.map(x => F[x]));
      if (!free.length) { ok = false; break; }
      h[Math.min(3, s.tray.length)]++; st++;
      const tryStep = acts => { try { let x = s; for (const a of acts) x = E.step(g, x, a); return x; } catch (e) { return null; } };
      const matches = shuffle(free.filter(i => trayF.has(F[i]))).map(i => [i]);
      const by = new Map(); for (const i of free) if (!trayF.has(F[i])) { if (!by.has(F[i])) by.set(F[i], []); by.get(F[i]).push(i); }
      const pairs = []; for (const v of by.values()) for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) pairs.push(g.down[v[a]] || g.down[v[b]] ? [{ pair: [v[a], v[b]] }] : [v[a], v[b]]);
      shuffle(pairs);
      const singles = free.filter(i => !trayF.has(F[i])).map(i => { let c = 9; for (let j = 0; j < n; j++) if (j !== i && s.alive[j] && F[j] === F[i] && !g.down[j]) c = Math.min(c, depth(s.alive, j)); return [i, c + rand() * 1.5]; }).sort((a, b) => a[1] - b[1]).map(x => [x[0]]);
      let next = null, first = true;
      for (const cls of [matches, pairs, singles]) {
        if (!cls.length) continue;
        let bad = 0;
        for (const acts of cls) { const s2 = tryStep(acts); if (s2 && safe(s2)) { next = s2; if (cls === singles) { pk++; pa[Math.min(2, s.tray.length)]++; } break; } bad++; }
        // at a park: how many of the tiles that could be parked lose the game (a choice that matters)
        if (cls === singles && next && cls.length > 1 && opts.wrong !== false) { let w = 0; for (const acts of cls) { const s2 = tryStep(acts); if (!s2 || !safe(s2)) w++; } ws += w / cls.length; wn++; }
        if (first && bad) dg++;
        first = false;
        if (next) break;
      }
      if (!next) { ok = false; break; }
      s = next;
    }
    if (!ok) { lost++; continue; }
    done++; for (let i = 0; i < 4; i++) hist[i] += h[i]; for (let i = 0; i < 3; i++) parkAt[i] += pa[i]; steps += st; parks += pk; danger += dg; wrongSum += ws; wrongN += wn;
  }
  const sh = hist.map(x => steps ? +(x / steps).toFixed(3) : 0);
  return { games: done, lostGames: lost, waiting: sh, mean: steps ? +((hist[1] + 2 * hist[2] + 3 * hist[3]) / steps).toFixed(2) : 0, twoPlus: +(sh[2] + sh[3]).toFixed(3), parks: done ? +(parks / done).toFixed(1) : 0, parkAt: parkAt.map(x => done ? +(x / done).toFixed(1) : 0), wrongPark: wrongN ? +(wrongSum / wrongN).toFixed(2) : 0, danger: steps ? +(danger / steps).toFixed(3) : 0, decisions: done ? Math.round(steps / done) : 0 };
}
module.exports.expert = expert;
