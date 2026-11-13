/* trap_stories.js: authored trap stories 1-3 of the merged trap spec (analysis/builder/process-v2/trap-design-2026-11-12.md).
   Dennis, 2026-11-12: "make the traps more thought about with ice, keys and clock positions. You kinda have to see it."

   A trap story hand-places CONNECTED roles (the bait is a role tile, a thaw-neighbour, a key or clock cover, or its twin)
   and carries its own engine proof of that bait. It plugs into builder-next/construct.js (VC.build) through three guarded
   hooks that do nothing for a story without them:
     story.place(c, brief, rng) -> roles { clock, locks:Set, keys:[a,b], ice:{}, holderSpecials:Set, dig?:[tiles], bait }
         roles.bait = { type, tiles:[...], single:[t] | null, pairs:[[x,y]], keepUp:[...], twin?:t }
         bait.pairs are fixed pairs outside the dig; bait.keepUp stay face-up (the whole mechanism is visible);
         roles.dig: a precomputed legal dig (the minimal route, planned WITHOUT the decoy neighbours) - else planDig.
     story.prove(design, roles, ctx) -> { ok, why?, card, ... }   (replaces the generic choiceProofs requirement)
     story.profile = 'traps-v1'                                     (gate profile; see builder/loop/gate_profile.js)

   Stories: keyOnClock, shortThaw, wrongMelt. Spare 1 by default; every role tile (clock, lock, keys, ice) is face-up
   and its overlay is in sight at move 0; no face-down tile lies inside the mechanism (roles, covers, thaw-neighbours,
   bait, twins). Proofs use the exact engine only (D.priceMove / E.winnable / B.canReachWithin / fairFork) and treat
   'unknown' as a failure.

     const T = require('./trap_stories.js');
     T.build('keyOnClock', { layout: 5, seed: 3, frame: { spare: 1 }, targets: { trayRoom: 0, maxDown: 0.2 } }, { tries: 40 })
         -> VC.build result: { design, card (card.trap = the trap card), trap, roles, ... } | { fail, fails }
     T.NAMES = ['keyOnClock', 'shortThaw', 'wrongMelt']
   Brief dials (all optional): frame.spare 1-2, frame.depth, targets.trayRoom (0 = 3 waiting at the cap, the usual for
   traps 1 and 3), targets.keyCover [lo,hi] (default [1,3]), targets.clockCover [lo,hi] (trap 1), targets.margin [lo,hi]
   (trap 2: how much dearer the decoy go-round is than the keys), targets.wrongMelts 1-3 (trap 3).            */
'use strict';
const L = global.Layouts || (global.Layouts = require('../../www/layouts.js'));
const B = require('./builder.js');
const E = require('./engine.js');
const D = require('./loop/detour.js');
const O = require('./loop/obvious.js');
const Pk = require('./loop/publicfork.js');
const SG = require('./loop/static_gates.js');
const { tileVisibility } = require('../sim/refit/human_board_visibility.js');

const NAMES = ['keyOnClock', 'shortThaw', 'wrongMelt'];
const shuffle = (rng, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const capOf = brief => Math.max(1, Math.min(3, 3 - (brief.targets?.trayRoom ?? 1)));
const PROOF_NODES = 4e6, PER_CALL = 150000;

// ---------- geometry helpers ----------
const vis0Of = c => c._vis0 || (c._vis0 = tileVisibility(c.tiles, { alive: new Uint8Array(c.n).fill(1), down: new Uint8Array(c.n), openPeek: -1 }, null).tiles);
function freeWithout(c, i, removed) { const al = new Uint8Array(c.n).fill(1); for (const r of removed) al[r] = 0; return L.isFree(i, al, c.nb); }
// rough moves to take tile i from the full board: itself, its cover and the cheaper side when it is boxed in (builder.js digCost)
function digCost(c, i) {
  const al = new Uint8Array(c.n).fill(1); for (const a of c.above[i]) al[a] = 0;
  let side = 0;
  if (!L.isFree(i, al, c.nb)) side = Math.min(...['left', 'right'].map(dir => { let k = 0, cur = [i]; const seen = new Set();
    while (cur.length && k < 9) { const nx = []; for (const t of cur) for (const j of c.nb[dir][t]) if (!seen.has(j)) { seen.add(j); k += 1 + c.above[j].size; nx.push(j); } cur = nx; } return k; }));
  return 1 + c.above[i].size + side;
}
// the ice-neighbours that can go before tile i (not under it, not on it)
const thawNbs = (c, i) => c.inb[i].filter(j => !c.above[i].has(j) && !c.above[j].has(i));
// a key tile: cover in [lo,hi], not in `used`, nothing of `used` on it, role overlay in sight, free once its cover is gone
function keyCands(c, ck, used, [lo, hi], pre) {
  const v = vis0Of(c), out = [];
  for (let i = 0; i < c.n; i++) {
    if (used.has(i) || c.above[i].has(ck) || c.above[ck].has(i)) continue;
    const a = c.above[i].size; if (a < lo || a > hi || !c.roleShown0[i] || !v[i].role) continue;
    if ([...c.above[i]].some(j => used.has(j))) continue;
    if (pre) { const p = digCost(c, i) - 1; if (p < pre[0] || p > pre[1]) continue; }   // dig tiles before the key (cover + side)
    else if (!freeWithout(c, i, c.above[i])) continue;
    out.push(i);
  }
  return out;
}
// the dig planned as if `drop` were not ice-neighbours of the clock (legal in the real rules: more neighbours only thaw sooner)
function digWithout(c, roles, drop, rng) {
  if (!drop.size) return B.planDig(c, roles, rng);
  const inb = c.inb.map((a, i) => i === roles.clock ? a.filter(j => !drop.has(j)) : a);
  return B.planDig({ ...c, inb }, roles, rng);
}
const uniq = a => [...new Set(a)];
const WHY = {};   // why placements were rejected (diagnostic counters, read by the yield sweep)
const no = (k) => { WHY[k] = (WHY[k] || 0) + 1; return true; };
const emptyRoles = ck => ({ clock: ck, locks: new Set(), keys: [], ice: {}, holderSpecials: new Set() });

// ---------- trap 1: key on the clock ----------
// Picture: a locked clock; key B lies free on top of the clock stack, key A is far, under 1-3 tiles. Bait: tap B - it waits in the
// tray through A's whole dig (the keys go together: dig A, then A+B).
function placeKeyOnClock(c, brief, rng) {
  // Lethal bait needs the tray at its cap BEFORE A is taken: 2 orphans + a pair that opens and closes = 4 dig tiles before A
  // (cover + side), an even number (4 or 6). A under 1-3 covers alone is never lethal (measured: cost 0 on every build).
  const tg = brief.targets || {}, kc = tg.keyCover || [1, 4], cc = tg.clockCover || [1, 3], pre = tg.digBefore || [4, 6], v = vis0Of(c);
  const combos = [];
  for (let ck = 0; ck < c.n; ck++) {
    const cov = c.above[ck].size; if (cov < cc[0] || cov > cc[1] || !c.roleShown0[ck]) continue;
    const used = new Set([ck, ...c.above[ck]]);
    const tops = [...c.above[ck]].filter(j => c.free0[j] && c.above[j].size === 0 && c.roleShown0[j] && v[j].role);
    if (!tops.length) continue;
    const as = keyCands(c, ck, used, kc, pre).filter(a => (digCost(c, a) - 1) % 2 === 0).sort((a, b) => c.dist(b, ck) - c.dist(a, ck)).slice(0, 8);
    for (const Bk of tops) for (const A of as) if (!c.above[A].has(Bk)) combos.push([ck, Bk, A]);
  }
  if (!combos.length) return { fail: 'noKeyOnClock' };
  const [ck, Bk, A] = shuffle(rng, combos)[0];
  const roles = emptyRoles(ck); roles.locks.add(ck); roles.keys = [A, Bk];
  const keep = uniq([ck, A, Bk, ...c.above[ck], ...c.above[A]]);
  roles.bait = { type: 'keyOnClock', tiles: [Bk], single: [Bk], pairs: [], keepUp: keep, keyA: A, keyB: Bk };
  return roles;
}

// ---------- trap 2: the short thaw ----------
// Picture: clock frozen h2, uncovered. Its neighbours: lock N1 (keys far, in sight), a cheap plain N2, and a decoy N3 under cover tile X
// that is dearer to reach than the keys. Bait: the pair X + its free twin Y ("melt it without the keys").
function placeShortThaw(c, brief, rng) {
  const tg = brief.targets || {}, spare = brief.frame?.spare ?? 1, [mLo, mHi] = tg.margin || [spare + 1, spare + 4], kc = tg.keyCover || [1, 3];
  const depth = brief.frame?.depth != null ? [brief.frame.depth, brief.frame.depth] : [0, 0], v = vis0Of(c);
  const clocks = shuffle(rng, [...Array(c.n).keys()].filter(i => c.above[i].size >= depth[0] && c.above[i].size <= depth[1] && c.roleShown0[i]));
  let tried = 0;
  for (const ck of clocks) {
    const nbs = thawNbs(c, ck); if ((nbs.length < 3 || nbs.length > 6) && no('st1')) continue;
    if ((c.inb[ck].filter(j => c.above[ck].has(j)).length >= 2) && no('st2')) continue;
    const byCost = nbs.slice().sort((a, b) => digCost(c, a) - digCost(c, b) || a - b), N2 = byCost[0];
    if ((digCost(c, N2) > 3) && no('st3')) continue;
    const rest = byCost.slice(1);
    for (const N3 of shuffle(rng, rest)) {
      if ((!c.above[N3].size) && no('st4')) continue;
      const Xs = [...c.above[N3]].filter(j => c.free0[j] && c.above[j].size === 0 && !c.above[ck].has(j));
      if ((!Xs.length) && no('st5')) continue;
      const N1s = rest.filter(j => j !== N3).slice(0, tg.locks || 2);
      if ((!N1s.length || rest.some(j => j !== N3 && !N1s.includes(j))) && no('st6')) continue;          // every other neighbour is locked: no cheap alternative
      if ((N1s.some(j => !c.roleShown0[j] || !v[j].role)) && no('st7')) continue;
      if ((N1s.some(j => c.above[j].has(N3) || c.above[N3].has(j))) && no('st8')) continue;
      if (++tried > 40) return { fail: 'noShortThaw' };
      const mech0 = new Set([ck, N2, N3, ...N1s]);
      const kcs = keyCands(c, ck, new Set([...mech0, ...N1s.flatMap(j => [...c.above[j]]), ...c.above[N2], ...c.above[ck], ...c.above[N3]]), kc);
      if ((!kcs.length) && no('st9')) continue;
      const far = kcs.sort((a, b) => c.dist(b, ck) - c.dist(a, ck)).slice(0, 8);
      let pair = null;
      for (const a of shuffle(rng, far)) { for (const b of shuffle(rng, far)) if (b !== a && c.dist(a, b) <= 9 && !c.above[a].has(b) && !c.above[b].has(a)) { pair = [a, b]; break; } if (pair) break; }
      if ((!pair) && no('st10')) continue;
      // the go-round (through N3) must be dearer than the keys route by the margin (builder.js's own digCost comparison)
      const keyCost = new Set([...pair, ...c.above[pair[0]], ...c.above[pair[1]]]).size, margin = digCost(c, N3) - (keyCost + digCost(c, N1s[0]));
      if ((margin < mLo || margin > mHi) && no('st11')) continue;
      const X = shuffle(rng, Xs)[0];
      const mech = new Set([...mech0, ...pair, ...c.above[pair[0]], ...c.above[pair[1]], ...c.above[ck], ...c.above[N2], ...nbs]);
      const Ys = [...Array(c.n).keys()].filter(i => i !== X && c.free0[i] && !mech.has(i) && !c.above[X].has(i) && !N1s.some(j => c.above[j].has(i)))
        .sort((a, b) => c.dist(a, X) - c.dist(b, X));
      if ((!Ys.length) && no('st12')) continue;
      const Y = shuffle(rng, Ys.slice(0, 6))[0];
      const roles = emptyRoles(ck); roles.ice[ck] = 2; for (const j of N1s) roles.locks.add(j); roles.keys = pair;
      const P = digWithout(c, roles, new Set([N3]), rng);
      if ((!P || [X, Y, N3].some(t => P.includes(t))) && no('st13')) continue;
      roles.dig = P;
      const keep = uniq([ck, N2, N3, X, Y, ...N1s, ...pair, ...nbs, ...c.above[pair[0]], ...c.above[pair[1]], ...c.above[ck], ...nbs.flatMap(j => [...c.above[j]])]);
      roles.bait = { type: 'shortThaw', tiles: [X, Y], single: null, pairs: [[X, Y]], keepUp: keep, decoy: N3, cheap: N2, lockedNb: N1s.slice(), margin };
      return roles;
    }
  }
  return { fail: 'noShortThaw' };
}

// ---------- trap 3: the wrong melt ----------
// Picture: clock frozen h2, no keys. Several free neighbours can melt it. Bait: a free neighbour L whose twin is visible but buried;
// it would wait in the tray. Right idea: melt with the neighbours whose twins come free in the dig (they go as a pair).
function placeWrongMelt(c, brief, rng) {
  const tg = brief.targets || {}, nWrong = Math.max(1, Math.min(3, tg.wrongMelts || 1)), v = vis0Of(c);
  const depth = brief.frame?.depth != null ? [brief.frame.depth, brief.frame.depth] : [2, 3], minWay = tg.minWay ?? 5;   // 2-3 covers on the clock: the necessary dig tiles that carry the tray pressure (the orphans)
  const clocks = shuffle(rng, [...Array(c.n).keys()].filter(i => c.above[i].size >= depth[0] && c.above[i].size <= depth[1] && c.roleShown0[i]));
  let tried = 0;
  for (const ck of clocks) {
    const covIn = c.inb[ck].filter(j => c.above[ck].has(j)).length, need = 2 - covIn;      // neighbours still to melt after the cover is gone
    if (need < 1 && no('wm:coverThaws')) continue;
    const nbs = thawNbs(c, ck), free = nbs.filter(j => c.free0[j]);
    if (nbs.length < (tg.minNeighbours || need + 1) && no('wm:fewNbs')) continue;
    if (free.length < nWrong && no('wm:noFreeNb')) continue;
    const mechCov = new Set([ck, ...c.above[ck], ...nbs]);
    // the wrong ones: free neighbours (on offer at move 0); the right pair: the two cheapest of the others (they go as a pair)
    const wrong = shuffle(rng, free).slice(0, nWrong), others = nbs.filter(j => !wrong.includes(j)).sort((a, b) => digCost(c, a) - digCost(c, b) || a - b), right = others.slice(0, need);
    if ((right.length < need || digCost(c, right[need - 1]) > (tg.rightCost || 3)) && no('wm:rightDear')) continue;
    if (++tried > 40) return { fail: 'noWrongMelt' };
    const roles = emptyRoles(ck); roles.ice[ck] = 2;
    const drop = new Set(nbs.filter(j => !right.includes(j)));
    const P = digWithout(c, roles, drop, rng);
    if ((!P || wrong.some(l => P.includes(l))) && no('wm:dig')) continue;
    if (P.length < minWay && no('wm:short')) continue;
    roles.dig = P;
    // the twins: visible (picture in sight), buried (cover of 2 or more), outside the dig and the mechanism
    const twins = [], taken = new Set([...P, ...mechCov, ...wrong]);
    for (const l of wrong) {
      const cand = [...Array(c.n).keys()].filter(t => !taken.has(t) && !twins.includes(t) && c.above[t].size >= 2 && v[t].picture && !c.above[t].has(l) && !c.above[l].has(t)
        && [...c.above[t]].every(j => !mechCov.has(j) && !P.includes(j) && !wrong.includes(j)));
      if (!cand.length) { twins.length = 0; break; }
      twins.push(shuffle(rng, cand.sort((a, b) => c.above[b].size - c.above[a].size).slice(0, 6))[0]);
    }
    if (twins.length < wrong.length && no('wm:noTwin')) continue;
    const pairs = wrong.map((l, i) => [l, twins[i]]);
    const keep = uniq([ck, ...nbs, ...c.above[ck], ...nbs.flatMap(j => [...c.above[j]]), ...twins, ...twins.flatMap(t => [...c.above[t]]), ...wrong]);
    roles.bait = { type: 'wrongMelt', tiles: wrong.concat(twins), single: [wrong[0]], pairs, keepUp: keep, right: right.slice(), wrong: wrong.slice(), twins: twins.slice() };
    return roles;
  }
  return { fail: 'noWrongMelt' };
}

// ---------- proofs ----------
const SEE = {
  keyOnClock: 'The free key on top of the clock is the one to leave alone: dig out the far key first, then take both keys together, or the early key sits in the tray until the tray is full.',
  shortThaw: 'The tempting pair beside the buried neighbour is a detour: the cheap way to melt the clock is through the keys, so the pair costs the moves you do not have.',
  wrongMelt: 'Not every free neighbour is a good one to melt the clock with: the neighbour whose twin is buried deep would wait in the tray, so use the neighbours that go as a pair.',
};
function visibleAtStart(design, roles, g, s0) {
  const vr = O.visibleRoles(g, s0), ob = design.obst || {}, ice = Object.keys(ob.ice || {}).map(Number);
  const needRole = [...ice, ...(ob.locks || []), ...(ob.keys || [])], bad = needRole.filter(i => !vr[i]);
  const down = new Set(design.down || []), downIn = [...roles.bait.keepUp, ...needRole].filter(i => down.has(i));
  return { ok: !bad.length && !downIn.length, hiddenRoles: bad, downInMechanism: downIn };
}
// the bait move as an engine tempting-move object (single tile or pair), and its price at state s
function priceBait(C, s, t, base, nShipMax, w) { return D.priceMove(C, s, t, { base, nShipMax, nodes: PER_CALL, w }); }
// is the priced bait a proven trap at this spare? lose (exact) or a cost of at least spare+1 (exact)
const provenCost = (p, spare) => p.exact && (p.result === 'lose' || (p.result === 'win' && p.cost != null && p.cost >= spare + 1));

function baseProof(design, roles, ctx, name) {
  const { k, spare, c, brief } = ctx, bait = roles.bait, w = D.work(PROOF_NODES);
  const nShipMax = Math.min(19, k + 3), C = D.clockGames(design), g = C.at(design.clock.n), s0 = E.start(g);
  const out = { ok: false, why: null, type: name };
  // the bait is really a pair (pictures) where the story says so
  for (const [x, y] of bait.pairs) if (design.faces[x] !== design.faces[y]) { out.why = 'baitNotPaired'; return out; }
  const vis = visibleAtStart(design, roles, g, s0); out.visible = vis;
  if (!vis.ok) { out.why = 'mechanismNotVisible'; return out; }
  // the witness states up to the clock (as A5 walks them)
  const Wt = SG.actionsOf(g, design.solution);
  if (!Wt.ok) { out.why = 'noWitness'; return out; }
  const ci = Wt.acts.findIndex(a => typeof a === 'object' ? a.pair.includes(design.clock.i) : a === design.clock.i);
  out.work = { w, C, g, s0, Wt, ci, nShipMax };
  return out;
}
// where along the stored route the bait is on offer and proven costly: { first, last, shareFirst, shareLast, inWindow }
function decisiveWindow(design, roles, t, ctx, P) {
  const { k, spare } = ctx, { w, C, g, Wt, ci, nShipMax } = P.work, rows = [];
  for (let m = 0; m <= Math.max(0, ci) && m < Wt.states.length; m++) {
    const s = Wt.states[m]; if (s.clockTaken) break;
    const legalNow = new Set(E.legal(g, s).filter(a => typeof a === 'number'));
    if (!t.take.every(i => legalNow.has(i))) continue;                                   // the bait is not on offer at this state
    if (!D.playMove(C.free, s, t)) { rows.push({ m: s.moves, instant: true }); continue; }  // it loses at once
    const p = priceBait(C, s, t, k, nShipMax, w);
    rows.push({ m: s.moves, cost: p.cost, result: p.result, exact: p.exact, proven: provenCost(p, spare) || !!p.instant });
  }
  const good = rows.filter(r => r.proven || r.instant);
  const lo = Math.ceil(0.15 * k), hi = Math.floor(0.6 * k);
  const first = good.length ? good[0].m : null, last = good.length ? good[good.length - 1].m : null;
  return { offeredAt: rows.length ? rows[0].m : null, first, last, shareFirst: first == null ? null : +(first / k).toFixed(3), shareLast: last == null ? null : +(last / k).toFixed(3),
    inWindow: first != null && last >= lo && first <= hi, window15to60: [lo, hi], states: rows.length, lethalStates: good.length };
}
function finish(design, roles, ctx, P, t, price, extra) {
  const { k, spare } = ctx, bait = roles.bait;
  const dec = decisiveWindow(design, roles, t, ctx, P);
  const spent = Math.round(P.work.w.used);
  const card = { type: bait.type, bait: { tiles: bait.tiles.slice(), pairs: bait.pairs.map(p => p.slice()), single: bait.single ? bait.single.slice() : null },
    cost: { result: price.result, cost: price.cost, exact: price.exact, spare, needsAtLeast: spare + 1 },
    decisive: dec, see: SEE[bait.type], k, spare, clock: design.clock.i, ...extra.card, engineNodes: spent };
  return { ok: true, card, price, decisive: dec, ...extra.facts };
}

function proveKeyOnClock(design, roles, ctx) {
  const P = baseProof(design, roles, ctx, 'keyOnClock'); if (P.why) return P;
  const { k, spare } = ctx, { w, C, s0, nShipMax } = P.work, bait = roles.bait, [A, Bk] = [bait.keyA, bait.keyB];
  // the stored route takes the keys consecutively (A and B are the key pair, taken together after A's dig)
  const sol = design.solution, ia = sol.indexOf(A), ib = sol.indexOf(Bk), ic = sol.indexOf(design.clock.i);
  if (ia < 0 || ib < 0 || Math.abs(ia - ib) !== 1 || Math.max(ia, ib) > ic) { P.why = 'keysNotConsecutive'; return P; }
  if (Math.min(ia, ib) === 0) { P.why = 'keysFirst'; return P; }
  const t = { kind: 'single', take: [Bk] }, price = priceBait(C, s0, t, k, nShipMax, w);
  if (!provenCost(price, spare)) { P.why = 'baitNotCostly:' + price.result + ':' + price.cost + (price.exact ? '' : ':inexact'); return P; }
  const fork = fairness(C, s0, t, design, P, ctx);
  return finish(design, roles, ctx, P, t, price, { card: { keysTakenAt: [Math.min(ia, ib) + 1, Math.max(ia, ib) + 1], fair: fork.fair, fairWhy: fork.why }, facts: { fork } });
}
function proveShortThaw(design, roles, ctx) {
  const P = baseProof(design, roles, ctx, 'shortThaw'); if (P.why) return P;
  const { k, spare, c } = ctx, { w, C, g, s0, nShipMax } = P.work, bait = roles.bait, [X, Y] = bait.pairs[0];
  const t = { kind: 'pair', take: [X, Y] }, price = priceBait(C, s0, t, k, nShipMax, w);
  if (!provenCost(price, spare)) { P.why = 'baitNotCostly:' + price.result + ':' + price.cost + (price.exact ? '' : ':inexact'); return P; }
  // the first key-cover tile is obvious: the way to the keys is the goal-directed move (obvious.js) at the opening, and it wins
  const set = O.obviousMoves(g, s0), keyCover = uniq([...c.above[design.obst.keys[0]], ...c.above[design.obst.keys[1]]]).filter(i => L.isFree(i, s0.alive, g.nb));
  const keysFree = design.obst.keys.filter(i => L.isFree(i, s0.alive, g.nb));
  const first = keyCover.concat(keysFree).filter(i => set.has(i));
  const firstWins = first.some(i => { const s2 = D.playMove(C.free, s0, { take: [i] }); const need = s2 && D.clockNeed(C, s2, { upTo: nShipMax, nodes: PER_CALL, w }); return need && need.k != null && need.k <= design.clock.n && need.exact; });
  if (!firstWins) { P.why = 'keyCoverNotObviousOrNotWinning'; return P; }
  return finish(design, roles, ctx, P, t, price, { card: { firstKeyCover: first.slice(0, 3), margin: bait.margin, decoy: bait.decoy, cheap: bait.cheap }, facts: {} });
}
function proveWrongMelt(design, roles, ctx) {
  const P = baseProof(design, roles, ctx, 'wrongMelt'); if (P.why) return P;
  const { k, spare, brief } = ctx, { w, C, s0, nShipMax } = P.work, bait = roles.bait, L1 = bait.single[0];
  const t = { kind: 'single', take: [L1] }, price = priceBait(C, s0, t, k, nShipMax, w);
  if (!provenCost(price, spare)) { P.why = 'baitNotLost:' + price.result + ':' + price.cost + (price.exact ? '' : ':inexact'); return P; }
  // fairFork judges a move that loses at EVERY shippable spare; a bait that only costs spare+1 or more (lost at the shipped clock,
  // won at k+3) is proven by its price alone: fair stays null then
  const fork = price.result === 'lose' ? fairness(C, s0, t, design, P, ctx) : { fair: null, why: [], skipped: 'bait wins at the loosest spare' };
  if (price.result === 'lose' && !fork.fair) { P.why = 'unfair:' + (fork.unknown ? 'unknown' : fork.why.join('|')); return P; }
  const cap = capOf(brief);
  let forced = 'skip';
  if (cap > 1) { forced = B.canReachWithin({ ...design, clock: { ...design.clock, n: design.clock.n } }, cap - 1, 200000); if (forced !== 'no') { P.why = 'trayNotForced:' + forced; return P; } }
  return finish(design, roles, ctx, P, t, price, { card: { fair: fork.fair, forcedPressure: forced, cap, wrongNeighbours: bait.wrong.slice(), twins: bait.twins.slice(), rightPair: bait.right.slice() }, facts: { fork, forced } });
}
// fairFork at the opening (all 100% of the tiles left); face-down tiles that are not free are unseen
function fairness(C, s, t, design, P, ctx) {
  const { w, g, nShipMax } = P.work, unseen = [];
  for (const i of design.down || []) if (s.alive[i] && !L.isFree(i, s.alive, g.nb)) unseen.push(i);
  const f = Pk.fairFork(C, s, t, { unseen, perms: 4, seed: 1, nShipMax, w, nodes: 60000, memo: new Map() });
  return { fair: f.fair, unfair: f.unfair, unknown: f.unknown, why: f.why, checks: f.checks };
}

// ---------- the stories ----------
const STORIES = {
  keyOnClock: { title: 'Key on the clock', sentence: 'A locked clock; one key lies free on top of it, the other is buried far away. Taking the near key first strands it in the tray.',
    spec: { keys: 'far', trap: 1 }, place: placeKeyOnClock, prove: proveKeyOnClock, profile: 'traps-v1' },
  shortThaw: { title: 'The short thaw', sentence: 'A frozen clock: one neighbour is locked, one is cheap, one lies under a free pair. The pair looks like a short melt but costs more than the keys.',
    spec: { keys: 'far', trap: 2 }, place: placeShortThaw, prove: proveShortThaw, profile: 'traps-v1' },
  wrongMelt: { title: 'The wrong melt', sentence: 'A frozen clock with several free neighbours; the one whose twin is buried deep is a trap, the pair that goes together melts it.',
    spec: { trap: 3 }, place: placeWrongMelt, prove: proveWrongMelt, profile: 'traps-v1' },
};
for (const [k, v] of Object.entries(STORIES)) B.STORIES[k] = v;

// spare 1 by default; when the brief names no spare and no board is honest at spare 1 (A4 needs two winning openings at the shipped
// spare, and a lethal bait leaves few), the build is retried at spare 2 (the spec's dial 1-2). frame.spare fixes it.
function build(name, brief = {}, opts = {}) {
  if (!STORIES[name]) return { fail: 'unknownTrapStory', detail: name };
  const VC = require('../builder-next/construct.js'), fixed = brief.frame?.spare != null, spares = fixed ? [brief.frame.spare] : [1, 2];
  let last = null;
  for (const spare of spares) {
    const r = VC.build({ ...brief, frame: { ...(brief.frame || {}), spare }, targets: { trayRoom: 0, maxDown: 0.2, hiddenOnWay: 0, ...(brief.targets || {}) }, story: name }, { tries: 40, ...opts });
    if (r.design) return r;
    last = last ? { ...r, fails: { ...Object.fromEntries(Object.entries(last.fails || {}).map(([k, v]) => ['s' + spares[0] + ':' + k, v])), ...r.fails } } : r;
  }
  return last;
}

module.exports = { WHY, STORIES, NAMES, build, capOf, vis0Of, thawNbs, digCost };
