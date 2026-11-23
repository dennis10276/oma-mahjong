/* detour.js: priced temptations on the way to the clock (gate A5), and the node-budgeted engine calls the static
   gates share. Process design section 4, table A (analysis/builder/process-design-synthesis.md). Claude, 2026-11-07.

   Budgets are counted in engine search nodes, not milliseconds, so the same board gives the same verdicts on a
   free PC and on a busy one (the engine's own ms limits are set far out, SAFE_MS, as a hang guard only). A tracker
   w = work(nodes, wallMs) hands out nodes until its total is spent; every call made after that returns 'unknown'
   with budget: true. 'unknown' (budget) is never read as a loss anywhere in this file.

   Clock need from a state. clockNeed(C, s) = the smallest clock.n with which the board can still be won from s
   (engine.winnable on a copy of the design whose only change is clock.n). From the opening this is
   engine.clockShortest's k; along a fastest witness it stays k. The search starts at s.moves + the engine's
   admissible lower bound and steps up one n at a time, so a 'win' at n after proven 'lose' below it is exact.

   Tempting move at a state (visible, off the clock's way: not the clock, not on engine game.toClock):
     pair  - two free face-up tiles with the same picture, picture not waiting (taken as two singles);
             a peek pair {pair:[i, j]} is listed too, flagged peek: true (a face-down tile is involved);
     match - a free face-up tile whose picture is waiting in the tray (a free face-down one is flagged peek: true);
     single (opt-in, options.singles) - a free face-up tile whose twin is in sight but not takeable (engine 'twin').
   Its cost = clockNeed after the move - clockNeed before it: how many spare clock moves the detour burns.
   result: 'win' when the board can still be won within the loosest shippable clock (k + 3, at most 19),
   'lose' when it is proven lost at every n up to there, else 'unknown'.

     const D = require('./detour.js');
     D.work(nodes, wallMs)                        -> tracker { win, longest, classify, used, hit, wallHit }
     D.clockGames(design)                         -> C (design copies per clock.n, engine games cached)
     D.clockNeed(C, s, { upTo, nodes, w })        -> { k, exact } | { k: null, lost: bool, exact }
     D.temptingMoves(g, s, { singles })           -> [{ kind, take: [i] | [i, j], act?, peek? }]
     D.playMove(g, s, t)                          -> state after the tempting move, null if it loses at once
     D.priceMove(C, s, t, { base, nShipMax, nodes, w }) -> { cost, result, need, exact, after, instant? }
   Engine only, no bots. */
'use strict';
const E = require('../engine.js');

const SAFE_MS = 30000;   // per engine call: a hang guard only; the node budgets decide

// ---------- the node-budget tracker ----------
function work(total = Infinity, wallMs = Infinity) {
  const w = { total, used: 0, t0: Date.now(), wallMs, hit: false, wallHit: false, calls: 0 };
  w.left = () => Math.max(0, w.total - w.used);
  w.over = () => {
    if (w.used >= w.total) w.hit = true;
    if (Date.now() - w.t0 > w.wallMs) w.wallHit = true;
    return w.hit || w.wallHit;
  };
  // engine.winnable on at most `nodes` nodes of this tracker
  w.win = (g, s, nodes) => {
    if (w.over()) return { result: 'unknown', budget: true, nodes: 0 };
    const cap = Math.min(nodes, w.left()), r = E.winnable(g, s, { nodes: cap, ms: SAFE_MS });
    w.used += Math.min(r.nodes || 0, cap); w.calls++;
    return r.result === 'unknown' && cap < nodes ? { ...r, budget: true } : r;
  };
  // engine.longest charges its whole node cap (it does not report what it used)
  w.longest = (g, s, cap, nodes) => {
    if (w.over()) return { depth: cap, exact: false, budget: true };
    w.used += nodes; w.calls++;
    return E.longest(g, s, cap, nodes);
  };
  // engine.classify without the loss depth, every 'winnable' drawn from this tracker
  w.classify = (g, s, nodes) => E.legal(g, s).map(move => {
    const s2 = E.step(g, s, move);
    if (!s2) return { move, result: 'lose' };
    if (E.won(g, s2)) return { move, result: 'win' };
    const r = w.win(g, s2, nodes);
    return { move, result: r.result, ...(r.budget ? { budget: true } : {}) };
  });
  return w;
}

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
  const g = C.free, upTo = o.upTo ?? 30, nodes = o.nodes ?? 60000, w = o.w || work();
  if (s.clockTaken) {
    const r = w.win(g, s, nodes);
    return r.result === 'win' ? { k: 0, exact: true, clockTaken: true } : { k: null, lost: r.result === 'lose', exact: r.result === 'lose', clockTaken: true };
  }
  let n = Math.max(s.moves + 1, s.moves + g.lb(s.alive)), exact = true;
  for (; n <= upTo; n++) {
    const r = w.win(C.at(n), s, nodes);
    if (r.result === 'win') return { k: n, exact };
    if (r.result === 'unknown') exact = false;
  }
  return { k: null, lost: exact, exact, beyond: upTo };
}
function temptingMoves(g, s, o = {}) {
  const F = g.faces, waiting = new Set(s.tray.map(t => F[t])), out = [];
  const onWay = i => !s.clockTaken && g.clock && (i === g.clock.i || g.toClock[i] === 1);
  const legal = E.legal(g, s), singles = legal.filter(a => typeof a === 'number');
  for (const i of singles) if (!onWay(i) && waiting.has(F[i])) out.push({ kind: 'match', take: [i], ...(g.down[i] ? { peek: true } : {}) });
  for (let a = 0; a < singles.length; a++) for (let b = a + 1; b < singles.length; b++) {
    const i = singles[a], j = singles[b];
    if (F[i] === F[j] && !g.down[i] && !g.down[j] && !waiting.has(F[i]) && !onWay(i) && !onWay(j)) out.push({ kind: 'pair', take: [i, j] });
  }
  for (const a of legal) if (typeof a === 'object' && !onWay(a.pair[0]) && !onWay(a.pair[1])) out.push({ kind: 'pair', take: a.pair.slice(), act: a, peek: true });
  if (o.singles) for (const i of singles) if (!onWay(i) && !g.down[i] && !waiting.has(F[i]) && E.kindOf(g, s, i) === 'twin') out.push({ kind: 'single', take: [i] });
  return out;
}
// play a tempting move: null when it loses at once (a 4th waiting tile, or the clock ran out)
function playMove(g, s, t) {
  if (t.act) return E.step(g, s, t.act);
  let x = s;
  for (const i of t.take) { x = x && E.step(g, x, i); if (!x) return null; }
  return x;
}
function priceMove(C, s, t, o = {}) {
  const nShipMax = o.nShipMax, base = o.base ?? clockNeed(C, s, { ...o, upTo: nShipMax }).k;
  const s2 = playMove(C.free, s, t);
  if (!s2) return { cost: null, result: 'lose', instant: true, exact: true, after: null };
  const need = clockNeed(C, s2, { ...o, upTo: nShipMax });
  const cost = need.k != null && base != null ? need.k - base : null;
  const result = need.k != null ? 'win' : need.lost ? 'lose' : 'unknown';
  return { cost, result, need: need.k, exact: !!need.exact, after: s2 };
}
// Profile visible opening choices that lose for different reasons. Continuation
// is a proved count capped at five tile removals, not a prediction of play.
const OPENING_DELAY = 5;

function openingChoices(g) {
  const free = E.legal(g, E.start(g)).filter(i => Number.isInteger(i) && !g.down[i]);
  const groups = new Map();
  for (const i of free) {
    if (i === g.clock.i) continue;
    const face = g.faces[i];
    if (!groups.has(face)) groups.set(face, []);
    groups.get(face).push(i);
  }
  return [
    ...(free.includes(g.clock.i) ? [{ take: [g.clock.i], kind: 'early-clock' }] : []),
    ...[...groups.values()].flatMap(tiles => tiles.flatMap((i, at) =>
      tiles.slice(at + 1).map(j => ({ take: [i, j], kind: 'late-pair' })))),
  ];
}

// Mark a visible frozen target when the pair supplies a melter or
// removes a roof on the way to one. A tile below that ice cannot thaw it first.
function openingIceGoals(g, take) {
  if (!g.iceH.some(Boolean)) return [];
  const { measure } = require('../chained_special_readability.js');
  const visible = measure({ ...g.design, down: g.design.down || [] }).rows
    .filter(row => row.kind === 'ice' && row.clear);
  const covers = tile => {
    const seen = new Set();
    const todo = [...g.nb.above[tile]];
    while (todo.length) {
      const above = todo.pop();
      if (seen.has(above)) continue;
      seen.add(above);
      todo.push(...g.nb.above[above]);
    }
    return seen;
  };
  return visible.map(row => row.tile).filter(ice => g.iceNb[ice].some(melter => {
    const roofs = covers(melter);
    return !roofs.has(ice) && take.some(tile => tile === melter || roofs.has(tile));
  }));
}

function openingPlans(design) {
  if (!design.clock) return { plans: [], unknown: 0 };
  const C = clockGames(design);
  const g = C.at(design.clock.n);
  const w = work(350000, 6000);
  const plans = [];
  let unknown = 0;
  for (const choice of openingChoices(g)) {
    const state = playMove(g, E.start(g), choice);
    if (!state) continue;
    const loss = w.win(g, state, 50000).result;
    if (loss === 'unknown') unknown++;
    if (loss !== 'lose') continue;
    const delayed = E.longest(g, state, OPENING_DELAY, 5000);
    if (!delayed.exact) {
      unknown++;
      continue;
    }
    if (delayed.depth < OPENING_DELAY) continue;
    if (choice.kind === 'early-clock') {
      plans.push({ ...choice, continuation: delayed.depth });
      continue;
    }
    const later = clockNeed(C, state, { upTo: design.clock.n + 3, w, nodes: 50000 });
    if (!later.exact) unknown++;
    else if (later.k != null) plans.push({ ...choice, continuation: delayed.depth, needsClock: later.k,
      movesTowardIce: openingIceGoals(g, choice.take) });
  }
  return { plans, unknown };
}

function preserveOpeningPlans(design, plans) {
  if (!plans.length) return { ok: true };
  const C = clockGames(design);
  const g = C.at(design.clock.n);
  const w = work(350000, 6000);
  const available = new Set(openingChoices(g).map(choice => choice.take.join(',')));
  for (const plan of plans) {
    const key = plan.take.join(',');
    const fail = { ok: false, why: 'opening-plan:' + key };
    if (!available.has(key)) return fail;
    const state = playMove(g, E.start(g), plan);
    if (!state || w.win(g, state, 50000).result !== 'lose') return fail;
    if (E.longest(g, state, plan.continuation, 5000).depth < plan.continuation) return fail;
    if (plan.kind === 'late-pair') {
      const later = clockNeed(C, state, { upTo: plan.needsClock, w, nodes: 50000 });
      if (!later.exact || later.k !== plan.needsClock) return fail;
      if (plan.movesTowardIce?.length) {
        const goals = openingIceGoals(g, plan.take);
        if (!plan.movesTowardIce.every(tile => goals.includes(tile))) return fail;
      }
    }
  }
  return { ok: true };
}

module.exports = { work, clockGames, clockNeed, temptingMoves, playMove, priceMove, openingPlans, preserveOpeningPlans, SAFE_MS };
