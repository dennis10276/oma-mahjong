/* detour.js: priced temptations and fair lose-forks on the way to the clock (gates A5 and A6).
   Process design section 4, table A (analysis/builder/process-design-synthesis.md). Claude, 2026-11-07.

   Clock need from a state. clockNeed(C, s) = the smallest clock.n with which the board can still be won from state s
   (engine.winnable on a copy of the design whose only change is clock.n). From the opening this is
   engine.clockShortest's k; it is the same measure from any later state. The search starts at
   s.moves + the engine's admissible lower bound and steps up one n at a time, so a 'win' at n after proven
   'lose' below it is exact. 'unknown' (budget) is never read as a loss.

   Tempting move at a state (visible, off the clock's way: not the clock and not on engine game.toClock):
     pair  - two free face-up tiles with the same picture, picture not waiting (taken as two singles), or a peek
             pair {pair:[i, j]} (flagged peek: true);
     match - a free tile whose picture is waiting in the tray;
     single (opt-in, options.singles) - a free face-up tile whose twin is in sight but not takeable (engine kindOf 'twin').
   Its cost = clockNeed after the move - clockNeed before it: how many spare clock moves the detour burns.
   result: 'win' when the board can still be won within the loosest shippable clock (k + 3, at most 19),
   'lose' when it is proven lost at every n up to there, else 'unknown'.

   Fair lose-fork (A6). A tempting move that loses at every shippable spare must
     - still lose, with a goal-directed winning alternative (obvious.js), under K re-deals of the pictures of the
       face-down tiles the player has not seen yet (never free so far on the witness), the identity included.
       A deal under which the board is lost from that state whatever the player does is not the fork's fault:
       it is counted as luck (checks.dealsLostAnyway) and reported, not failed;
     - lose within `forcedWithin` (6) more removals (engine.longest);
     - be offered while at least 60% of the tiles are left.

     const D = require('./detour.js');
     D.clockGames(design)                         -> C (design copies per clock.n, engine games cached)
     D.clockNeed(C, s, { upTo, nodes, ms, until })-> { k, exact } | { k: null, lost: bool }
     D.temptingMoves(g, s, { singles })           -> [{ kind, take: [i] | [i, j], act?, peek? }]
     D.priceMove(C, s, t, { base, nShipMax, ... })-> { cost, result, need, exact }
     D.permuteHidden(design, tiles, rng)          -> design copy with the pictures of `tiles` shuffled among them
     D.fairFork(C, s, t, { unseen, perms, seed, nShipMax, forcedWithin, minLeft }) -> { fair, checks, why, unknown }
   Engine only, no bots. */
'use strict';
const E = require('../engine.js');
const O = require('./obvious.js');

const rngOf = seed => { let x = (seed >>> 0) || 1; return () => (x = (x * 1103515245 + 12345) >>> 0) / 4294967296; };
const takesOf = t => t.act && typeof t.act === 'object' ? t.act.pair : t.take;

// design copies that differ only in clock.n, each with its own cached engine game (proof memo reused across states)
function clockGames(design) {
  const by = new Map();
  const at = n => {
    if (!by.has(n)) { const d = { ...design, clock: { ...design.clock, n } }; by.set(n, E.game(d)); }
    return by.get(n);
  };
  return { design, at, free: at(999) };
}
function clockNeed(C, s, o = {}) {
  const g = C.free, upTo = o.upTo ?? 30, per = { nodes: o.nodes ?? 60000, ms: o.ms ?? 300 };
  if (s.clockTaken) {
    const r = E.winnable(g, s, per);
    return r.result === 'win' ? { k: 0, exact: true, clockTaken: true } : { k: null, lost: r.result === 'lose', exact: r.result === 'lose', clockTaken: true };
  }
  let n = Math.max(s.moves + 1, s.moves + g.lb(s.alive)), exact = true;
  for (; n <= upTo; n++) {
    if (o.until && Date.now() > o.until) return { k: null, lost: false, exact: false, budget: true, from: n };
    const r = E.winnable(C.at(n), s, per);
    if (r.result === 'win') return { k: n, exact };
    if (r.result === 'unknown') exact = false;
  }
  return { k: null, lost: exact, exact, beyond: upTo };
}
function temptingMoves(g, s, o = {}) {
  const F = g.faces, waiting = new Set(s.tray.map(t => F[t])), out = [];
  const onWay = i => (g.clock && i === g.clock.i && !s.clockTaken) || (!s.clockTaken && g.toClock[i] === 1);
  const legal = E.legal(g, s), singles = legal.filter(a => typeof a === 'number');
  for (const i of singles) if (!onWay(i) && waiting.has(F[i])) out.push({ kind: 'match', take: [i] });
  for (let a = 0; a < singles.length; a++) for (let b = a + 1; b < singles.length; b++) {
    const i = singles[a], j = singles[b];
    if (F[i] === F[j] && !g.down[i] && !g.down[j] && !waiting.has(F[i]) && !onWay(i) && !onWay(j)) out.push({ kind: 'pair', take: [i, j] });
  }
  for (const a of legal) if (typeof a === 'object' && !onWay(a.pair[0]) && !onWay(a.pair[1])) out.push({ kind: 'pair', take: a.pair.slice(), act: a, peek: true });
  if (o.singles) for (const i of singles) if (!onWay(i) && !g.down[i] && !waiting.has(F[i]) && E.kindOf(g, s, i) === 'twin') out.push({ kind: 'single', take: [i] });
  return out;
}
// play a tempting move on the no-deadline game: null when it loses at once (a 4th waiting tile)
function playMove(g, s, t) {
  if (t.act) return E.step(g, s, t.act);
  let x = s;
  for (const i of t.take) { x = x && E.step(g, x, i); if (!x) return null; }
  return x;
}
function priceMove(C, s, t, o = {}) {
  const nShipMax = o.nShipMax, base = o.base ?? clockNeed(C, s, { ...o, upTo: nShipMax }).k;
  const s2 = playMove(C.free, s, t);
  if (!s2) return { cost: null, result: 'lose', instant: true, after: null };
  const need = clockNeed(C, s2, { ...o, upTo: nShipMax });
  const cost = need.k != null && base != null ? need.k - base : null;
  const result = need.k != null ? 'win' : need.lost ? 'lose' : 'unknown';
  return { cost, result, need: need.k, exact: !!need.exact, after: s2 };
}
function permuteHidden(design, tiles, rng) {
  const faces = design.faces.slice(), pics = tiles.map(i => faces[i]);
  for (let i = pics.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pics[i], pics[j]] = [pics[j], pics[i]]; }
  tiles.forEach((i, k) => { faces[i] = pics[k]; });
  return { ...design, faces };
}
// K distinct re-deals (the identity first); fewer when the hidden pictures allow fewer
function redeals(design, tiles, perms, seed) {
  const rng = rngOf(seed), out = [design], seen = new Set([tiles.map(i => design.faces[i]).join(',')]);
  for (let tries = 0; out.length < perms && tries < perms * 8 && tiles.length > 1; tries++) {
    const d = permuteHidden(design, tiles, rng), key = tiles.map(i => d.faces[i]).join(',');
    if (!seen.has(key)) { seen.add(key); out.push(d); }
  }
  return out;
}
function fairFork(C, s, t, o = {}) {
  const nShipMax = o.nShipMax, per = { nodes: o.nodes ?? 60000, ms: o.ms ?? 300 }, forcedWithin = o.forcedWithin ?? 6, minLeft = o.minLeft ?? 0.6;
  const n = C.design.tiles.length, left = s.alive.reduce((a, b) => a + b, 0), checks = { tilesLeft: +(left / n).toFixed(3) };
  const why = [];
  let unknown = false, luck = 0;
  if (left / n < minLeft) why.push(`offered with ${Math.round(100 * left / n)}% of tiles left (< ${Math.round(100 * minLeft)}%)`);
  // how soon the loss shows: the most removals a player can still make after the move (cap forcedWithin + 1)
  const gMax = C.at(nShipMax), s2 = playMove(C.free, s, t);
  if (s2 && !(s2.moves >= nShipMax && !s2.clockTaken)) {
    const d = E.longest(gMax, s2, forcedWithin + 1);
    checks.forcedDepth = d.depth; if (!d.exact) checks.depthMin = true;
    if (d.depth > forcedWithin) why.push(`the loss shows only after ${d.depth}+ more removals (> ${forcedWithin})`);
  } else checks.forcedDepth = 0;
  // the same fork under re-deals of the pictures nobody has seen yet
  const dealt = redeals(C.design, o.unseen || [], o.perms ?? 4, o.seed ?? 1);
  checks.perms = dealt.length; checks.permResults = [];
  const memo = o.memo || new Map(), stateKey = Array.from(s.alive).join('') + '|' + s.tray.join(',');
  const big = { nodes: o.boardNodes ?? 150000, ms: o.boardMs ?? 600 };
  for (const d of dealt) {
    if (o.until && Date.now() > o.until) { unknown = true; checks.permResults.push({ budget: true }); continue; }
    const dealKey = d.faces.join(',');
    if (!memo.has('g' + dealKey)) memo.set('g' + dealKey, d === C.design ? gMax : E.game({ ...d, clock: { ...d.clock, n: nShipMax } }));
    const gp = memo.get('g' + dealKey);
    const cached = (key, f) => { const k2 = dealKey + '#' + stateKey + '#' + key; if (!memo.has(k2)) memo.set(k2, f()); return memo.get(k2); };
    const t2 = playMove(gp, s, t), tr = t2 ? E.winnable(gp, t2, per).result : 'lose';
    const set = cached('set', () => O.obviousMoves(gp, s));
    const alts = E.legal(gp, s).filter(a => !sameTake(a, t) && O.isObvious(gp, s, a, { set }).obvious);
    let alt = null, altUnknown = false;
    for (const a of alts.slice(0, o.maxAlts ?? 8)) {
      const r = cached(JSON.stringify(a), () => { const x = E.step(gp, s, a); return !x ? 'lose' : E.won(gp, x) ? 'win' : E.winnable(gp, x, per).result; });
      if (r === 'win') { alt = a; break; }
      if (r === 'unknown') altUnknown = true;
    }
    // no obvious winning alternative: is the board still winnable from here under this deal at all?
    let board = null;
    if (alt == null) {
      const r = cached('board', () => E.winnable(gp, s, big));
      board = r.result === 'win' && r.path ? { win: r.path[0] } : r.result;
    }
    checks.permResults.push({ tempting: tr, alternative: alt != null ? alt : altUnknown ? 'unknown' : null, ...(board != null ? { board } : {}) });
    if (tr === 'win') why.push('the tempting move wins under another deal of the hidden pictures (luck, not a readable fork)');
    if (tr === 'unknown') unknown = true;
    if (alt != null) continue;
    if (board === 'lose') luck++;
    else if (board === 'unknown') unknown = true;
    else {
      const first = board.win, firstObvious = !sameTake(first, t) && O.isObvious(gp, s, first, { set }).obvious;
      if (firstObvious) { checks.permResults[checks.permResults.length - 1].alternative = first; continue; }
      // unfair only when every obvious alternative was tried and proven lost
      if (altUnknown || alts.length > (o.maxAlts ?? 8)) unknown = true;
      else why.push('the only winning moves are not goal-directed (obvious.js) under some deal');
    }
  }
  if (luck) checks.dealsLostAnyway = luck;
  const uniq = [...new Set(why)];
  return { fair: uniq.length === 0 && !unknown, unfair: uniq.length > 0, unknown: uniq.length === 0 && unknown, why: uniq, luck, checks };
}
const sameTake = (a, t) => {
  const tk = typeof a === 'object' ? a.pair : [a], tt = takesOf(t);
  return tk.length === 1 ? tt[0] === tk[0] && !t.act : !!t.act && tk[0] === tt[0] && tk[1] === tt[1];
};
module.exports = { clockGames, clockNeed, temptingMoves, playMove, priceMove, permuteHidden, redeals, fairFork, rngOf };
