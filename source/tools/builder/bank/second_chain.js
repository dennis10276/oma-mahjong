#!/usr/bin/env node
'use strict';
/* second_chain.js: a second chain AFTER the clock (Dennis 2026-11-16: "play around with 2 different chains. 1 clock with locks and
   keys and ice and after more ice and tray pressure and keys and whatever else you can come up with").
   The game has one clock and one key pair per board (www/js/specials.js keys:[a,b]), so the key pair and its locks go to whichever
   chain does not use them.
     const SC = require('./second_chain.js');
     SC.second(design, { seed, tries, wallMs, nodes }) -> { ok, design, chain, caused, tried, notes }
     node source/tools/builder/bank/second_chain.js <board.json> [--seed 1] [--tries 80] [--out file]
   Every candidate puts specials only on tiles taken after the clock on the stored route, so the route still plays; a candidate
   counts when tempting moves after the clock (visible pairs, matches, single twins) now provably lose and did NOT lose on the board
   without it: those losses are caused by the second chain. The first chain is re-proved by the caller (verify_chained_v2). */
const E = require('../engine.js'), D = require('../loop/detour.js');
const clone = x => JSON.parse(JSON.stringify(x));
const rngOf = seed => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const flat = a => typeof a === 'number' ? [a] : a.pair.slice();

function route(d) {
  const g = E.game(d), states = []; let s = E.start(g);
  for (const a of d.solution) { states.push(s); s = E.step(g, s, a); if (!s) return null; }
  return E.won(g, s) ? { g, states } : null;
}
// the stored route up to the clock, then a new winning tail (stored order first, else the first move proven winnable)
function retail(d, cpStep, nodes = 40000) {
  const g = E.game(d), w = D.work(3e6, 20000); let s = E.start(g); const sol = [];
  for (let t = 0; t <= cpStep; t++) { s = E.step(g, s, d.solution[t]); if (!s) return null; sol.push(d.solution[t]); }
  const want = d.solution.slice(cpStep + 1).flatMap(flat), rank = new Map(want.map((i, k) => [i, k]));
  while (!E.won(g, s)) {
    const moves = E.legal(g, s).sort((a, b) => (rank.get(flat(a)[0]) ?? 999) - (rank.get(flat(b)[0]) ?? 999));
    let next = null;
    for (const m of moves) { const s2 = E.step(g, s, m); if (!s2) continue; if (E.won(g, s2) || w.win(g, s2, nodes).result === 'win') { next = [m, s2]; break; } if (w.over()) return null; }
    if (!next) return null; sol.push(next[0]); s = next[1];
  }
  return { ...d, solution: sol };
}
function facts(d) {
  const pos = new Array(d.tiles.length).fill(-1); let k = 0, cpStep = -1;
  d.solution.forEach((a, t) => { for (const i of flat(a)) { pos[i] = k++; if (i === d.clock.i) cpStep = t; } });
  const ob = d.obst || {}, special = new Set([d.clock.i, ...Object.keys(ob.ice || {}).map(Number), ...(ob.locks || []), ...(ob.keys || [])]);
  const down = new Set(d.down || []), gold = new Set(d.gold || []);
  const cp = pos[d.clock.i], tail = [...pos.keys()].filter(i => pos[i] > cp && !special.has(i) && !down.has(i) && !gold.has(i));
  const R = route(d), early = new Set(), tl = d.solution.length - 1 - cpStep;
  for (let t = cpStep + 1; R && t <= cpStep + Math.max(3, Math.floor(tl * .3)) && t < R.states.length; t++) for (const a of E.legal(R.g, R.states[t])) if (typeof a === 'number' && !down.has(a)) early.add(a);
  return { pos, cp, cpStep, tail, special, hasKeys: (ob.keys || []).length > 0, iceNb: E.game(d).iceNb, early: [...early].filter(i => pos[i] > cp) };
}
// ice on host h with k hits that is still frozen when the clock goes and melts on the stored route before h is taken
function iceOk(F, h, k) {
  const nb = F.iceNb[h];
  return nb.filter(j => F.pos[j] < F.pos[h]).length >= k && nb.filter(j => F.pos[j] <= F.cp).length < k;
}
/* hold: the wrong idea after the clock is 'take the free twins as they turn up'. m tiles y are held (locked behind a key pair that
   comes up mid-tail, or frozen until late); each gets a twin x that lies free early in the tail but is taken late on the stored route
   (pictures swapped among tail tiles only). Taking the x's early parks them in the tray until the hold lets go. */
function holdTwins(d, F, rng, ob, add, used, keys, ice) {
  const pick = a => a[Math.floor(rng() * a.length)], T = F.tail, faces = d.faces.slice(), span = T.length, P = F.pos, cp = F.cp;
  const cnt = {}; faces.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
  let release;                                                  // route position after which the held tiles can go
  if (!F.hasKeys && rng() < .6) { const K = keys(); if (!K) return null; ob.locks = []; add.pop(); [K.a, K.b].forEach(i => used.add(i)); release = Math.max(P[K.a], P[K.b]);
    if (release < cp + span * .25 || release > cp + span * .75) return null;
    const Y = T.filter(i => P[i] > release && !used.has(i) && cnt[faces[i]] === 2); if (Y.length < 2) return null;
    const m = 2 + (rng() < .5), ys = []; while (ys.length < Math.min(m, Y.length)) { const y = pick(Y); if (!ys.includes(y)) ys.push(y); }
    ob.locks = ys; ys.forEach(i => used.add(i)); add.push('hold:keys ' + K.a + ',' + K.b + ' locks ' + ys.join(','));
    return twins(ys, release);
  }
  const Y = T.filter(i => !used.has(i) && cnt[faces[i]] === 2 && P[i] > cp + span * .35); if (Y.length < 2) return null;
  const ys = [], m = 2 + (rng() < .5);
  for (let t = 0; t < 40 && ys.length < m; t++) { const y = pick(Y), k = 1 + (rng() < .5); if (!ys.includes(y) && ice(y, k)) ys.push(y); }
  if (ys.length < 2) return null;
  add.push('hold:ice ' + ys.join(','));
  release = Math.min(...ys.map(y => P[y])) - 1;
  return twins(ys, release);
  function twins(ys, rel) {
    const early = F.early.filter(x => !used.has(x) && !F.special.has(x) && P[x] > rel && cnt[faces[x]] === 2 && !ys.includes(x));
    for (const y of ys) {
      const z = T.find(j => j !== y && faces[j] === faces[y]); if (z == null) return null;
      if (F.early.includes(z) && P[z] > rel) { used.add(z); continue; }        // already a free twin taken late
      const xs = early.filter(x => !used.has(x)); if (!xs.length) return null;
      const x = pick(xs); [faces[x], faces[z]] = [faces[z], faces[x]]; used.add(x);
    }
    return { kind: 'hold', add, design: { ...clone(d), faces, obst: ob } };
  }
}
function candidate(d, F, rng) {
  const pick = a => a[Math.floor(rng() * a.length)], ob = clone(d.obst || {}); ob.ice = ob.ice || {};
  const used = new Set(), add = [], T = F.tail;
  const ice = (h, k) => { if (used.has(h) || !iceOk(F, h, k)) return false; ob.ice[h] = k; used.add(h); add.push('ice' + k + ':' + h); return true; };
  const kinds = F.hasKeys ? ['hold', 'hold', 'ice', 'iceIce', 'ice2'] : ['hold', 'hold', 'hold', 'ice', 'iceIce', 'ice2', 'keys', 'iceKey', 'lockedMelter', 'keysIce'];
  const kind = pick(kinds);
  const keys = () => {
    const pairs = []; for (const a of T) for (const b of T) if (a < b && d.faces[a] === d.faces[b]) pairs.push([a, b]);
    if (!pairs.length) return null;
    const [a, b] = pick(pairs), after = Math.max(F.pos[a], F.pos[b]), L = T.filter(i => F.pos[i] > after && i !== a && i !== b && !used.has(i));
    if (!L.length) return null;
    const locks = []; const n = 1 + Math.floor(rng() * Math.min(3, L.length));
    while (locks.length < n) { const l = pick(L); if (!locks.includes(l)) locks.push(l); }
    ob.keys = [a, b]; ob.locks = locks; [a, b, ...locks].forEach(i => used.add(i)); add.push('keys:' + a + ',' + b + ' locks:' + locks.join(','));
    return { a, b, locks };
  };
  let tries = 0;
  const any = k => { for (let t = 0; t < 30; t++) if (ice(pick(T), k)) return true; return false; };
  if (kind === 'hold') return holdTwins(d, F, rng, ob, add, used, keys, ice);
  if (kind === 'ice') { any(1 + (rng() < .5)); }
  else if (kind === 'ice2') { any(1 + (rng() < .5)); any(1 + (rng() < .5)); }
  else if (kind === 'iceIce') {          // the melter of one ice is itself frozen
    for (; tries < 40; tries++) { const h = pick(T), k = 1 + (rng() < .5); if (!ice(h, k)) continue;
      const m = F.iceNb[h].filter(j => F.pos[j] < F.pos[h] && F.pos[j] > F.cp); if (m.length && ice(pick(m), 1 + (rng() < .4))) break; }
  } else {
    const K = keys(); if (!K) return null;
    if (kind === 'iceKey') { const k = rng() < .5 ? K.a : K.b; used.delete(k); ice(k, 1 + (rng() < .5)) || used.add(k); }
    if (kind === 'lockedMelter') {        // an ice whose melting neighbour is locked: the key pair comes first
      for (; tries < 40; tries++) { const h = pick(T); if (used.has(h)) continue; const k = 1 + (rng() < .5);
        if (F.iceNb[h].some(j => K.locks.includes(j)) && ice(h, k)) break; }
    }
    if (kind === 'keysIce') any(1 + (rng() < .5));
  }
  if (!add.length) return null;
  return { kind, add, design: { ...clone(d), obst: ob } };
}
// tempting moves after the clock that lose on `d` but not on `base`
function caused(d, base, F, o) {
  const R = route(d); if (!R) return null;
  const gB = E.game(base), w = D.work(o.totalNodes ?? 4e5, o.wallMs ?? 8000), out = [];
  const tailSteps = d.solution.length - 1 - F.cpStep, hi = F.cpStep + Math.max(2, Math.floor(tailSteps * (o.to ?? 0.75)));
  for (let t = F.cpStep + 1; t <= hi && t < R.states.length; t++) {
    const st = R.states[t];
    for (const mv of D.temptingMoves(R.g, st, { singles: true })) {
      if (mv.peek) continue;
      const s2 = D.playMove(R.g, st, mv); if (!s2) continue;            // a 4th waiting tile is not a fork
      const r = w.win(R.g, s2, o.nodes ?? 30000); if (r.result !== 'lose') continue;
      const b2 = D.playMove(gB, st, mv), rb = b2 ? w.win(gB, b2, o.nodes ?? 30000) : { result: 'lose' };
      if (rb.result === 'win') out.push({ step: t, take: mv.take, kind: mv.kind });
      if (w.over()) return out;
    }
  }
  return out;
}
function shuffleTail(d, F, rng) {
  const keys = new Set((d.obst.keys || [])), T = F.tail.filter(i => !keys.has(i)), faces = d.faces.slice(), n = 2 + Math.floor(rng() * 5);
  for (let k = 0; k < n; k++) { const u = T[Math.floor(rng() * T.length)], v = T[Math.floor(rng() * T.length)]; [faces[u], faces[v]] = [faces[v], faces[u]]; }
  return { ...d, faces };
}
function second(d0, o = {}) {
  const F = facts(d0), rng = rngOf(o.seed ?? 1), t0 = Date.now(), seen = new Set(), notes = [], Tl = require('./tail.js');
  const greedy = d => Tl.measure(d, { seed: 977, playouts: o.playouts ?? 150 }).tailGreedyWin, g0 = greedy(d0);
  let best = null, tried = 0;
  for (let k = 0; k < (o.tries ?? 80) && Date.now() - t0 < (o.wallMs ?? 120000); k++) {
    const c = candidate(d0, F, rng); const st = o.stats || (o.stats = {}); if (!c) { st.none = (st.none || 0) + 1; continue; } st[c.kind] = (st[c.kind] || 0) + 1;
    const key = c.add.slice().sort().join('|'); if (seen.has(key)) continue; seen.add(key); tried++;
    for (let v = 0; v <= (o.shuffles ?? 6); v++) {     // v>0: the same specials with tail pictures swapped (2-6 swaps, key pair kept)
      const dv = v ? shuffleTail(c.design, F, rng) : c.design;
      const dr = route(dv) ? dv : retail(dv, F.cpStep); if (!dr) { st[c.kind + ':route'] = (st[c.kind + ':route'] || 0) + 1; continue; }
      const cz = caused(dr, d0, F, o); if (!cz) { st[c.kind + ':route'] = (st[c.kind + ':route'] || 0) + 1; continue; }
      const g1 = greedy(dr), drop = g0 - g1, steps = new Set(cz.map(x => x.step)).size, score = steps * 3 + Math.min(cz.length, 8) + 10 * drop - c.add.length * 0.5 - (v ? 0.25 : 0);
      if ((cz.length || drop >= .25) && (!best || score > best.score)) best = { ...c, design: dr, swapped: v > 0, caused: cz, steps, score, greedy: [g0, g1] };
    }
  }
  if (!best) return { ok: false, tried, notes };
  return { ok: true, design: best.design, chain: { kind: best.kind, add: best.add, steps: best.steps, swapped: !!best.swapped, greedy: best.greedy }, caused: best.caused, tried, notes };
}
module.exports = { second, candidate, rngOf, retail, caused, facts, route };
if (require.main === module) {
  const a = process.argv.slice(2), arg = (n, v) => { const i = a.indexOf('--' + n); return i < 0 ? v : a[i + 1]; };
  const j = JSON.parse(require('fs').readFileSync(a[0], 'utf8')), d = j.design || j;
  const r = second(d, { seed: +arg('seed', 1), tries: +arg('tries', 80) });
  const o2 = {}; console.log(JSON.stringify({ ok: r.ok, tried: r.tried, chain: r.chain, caused: r.caused && r.caused.length, steps: r.caused && [...new Set(r.caused.map(x => x.step))] }));
  if (r.ok && arg('out')) require('fs').writeFileSync(arg('out'), JSON.stringify({ ...j, design: r.design, secondChain: { chain: r.chain, caused: r.caused } }));
}
