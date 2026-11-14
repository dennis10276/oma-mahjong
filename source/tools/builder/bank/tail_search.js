'use strict';
// Exact tail searches. No story proof, bot, beam, or global engine cache.
// The clock prefix is fixed. Peek pairs are atomic and use no waiting slot.
// An episode starts on entering >=2 waiting from <2; a tray already at >=2
// at the boundary counts as the first episode. Budgets return unknown.
const E = require('../engine.js');

function boundary(design) {
  const g = E.game(design), ci = design.solution.indexOf(design.clock.i);
  if (ci < 0) throw new Error('tail: clock missing from solution');
  let s = E.start(g);
  for (const t of design.solution.slice(0, ci + 1)) {
    s = E.step(g, s, t);
    if (!s) throw new Error('tail: invalid clock prefix');
  }
  return { g, s, prefix: design.solution.slice(0, ci + 1) };
}

function capped(design, cap, opts = {}) {
  if (!Number.isInteger(cap) || cap < 0 || cap > 3) throw new Error('tail: cap must be 0..3');
  const t0 = Date.now(), maxNodes = opts.nodes ?? 200000, ms = opts.ms ?? 2000;
  const maxEpisodes = opts.episodes ?? Infinity, peek = opts.peek !== false;
  const b = opts.fromStart ? { g: E.game(design, { strict: opts.peek === false }), prefix: [] } : boundary(design);
  const { g, prefix } = b, s = b.s || E.start(g), n = g.n, F = g.faces;
  const alive = s.alive.slice(), init = new Uint8Array(n).fill(1);
  const L = global.Layouts, words = new Uint16Array((n + 15) >> 4);
  const tray = s.tray.map(t => F[t]), count = new Map();
  let left = 0, nodes = 0, clockAlive = !s.clockTaken, episodes = !clockAlive && tray.length >= 2 ? 1 : 0;
  const path = [], dead = new Set(), BUDGET = {};
  for (let i = 0; i < n; i++) if (alive[i]) {
    left++; words[i >> 4] |= 1 << (i & 15);
    count.set(F[i], (count.get(F[i]) || 0) + 1);
  }
  const can = i => !!alive[i] && (g.rules ? L.takeable(i, alive, g.nb, g.rules, init) : L.isFree(i, alive, g.nb));
  const rm = i => { alive[i] = 0; left--; words[i >> 4] ^= 1 << (i & 15); count.set(F[i], count.get(F[i]) - 1); };
  const put = i => { alive[i] = 1; left++; words[i >> 4] ^= 1 << (i & 15); count.set(F[i], count.get(F[i]) + 1); };
  const key = () => String.fromCharCode(...words) + '|' + tray.slice().sort((a, b) => a - b).join(',') + (maxEpisodes === Infinity ? '' : '#' + (maxEpisodes - episodes));
  function rec() {
    if (tray.length > (clockAlive ? 3 : cap) || episodes > maxEpisodes) return false;
    if (!left) return tray.length === 0;
    if (++nodes > maxNodes || ((nodes & 127) === 0 && Date.now() - t0 >= ms)) throw BUDGET;
    const k = key(); if (dead.has(k)) return false;
    // Before the clock, preserve the game's full tray and actual deadline.
    // The bound counts required removals, not search depth or mouse taps.
    if (clockAlive && (n - left >= g.clock.n || n - left + g.lb(alive) > g.clock.n + (peek ? 1 : 0))) { dead.add(k); return false; }
    const free = []; for (let i = 0; i < n; i++) if (can(i)) free.push(i);
    const pairs = [];
    if (peek) for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) {
      const i = free[a], j = free[b];
      if (F[i] === F[j] && !tray.includes(F[i]) && (g.down[i] || g.down[j])) pairs.push([i, j]);
    }
    // A complete, unique, atomic pair can only uncover/unlock/thaw tiles.
    // Taking it now cannot increase waiting or the episode count.
    const safePair = clockAlive || opts.shortcuts === false ? null : pairs.find(([i]) => count.get(F[i]) === 2);
    let acts;
    if (safePair) acts = [safePair];
    else {
      const matches = free.filter(i => tray.includes(F[i]));
      // With no atomic pair available, >=2 waiting must drop on the next
      // action under cap 2. A unique match commutes with later removals.
      const unique = matches.find(i => count.get(F[i]) === 1);
      if (!clockAlive && opts.shortcuts !== false && unique !== undefined && (maxEpisodes === Infinity || tray.length < 2 || (cap <= 2 && !pairs.length))) acts = [unique];
      else {
        acts = matches.concat(pairs);
        if (tray.length < (clockAlive ? 3 : cap)) acts.push(...free.filter(i => !tray.includes(F[i])).sort((a, b) => (g.toClock[b] || 0) - (g.toClock[a] || 0)));
      }
      // A free complete face-up pair from an empty tray costs no episode.
      // Remove it before branching over permutations of unrelated pairs.
      if (!clockAlive && opts.shortcuts !== false && !tray.length && cap >= 1) {
        const p = free.find(i => count.get(F[i]) === 2 && free.some(j => j !== i && F[i] === F[j]));
        if (p !== undefined) acts = [p];
      }
    }
    for (const act of acts) {
      const wasClockAlive = clockAlive, prevEpisodes = episodes, before = tray.length, moves = n - left;
      const hasClock = clockAlive && (Array.isArray(act) ? act.includes(g.clock.i) : act === g.clock.i);
      // checkClock runs after the whole atomic action. The clock action
      // must start before n; singles use that same deadline.
      if (clockAlive && !hasClock && moves + (Array.isArray(act) ? 2 : 1) >= g.clock.n) continue;
      if (hasClock) clockAlive = false;
      if (Array.isArray(act)) {
        rm(act[0]); rm(act[1]); path.push({ pair: act });
        if (hasClock && tray.length >= 2) episodes++;
        if (rec()) return true;
        path.pop(); put(act[1]); put(act[0]);
      } else {
        const f = F[act], q = tray.indexOf(f);
        if (q < 0) tray.push(f); else tray.splice(q, 1);
        if (!clockAlive && (hasClock || before < 2) && tray.length >= 2) episodes++;
        rm(act); path.push(act);
        if (rec()) return true;
        path.pop(); put(act);
        if (q < 0) tray.pop(); else tray.splice(q, 0, f);
      }
      clockAlive = wasClockAlive; episodes = prevEpisodes;
    }
    dead.add(k); return false;
  }
  let result;
  try { result = rec() ? 'win' : 'lose'; } catch (e) { if (e !== BUDGET) throw e; result = 'unknown'; }
  return { result, cap, peek, nodes, ms: Date.now() - t0, startWaiting: s.tray.length,
    ...(maxEpisodes !== Infinity ? { episodeLimit: maxEpisodes } : {}),
    ...(result === 'win' ? { episodes, path: path.slice(), solution: prefix.concat(E.flatten(path)) } : {}) };
}

function forced(design, opts = {}) {
  opts = { ...opts, fromStart: opts.scope === 'board' || opts.fromStart };
  const cap1 = capped(design, 1, opts), cap2 = capped(design, 2, opts);
  const target = opts.moments ?? 3, limits = [];
  let minEpisodes = null, lower = cap1.result === 'lose' ? 1 : 0;
  if (cap1.result === 'win') minEpisodes = 0;
  else if (cap2.result === 'win') {
    const hi = Math.min(target - 1, cap2.episodes - 1);
    for (let e = lower; e <= hi; e++) {
      const r = capped(design, 2, { ...opts, episodes: e });
      limits.push(r);
      if (r.result === 'lose') lower = e + 1;
      else { if (r.result === 'win' && lower === e) minEpisodes = e; break; }
    }
    if (minEpisodes === null && lower === cap2.episodes) minEpisodes = lower;
  }
  const slim = r => { const { path, solution, ...facts } = r; return facts; };
  return { schema: 'forced-tail-v1', boundary: opts.fromStart ? 'all legal clock prefixes (board-wide)' : 'after stored clock prefix', rules: opts.peek === false ? 'strict' : 'game (atomic peek pairs)',
    cap1: slim(cap1), cap2: slim(cap2), episodes: { definition: 'entries into >=2 waiting, including the starting tray',
      lowerBound: lower, minimum: minEpisodes, upperBound: cap2.result === 'win' ? cap2.episodes : null, tests: limits.map(slim) },
    targetMet: cap1.result === 'lose' && cap2.result === 'win' && lower >= target,
    ...(cap2.result === 'win' ? { solution: cap2.solution, path: cap2.path } : {}) };
}
module.exports = { boundary, capped, forced };
