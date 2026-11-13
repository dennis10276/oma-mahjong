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

   Stories: keyOnClock, wrongMelt, lockedMelt, guardedKey (shortThaw is retired, see RETIRED). Spare 1 by default; every role tile (clock, lock, keys, ice) is face-up
   and its overlay is in sight at move 0; no face-down tile lies inside the mechanism (roles, covers, thaw-neighbours,
   bait, twins). Proofs use the exact engine only (D.priceMove / E.winnable / B.canReachWithin / fairFork) and treat
   'unknown' as a failure.

     const T = require('./trap_stories.js');
     T.build('keyOnClock', { layout: 5, seed: 3, frame: { spare: 1 }, targets: { trayRoom: 0, maxDown: 0.2 } }, { tries: 40 })
         -> VC.build result: { design, card (card.trap = the trap card), trap, roles, ... } | { fail, fails }
     T.NAMES = ['keyOnClock', 'wrongMelt', 'lockedMelt', 'guardedKey']
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
const { shownAll } = require('./shown.js');

// shortThaw is RETIRED (kept below, not buildable): its bait costs the same as any unrelated free pair (see the control comparison)
const NAMES = ['keyOnClock', 'wrongMelt', 'lockedMelt', 'guardedKey'], RETIRED = ['shortThaw'];
// Dennis 2026-11-13 (level 281): the cut-off timer was a UI bug (fixed in the game); "the tile itself is fine to be covered more". There is NO placement
// rule on the clock's or any role's uncovered share or position (top row is fine). Roles only need the "shown at move 0" semantics (c.roleShown0).
// The uncovered shares (shown.js) are recorded in the card for information only.
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
// tray through A's whole dig (the keys go together: dig A, then A+B). B may cover the clock almost completely (Dennis 2026-11-13: "the tile itself
// is fine to be covered more"); the clock may lie anywhere, also in the top row.
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

// ---------- trap 5: locked melt (frozen clock + locks) ----------
// Picture: the clock is frozen (ice 2) and lies under 2-3 tiles (as wrongMelt: the cover dig carries the tray pressure); exactly ONE of
// those covers touches it (a thaw-neighbour that leaves on the dig), so ONE more neighbour must go. The other neighbours: 1-3 LOCKED ones and
// 1-2 free "lonely" ones F whose twin is buried deep (the wrong-melt bait); no plain free neighbour, so only the locked neighbour melts the
// clock without a stranded tile. Two keys, both in sight: one free NEAR the clock (K1), one FAR under 1-3 tiles (K2). Right idea: fetch the
// keys (together), then melt with the locked neighbour together with the cover that leaves in the dig. Wrong ideas: melt with the lonely
// neighbour F (it waits in the tray for its buried twin), or grab the near key first (it waits in the tray through the dig).
// Dials: spare 1-2, targets.keyCover (K2), targets.wrongMelts 1-2 (lonely neighbours), targets.locks 1-3 (locked neighbours),
// targets.digBefore (dig tiles before the keys), frame.depth (covers on the clock, default 2-3).
function placeLockedMelt(c, brief, rng) {
  const tg = brief.targets || {}, nWrong = Math.max(1, Math.min(2, tg.wrongMelts || 1)), kc = tg.keyCover || [1, 3], pre = tg.digBefore || [4, 6], v = vis0Of(c);
  const depth = brief.frame?.depth != null ? [brief.frame.depth, brief.frame.depth] : [0, 0];
  const clocks = shuffle(rng, [...Array(c.n).keys()].filter(i => c.above[i].size >= depth[0] && c.above[i].size <= depth[1] && c.roleShown0[i]));
  let tried = 0;
  for (const ck of clocks) {
    const covIn = c.inb[ck].filter(j => c.above[ck].has(j)).length, need = 2 - covIn;   // neighbours still to melt after the cover is gone
    if ((need < 1 || need > 2) && no('lm:coverThaws')) continue;
    const nbs = thawNbs(c, ck), free = nbs.filter(j => c.free0[j]);
    if ((nbs.length < nWrong + 1 || nbs.length > 5) && no('lm:nbCount')) continue;
    if ((free.length < nWrong) && no('lm:fewFreeNbs')) continue;
    const wrong = shuffle(rng, free).slice(0, nWrong), rest = nbs.filter(j => !wrong.includes(j)).sort((a, b) => digCost(c, a) - digCost(c, b) || a - b);
    // every neighbour that is not a lonely one is LOCKED (its overlay in sight, 0.5 of its face): any way to melt the clock needs the keys, a plain
    // neighbour would be a key-free way round. The right route melts with two locked neighbours (or one locked + the cover that thaws).
    const lockable = j => c.roleShown0[j] && v[j].role && c.above[j].size <= 2;
    const locked = rest.slice(), right = locked.slice(0, need), plain = [];
    if ((locked.length < need || locked.length > (tg.locks || 3)) && no('lm:lockCount')) continue;
    if (locked.some(j => !lockable(j)) && no('lm:lockHidden')) continue;
    const mechNb = new Set([ck, ...nbs, ...nbs.flatMap(j => [...c.above[j]]), ...c.above[ck]]);
    const near = [...Array(c.n).keys()].filter(i => !mechNb.has(i) && c.free0[i] && c.above[i].size === 0 && c.roleShown0[i] && v[i].role && c.dist(i, ck) <= 12 && c.dist(i, ck) >= 3)
      .sort((a, b) => c.dist(a, ck) - c.dist(b, ck)).slice(0, 5);
    if (!near.length && no('lm:noNearKey')) continue;
    for (const K1 of shuffle(rng, near).slice(0, 3)) {
      const used = new Set([...mechNb, K1]);
      const fars = keyCands(c, ck, used, kc, pre).filter(a => (digCost(c, a) - 1) % 2 === 0 && !c.above[a].has(K1) && !c.above[K1].has(a)).sort((a, b) => c.dist(b, ck) - c.dist(a, ck)).slice(0, 8);
      if (!fars.length && no('lm:noFarKey')) continue;
      for (const K2 of shuffle(rng, fars).slice(0, 4)) {
        if (++tried > 60) return { fail: 'noLockedMelt' };
        const roles = emptyRoles(ck); roles.ice[ck] = 2; for (const j of locked) roles.locks.add(j); roles.keys = [K2, K1];
        const P = digWithout(c, roles, new Set([...wrong, ...plain]), rng);
        if ((!P) && no('lm:noDig')) continue;
        if (wrong.some(l => P.includes(l)) && no('lm:dig')) continue;
        const pk = Math.min(P.indexOf(K1), P.indexOf(K2)); if (process.env.DBG) console.log('lm P', P.length, 'pk', pk, 'K1', P.indexOf(K1), 'K2', P.indexOf(K2), 'clock', P.indexOf(ck), 'locked', locked.map(j => P.indexOf(j)), 'cov', c.above[ck].size);
        if ((pk < pre[0] || pk > pre[1] || (tg.evenPre !== false && pk % 2)) && no('lm:digBefore')) continue;
        if (!locked.some(j => P.includes(j)) && no('lm:lockNotUsed')) continue;
        if (P.length < (tg.minWay ?? 6) && no('lm:short')) continue;
        // the twins of the lonely neighbours: visible, buried (2+ covers), outside the dig and the mechanism
        const mech = new Set([...mechNb, K1, K2, ...c.above[K2], ...P]), twins = [], taken = new Set([...mech, ...wrong]);
        for (const l of wrong) {
          const cand = [...Array(c.n).keys()].filter(t => !taken.has(t) && !twins.includes(t) && c.above[t].size >= 2 && v[t].picture && !c.above[t].has(l) && !c.above[l].has(t)
            && [...c.above[t]].every(j => !mech.has(j) && !wrong.includes(j) && !P.includes(j)));
          if (!cand.length) { twins.length = 0; break; }
          twins.push(shuffle(rng, cand.sort((a, b) => c.above[b].size - c.above[a].size).slice(0, 6))[0]);
        }
        if (twins.length < wrong.length && no('lm:noTwin')) continue;
        roles.dig = P;
        const keep = uniq([ck, ...nbs, K1, K2, ...c.above[K2], ...twins, ...twins.flatMap(t => [...c.above[t]]), ...nbs.flatMap(j => [...c.above[j]]), ...wrong]);
        roles.bait = { type: 'lockedMelt', tiles: wrong.concat(twins, [K1]), single: [wrong[0]], pairs: wrong.map((l, i) => [l, twins[i]]), keepUp: keep,
          wrong: wrong.slice(), twins: twins.slice(), keyNear: K1, keyFar: K2, locked: locked.slice(), right: right.slice() };
        return roles;
      }
    }
  }
  return { fail: 'noLockedMelt' };
}

// ---------- trap 4: the guarded key ----------
// Picture: the clock is locked. Key A is in sight under exactly ONE frozen cover tile g (ice 2) that melts only when two of its
// neighbours (one of them on the way, plus one more) are gone; key B is free elsewhere. Bait: take B first - it waits in the tray
// through A's dig (the neighbours of g, g, then A). Dials: spare, targets.digBefore (dig tiles before the first key), clockCover.
function placeGuardedKey(c, brief, rng) {
  const tg = brief.targets || {}, cc = tg.clockCover || [0, 2], pre = tg.digBefore || [4, 7], v = vis0Of(c);
  const clocks = shuffle(rng, [...Array(c.n).keys()].filter(i => c.above[i].size >= cc[0] && c.above[i].size <= cc[1] && c.roleShown0[i]));
  const gs = [...Array(c.n).keys()].filter(i => c.free0[i] && c.above[i].size === 0 && c.roleShown0[i] && v[i].role);
  let tried = 0;
  for (const ck of clocks) {
    const cov = new Set([ck, ...c.above[ck]]);
    const pairs = [];
    for (const g of gs) {
      if (cov.has(g)) continue;
      const nbs = thawNbs(c, g); if (nbs.length < 2 || nbs.length > 5) continue;
      for (const A of [...Array(c.n).keys()]) {
        if (cov.has(A) || c.above[A].size !== 1 || !c.above[A].has(g) || !c.roleShown0[A] || !v[A].role) continue;
        if (c.above[ck].has(A) || c.above[A].has(ck)) continue;
        pairs.push([g, A]);
      }
    }
    if (!pairs.length) { no('gk:noPair'); continue; }
    for (const [g, A] of shuffle(rng, pairs).slice(0, 4)) {
      const nbsG = thawNbs(c, g), used = new Set([...cov, g, A, ...nbsG, ...nbsG.flatMap(j => [...c.above[j]])]);
      const Bs = [...Array(c.n).keys()].filter(i => !used.has(i) && c.free0[i] && c.above[i].size === 0 && c.roleShown0[i] && v[i].role && c.dist(i, g) >= 4)
        .sort((a, b) => c.dist(b, g) - c.dist(a, g)).slice(0, 6);
      if (!Bs.length) { no('gk:noB'); continue; }
      for (const Bk of shuffle(rng, Bs).slice(0, 2)) {
        if (++tried > 60) return { fail: 'noGuardedKey' };
        const roles = emptyRoles(ck); roles.locks.add(ck); roles.ice[g] = 2; roles.keys = [A, Bk];
        const P = B.planDig(c, roles, rng);
        if ((!P) && no('gk:noDig')) continue;
        if ((!P.includes(g) || !P.includes(A)) && no('gk:gNotOnWay')) continue;
        const pk = Math.min(P.indexOf(A), P.indexOf(Bk));
        if ((pk < pre[0] || pk > pre[1]) && no('gk:digBefore')) continue;
        if ((P.indexOf(g) > P.indexOf(A)) && no('gk:order')) continue;
        roles.dig = P;
        const keep = uniq([ck, A, Bk, g, ...c.above[ck], ...nbsG, ...nbsG.flatMap(j => [...c.above[j]])]);
        roles.bait = { type: 'guardedKey', tiles: [Bk], single: [Bk], pairs: [], keepUp: keep, keyA: A, keyB: Bk, guard: g, guardNbs: nbsG.slice() };
        return roles;
      }
    }
  }
  return { fail: 'noGuardedKey' };
}

// ---------- proofs ----------
const SEE = {
  keyOnClock: 'The free key on top of the clock is the one to leave alone: dig out the far key first, then take both keys together, or the early key sits in the tray until the tray is full.',
  shortThaw: 'The tempting pair beside the buried neighbour is a detour: the cheap way to melt the clock is through the keys, so the pair costs the moves you do not have.',
  lockedMelt: 'To melt the frozen clock take both keys (the far one needs a dig, the near one must not go first), then melt with the locked neighbour and its partner: the lonely free neighbour would wait in the tray for its buried twin.',
  guardedKey: 'The key lies under a frozen tile: thaw that tile first (its neighbours go, then it), then take both keys together; grabbing the free key first leaves it waiting in the tray through the whole dig.',
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

// ---------- shown, control, idle (Dennis 2026-11-13) ----------
// The uncovered share of the clock and role tiles is recorded for information only (no minimum: the tile itself may be covered).
function shownFacts(design) {
  const sh = shownAll(design.tiles), ob = design.obst || {}, ice = Object.keys(ob.ice || {}).map(Number), role = [...new Set([...(ob.locks || []), ...(ob.keys || []), ...ice])];
  const clock = sh[design.clock.i], minRole = role.length ? Math.min(...role.map(i => sh[i])) : 1;
  return { ok: true, clock, minRole, roles: Object.fromEntries(role.map(i => [i, sh[i]])) };
}
// the cost of a priced move as a number (a lost move counts as one more than the loosest shippable spare)
const num = (p, cap) => p.result === 'lose' ? cap + 1 : p.cost;
// tiles that belong to the mechanism (not "unrelated"): roles, thaw-neighbours, covers of those, the bait
function mechSet(c, design, roles) {
  const ob = design.obst || {}, ice = Object.keys(ob.ice || {}).map(Number), base = new Set([design.clock.i, ...(ob.locks || []), ...(ob.keys || []), ...ice, ...roles.bait.tiles, ...roles.bait.keepUp]);
  for (const i of [...base]) { for (const j of c.above[i]) base.add(j); }
  for (const f of ice) for (const j of c.inb[f]) { base.add(j); for (const a of c.above[j]) base.add(a); }
  return base;
}
// the control: the dearest UNRELATED free pair / single-with-twin-in-sight at move 0 (capped sample, exact prices).
// A bait must cost strictly more, else it is just "any free pair costs two moves" (the flaw that retired shortThaw).
function controlOf(design, roles, ctx, P) {
  const { k } = ctx, { w, C, g, s0, nShipMax } = P.work, c = ctx.c, cap = nShipMax - k, mech = mechSet(c, design, roles);
  const all = D.temptingMoves(g, s0, { singles: true }).filter(m => !m.peek && m.take.every(i => !mech.has(i)));
  const pairs = all.filter(m => m.kind === 'pair'), singles = all.filter(m => m.kind !== 'pair');
  const pick = pairs.slice(0, 12).concat(singles.slice(0, 12)), rows = [];
  let value = 0, unknown = false, dearest = null;
  for (const m of pick) {
    const t = m.kind === 'pair' ? { kind: 'pair', take: m.take } : { kind: 'single', take: m.take };
    const p = priceBait(C, s0, t, k, nShipMax, w);
    if (!p.exact || p.result === 'unknown') { unknown = true; rows.push({ take: m.take, unknown: true }); continue; }
    const v = num(p, cap); rows.push({ take: m.take, kind: m.kind, result: p.result, cost: p.cost });
    if (!dearest || v > value) { value = v; dearest = { take: m.take, kind: m.kind, result: p.result, cost: p.cost }; }
  }
  return { value, unknown, dearest, moves: pick.length, of: all.length, cap };
}
// bait list -> proven prices; each must be lose or cost >= spare+1 (exact) AND strictly dearer than the control
function priceAll(design, roles, ctx, P, list) {
  const { k, spare } = ctx, { w, C, s0, nShipMax } = P.work, cap = nShipMax - k, out = { baits: [], control: null, why: null };
  out.control = controlOf(design, roles, ctx, P);
  if (out.control.unknown) { out.why = 'controlUnknown'; return out; }
  for (const b of list) {
    const t = { kind: b.take.length > 1 ? 'pair' : 'single', take: b.take }, price = priceBait(C, s0, t, k, nShipMax, w);
    if (!provenCost(price, spare)) { if (process.env.DBG2) { const g = P.work.g; let s = E.start(g); const tr = []; for (const m of design.solution) { s = E.step(g, s, m); if (!s) break; tr.push(s.tray.length); } console.log('NOTCOSTLY', b.name, 'sol', design.solution.slice(0, 20).join(','), 'tray', tr.slice(0, 22).join(''), 'bait', b.take, 'keys', design.obst.keys, 'locks', design.obst.locks, 'ice', JSON.stringify(design.obst.ice), 'k', k); } out.why = `${b.name}:notCostly:${price.result}:${price.cost}${price.exact ? '' : ':inexact'}`; return out; }
    const val = num(price, cap);
    if (!(val > out.control.value)) { out.why = `${b.name}:notAboveControl:${val}<=${out.control.value}`; return out; }
    out.baits.push({ name: b.name, tiles: b.take.slice(), result: price.result, cost: price.cost, value: val, exact: price.exact, price, t });
  }
  return out;
}
// clock minimum k with a modification of the obstacles (ice removed / locks removed); null when unproven
function kWith(design, mod) {
  const d = JSON.parse(JSON.stringify({ ...design, obst: { ...design.obst, ...mod }, clock: { ...design.clock, n: 99 } }));
  const cs = E.clockShortest(E.game(d), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity });
  return cs && !cs.unsure && cs.k ? cs.k : null;
}
const bt = b => ({ name: b.name, tiles: b.tiles, result: b.result, cost: b.cost, value: b.value });

function baseProof(design, roles, ctx, name) {
  const { k, spare, c, brief } = ctx, bait = roles.bait, w = D.work(PROOF_NODES);
  const nShipMax = Math.min(19, k + 3), C = D.clockGames(design), g = C.at(design.clock.n), s0 = E.start(g);
  const out = { ok: false, why: null, type: name };
  // the bait is really a pair (pictures) where the story says so
  for (const [x, y] of bait.pairs) if (design.faces[x] !== design.faces[y]) { out.why = 'baitNotPaired'; return out; }
  const vis = visibleAtStart(design, roles, g, s0); out.visible = vis;
  if (!vis.ok) { out.why = 'mechanismNotVisible'; return out; }
  out.shown = shownFacts(design);
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
    decisive: dec, see: bait.see || SEE[bait.type], k, spare, clock: design.clock.i, shown: { clock: P.shown.clock, minRole: P.shown.minRole, roles: P.shown.roles }, ...extra.card, engineNodes: spent };
  return { ok: true, card, price, decisive: dec, ...extra.facts };
}

function proveKeyOnClock(design, roles, ctx) {
  const P = baseProof(design, roles, ctx, 'keyOnClock'); if (P.why) return P;
  const { k, spare } = ctx, { w, C, s0, nShipMax } = P.work, bait = roles.bait, [A, Bk] = [bait.keyA, bait.keyB];
  // the stored route takes the keys consecutively (A and B are the key pair, taken together after A's dig)
  const sol = design.solution, ia = sol.indexOf(A), ib = sol.indexOf(Bk), ic = sol.indexOf(design.clock.i);
  if (ia < 0 || ib < 0 || Math.abs(ia - ib) !== 1 || Math.max(ia, ib) > ic) { P.why = 'keysNotConsecutive'; return P; }
  if (Math.min(ia, ib) === 0) { P.why = 'keysFirst'; return P; }
  const pr = priceAll(design, roles, ctx, P, [{ name: 'keyBFirst', take: [Bk] }]); if (pr.why) { P.why = 'bait:' + pr.why; return P; }
  const t = pr.baits[0].t, price = pr.baits[0].price;
  const fork = fairness(C, s0, t, design, P, ctx);
  return finish(design, roles, ctx, P, t, price, { card: { keysTakenAt: [Math.min(ia, ib) + 1, Math.max(ia, ib) + 1], fair: fork.fair, fairWhy: fork.why, baits: pr.baits.map(bt), control: pr.control, keyOn: bait.keyOn }, facts: { fork, control: pr.control } });
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
  const pr = priceAll(design, roles, ctx, P, [{ name: 'wrongNeighbour', take: [L1] }]); if (pr.why) { P.why = 'bait:' + pr.why; return P; }
  const t = pr.baits[0].t, price = pr.baits[0].price;
  // fairFork judges a move that loses at EVERY shippable spare; a bait that only costs spare+1 or more (lost at the shipped clock,
  // won at k+3) is proven by its price alone: fair stays null then
  const fork = price.result === 'lose' ? fairness(C, s0, t, design, P, ctx) : { fair: null, why: [], skipped: 'bait wins at the loosest spare' };
  if (price.result === 'lose' && !fork.fair) { P.why = 'unfair:' + (fork.unknown ? 'unknown' : fork.why.join('|')); return P; }
  const cap = capOf(brief);
  let forced = 'skip';
  if (cap > 1) { forced = B.canReachWithin({ ...design, clock: { ...design.clock, n: design.clock.n } }, cap - 1, 200000); if (forced !== 'no') { P.why = 'trayNotForced:' + forced; return P; } }
  return finish(design, roles, ctx, P, t, price, { card: { fair: fork.fair, baits: pr.baits.map(bt), control: pr.control, forcedPressure: forced, cap, wrongNeighbours: bait.wrong.slice(), twins: bait.twins.slice(), rightPair: bait.right.slice() }, facts: { fork, forced } });
}
function proveLockedMelt(design, roles, ctx) {
  const P = baseProof(design, roles, ctx, 'lockedMelt'); if (P.why) return P;
  const { k, spare, brief } = ctx, { w, C, s0, nShipMax } = P.work, bait = roles.bait, sol = design.solution, ci = sol.indexOf(design.clock.i);
  // the stored route is the right idea: both keys, then a locked neighbour (and the plain one) before the clock
  const lockedIn = bait.locked.map(l => sol.indexOf(l)).filter(p => p >= 0 && p < ci), kp = [bait.keyNear, bait.keyFar].map(x => sol.indexOf(x));
  if (!lockedIn.length) { if (process.env.DBG) console.log('AVOID sol', sol.slice(0, ci + 1).join(','), 'ice', JSON.stringify(design.obst.ice), 'locks', design.obst.locks, 'keys', design.obst.keys, 'wrong', bait.wrong, 'right', bait.right, 'covers', [...ctx.c.above[design.clock.i]], 'nbs', ctx.c.inb[design.clock.i].join(','), 'k', k); P.why = 'routeAvoidsLock'; return P; }
  if (kp.some(p => p < 0 || p > ci) || Math.max(...kp) > Math.min(...lockedIn)) { P.why = 'keysNotBeforeLocked'; return P; }
  const list = bait.wrong.map(f => ({ name: 'lonelyNeighbour', take: [f] })).concat([{ name: 'nearKeyFirst', take: [bait.keyNear] }]);
  const pr = priceAll(design, roles, ctx, P, list); if (pr.why) { P.why = pr.why; return P; }
  // fairness of the lonely-neighbour bait when it loses outright (as wrongMelt): a guess is not a trap
  const lone = pr.baits[0], t = lone.t;
  const fork = lone.result === 'lose' ? fairness(C, s0, t, design, P, ctx) : { fair: null, why: [], skipped: 'bait wins at the loosest spare' };
  // fair is recorded, not required (the task asks for an exact price: lose or cost >= spare+1, above the control)
  // the lock and the ice are not idle: without either, the proven clock route is shorter
  const kNoLock = kWith(design, { locks: [] }), kNoIce = kWith(design, { ice: {} });
  if (kNoLock == null || kNoIce == null) { P.why = 'idleUnproven'; return P; }
  if (!(kNoLock < k)) { P.why = 'lockIdle:' + kNoLock + '>=' + k; return P; }
  if (!(kNoIce < k)) { P.why = 'iceIdle:' + kNoIce + '>=' + k; return P; }
  return finish(design, roles, ctx, P, t, lone.price, { card: { fair: fork.fair, baits: pr.baits.map(bt), control: pr.control, idle: { kNoLock, kNoIce, k }, rightIdea: { keys: [bait.keyFar, bait.keyNear], locked: bait.locked },
    lonelyNeighbours: bait.wrong.slice(), twins: bait.twins.slice(), nearKey: bait.keyNear, farKey: bait.keyFar }, facts: { fork, control: pr.control } });
}
function proveGuardedKey(design, roles, ctx) {
  const P = baseProof(design, roles, ctx, 'guardedKey'); if (P.why) return P;
  const { k, spare, c } = ctx, { w, C, g, s0, nShipMax } = P.work, bait = roles.bait, sol = design.solution, ci = sol.indexOf(design.clock.i), gi = sol.indexOf(bait.guard), ia = sol.indexOf(bait.keyA), ib = sol.indexOf(bait.keyB);
  // A shows with g on it: A's only cover is g, A's overlay and picture-side are in sight (visibleAtStart checked the role overlay), g is frozen
  if (!(c.above[bait.keyA].size === 1 && c.above[bait.keyA].has(bait.guard))) { P.why = 'keyNotUnderGuardOnly'; return P; }
  if (design.obst.ice[bait.guard] !== 2) { P.why = 'guardNotFrozen'; return P; }
  if (!(gi >= 0 && ia > gi && ia < ci && ib >= 0 && ib < ci)) { P.why = 'routeOrder'; return P; }
  if (Math.min(ia, ib) === 0) { P.why = 'keysFirst'; return P; }
  const pr = priceAll(design, roles, ctx, P, [{ name: 'keyBFirst', take: [bait.keyB] }]); if (pr.why) { P.why = pr.why; return P; }
  const kNoIce = kWith(design, { ice: {} }), kNoLock = kWith(design, { locks: [] });
  if (kNoIce == null || kNoLock == null) { P.why = 'idleUnproven'; return P; }
  if (!(kNoIce <= k - 1)) { P.why = 'iceIdle:' + kNoIce + '>=' + k; return P; }
  if (!(kNoLock < k)) { P.why = 'lockIdle:' + kNoLock + '>=' + k; return P; }
  const b0 = pr.baits[0], fork = b0.result === 'lose' ? fairness(C, s0, b0.t, design, P, ctx) : { fair: null, why: [], skipped: 'bait wins at the loosest spare' };
  return finish(design, roles, ctx, P, b0.t, b0.price, { card: { fair: fork.fair, fairWhy: fork.why, baits: pr.baits.map(bt), control: pr.control, idle: { kNoIce, kNoLock, k }, keyUnderGuard: bait.keyA, guard: bait.guard, freeKey: bait.keyB,
    keysTakenAt: [Math.min(ia, ib) + 1, Math.max(ia, ib) + 1] }, facts: { fork, control: pr.control } });
}
// fairFork at the opening (all 100% of the tiles left); face-down tiles that are not free are unseen
function fairness(C, s, t, design, P, ctx) {
  const { w, g, nShipMax } = P.work, unseen = [];
  for (const i of design.down || []) if (s.alive[i] && !L.isFree(i, s.alive, g.nb)) unseen.push(i);
  const f = Pk.fairFork(C, s, t, { unseen, perms: 4, seed: 1, nShipMax, w, nodes: 60000, memo: new Map() });
  return { fair: f.fair, unfair: f.unfair, unknown: f.unknown, why: f.why, checks: f.checks };
}

// ---------- chain traps: a small compositional generator (Dennis 2026-11-13: "make levels that combine freeze clock and locks, those are
// most fun" / "the clock doesn't necessarily have to be frozen. The locks or keys can too, or the way to the clock or lock. Make it smarter and more versatile") ----------
// The goal is the clock. A chain shape says WHERE the obstacles sit; each obstacle needs another thing to go first:
//   clock<lock           the clock is locked: both keys must go first           clock<ice          the clock is frozen: 2 of its neighbours go first
//   clock<cover:ice|lock a tile lying on the clock is frozen / locked           thaw<lock|ice      one neighbour that can melt the frozen tile (the clock, or its frozen
//                                                                                 cover) is itself locked / frozen (a frozen or locked tile on the way)
//   keyA<cover:ice       key A lies under exactly one frozen tile               keyA<way:ice       key A lies under 2+ tiles, the one next to it is frozen
//   keyB<cover:ice       the second key too                                    (a frozen KEY TILE is not built: the game shows ice instead of the key - one overlay per tile, see UI note)
// Obstacle kinds: lock (opens when both keys are gone), ice (h = 2 neighbours gone), cover (tiles on top / blocking a side).
// A shape is a flag set (CHAIN_DEFS); its signature string is the story's shape name. Baits come from the chain and are proven by the engine:
//   keyEarly          the free key B taken early waits in the tray through the dig        lonelyNeighbour   melting with a free neighbour whose twin is buried
// Every special must matter (removing any one lock or ice shortens the proven clock route, or the bait turns harmless) and be connected to the chain.
const CHAIN_DEFS = [
  { ck: 'lock', keyA: 'cover' },                                         // 2  lock on the clock + frozen key cover
  { ck: 'lock', keyA: 'way' },                                           // 2  lock on the clock + frozen way tile to a key
  { ck: 'lock', cover: 'ice' },                                          // 2  lock on the clock + a frozen cover of the clock
  { ck: 'ice', nb: 'lock' },                                             // 2  frozen clock, one thaw-neighbour locked
  { ck: 'ice', nb: 'ice' },                                              // 2  frozen clock, one thaw-neighbour frozen (frozen way tile to the clock)
  { ck: 'plain', cover: 'ice', nb: 'lock' },                             // 2  clock under a frozen cover, whose thaw-neighbour is locked
  { ck: 'plain', cover: 'ice', nb: 'ice' },                              // 2  clock under a frozen cover, whose thaw-neighbour is frozen
  { ck: 'plain', cover: 'lock', keyA: 'cover' },                         // 2  lock on a clock cover + frozen key cover
  { ck: 'lock', keyA: 'cover', keyB: 'cover' },                          // 3  lock on the clock, both keys under frozen covers
  { ck: 'lock', cover: 'ice', keyA: 'cover' },                           // 3
  { ck: 'lock', cover: 'ice', nb: 'ice' },                               // 3  lock on the clock, frozen cover, frozen thaw-neighbour
  { ck: 'ice', nb: 'lock', keyA: 'cover' },                              // 3  frozen clock, locked thaw-neighbour, frozen key cover
  { ck: 'ice', nb: 'lock', keyA: 'way' },                                // 3
  { ck: 'plain', cover: 'ice', nb: 'lock', keyA: 'cover' },              // 3  frozen clock cover, locked thaw-neighbour, frozen key cover
  { ck: 'ice', nb: 'lock', keyA: 'cover', keyB: 'cover' },               // 4
  { ck: 'lock', cover: 'ice', nb: 'ice', keyA: 'cover' },                // 4
  // ---- 2026-11-13 (lab 5: the 3-4 link chains were rated 4-5 stars, the 2-link ones "too easy to see the right route"). Indices 16+ are new; 0-15 keep their numbers.
  // 'frozen' = the key tile ITSELF is frozen (ice 2); 'lockIce' = the tile is locked AND frozen. Both show only the ice overlay in the game today: needsUi 'frozen-key-marker'.
  { ck: 'lock', keyA: 'frozen', keyB: 'cover' },                           // 16 3  lock on the clock, one key frozen itself, the other under a frozen tile
  { ck: 'lock', keyA: 'frozen', keyB: 'frozen' },                          // 17 3  both keys frozen
  { ck: 'ice', nb: 'lock', keyA: 'frozen' },                               // 18 3  frozen clock, locked thaw-neighbour, a frozen key
  { ck: 'lock', cover: 'ice', keyA: 'frozen' },                            // 19 3  lock on the clock, frozen cover, a frozen key
  { ck: 'ice', nb: 'lockIce' },                                            // 20 3  frozen clock, a thaw-neighbour that is locked AND frozen
  { ck: 'ice', nb: 'lockIce', keyA: 'cover' },                             // 21 4  ... and a key under a frozen tile
  { ck: 'lockIce', keyA: 'cover' },                                        // 22 3  the clock itself frozen and locked, a key under a frozen tile
  { ck: 'plain', cover: 'ice', nb: 'lockIce' },                            // 23 3  frozen clock cover, whose thaw-neighbour is locked and frozen
  { ck: 'lock', keyA: 'way', keyB: 'way' },                                // 24 3  lock on the clock, the way to both keys passes a frozen tile
  { ck: 'ice', nb: 'lock', keyA: 'way', keyB: 'cover' },                   // 25 4  frozen clock, locked thaw-neighbour, a frozen way tile and a frozen key cover
  { ck: 'lock', cover: 'lockIce', keyA: 'cover' },                         // 26 4  two locks (clock and its cover, one key pair opens both), the cover also frozen, a frozen key cover
  { ck: 'lock', cover: 'ice', nb: 'ice', keyA: 'frozen' },                 // 27 4  lock on the clock, frozen cover, frozen thaw-neighbour, a frozen key
  { ck: 'lockIce', cover: 'ice' },                                         // 28 3  clock frozen and locked under a frozen cover
  { ck: 'lock', keyA: 'frozen', keyB: 'way' },                             // 29 3  one frozen key, the way to the other passes a frozen tile
  // frozen tiles on the way to a key, combined with what builds well
  { ck: 'lock', cover: 'ice', keyA: 'way' },                               // 30 3  lock on the clock, frozen cover, a frozen way tile to a key
  { ck: 'lock', keyA: 'way', keyB: 'cover' },                              // 31 3  lock on the clock, a frozen way tile to one key, the other key under a frozen tile
  { ck: 'plain', cover: 'ice', nb: 'lock', keyA: 'way' },                  // 32 3  frozen clock cover, locked thaw-neighbour, a frozen way tile to a key
  { ck: 'plain', cover: 'lock', keyA: 'cover', keyB: 'cover' },            // 33 3  lock on a clock cover, both keys under frozen tiles
  { ck: 'lock', cover: 'ice', keyA: 'cover', keyB: 'cover' },              // 34 4  lock on the clock, frozen cover, both keys under frozen tiles
  { ck: 'ice', nb: 'lock', keyB: 'cover' },                                // 35 3  frozen clock, locked thaw-neighbour, the second key under a frozen tile
  { ck: 'plain', cover: 'ice', nb: 'lock', keyB: 'cover' },                // 36 3  frozen clock cover, locked thaw-neighbour, the second key under a frozen tile
  { ck: 'lock', cover: 'ice', keyA: 'cover', keyB: 'way' },                // 37 4  lock on the clock, frozen cover, a frozen key cover and a frozen way tile
  { ck: 'plain', cover: 'lock', keyA: 'way', keyB: 'cover' },              // 38 3  lock on a clock cover, a frozen way tile to one key, the other key under a frozen tile
  { ck: 'ice', nb: 'lock', keyA: 'way', keyB: 'way' },                     // 39 4  frozen clock, locked thaw-neighbour, a frozen way tile to each key
  { ck: 'lock', cover: 'ice', nb: 'lock' },                                // 40 3  two locks (clock and a thaw-neighbour of its frozen cover, one key pair opens both)
];
const chainSig = d => [
  d.ck === 'lock' ? 'clock<lock' : d.ck === 'ice' ? 'clock<ice' : d.ck === 'lockIce' ? 'clock<lockIce' : null,
  d.cover ? 'clock<cover:' + d.cover : null,
  d.nb ? (d.ck === 'ice' || d.ck === 'lockIce' ? 'thaw<' : 'coverThaw<') + d.nb : null,
  d.keyA ? (d.keyA === 'frozen' ? 'keyA<frozen' : 'keyA<' + d.keyA + ':ice') : null,
  d.keyB ? (d.keyB === 'frozen' ? 'keyB<frozen' : 'keyB<' + d.keyB + ':ice') : null].filter(Boolean).join('; ');
const part = x => x === 'lockIce' ? 2 : x && x !== 'plain' ? 1 : 0;   // obstacles an entry stands for (a locked AND frozen tile is two)
const CHAIN = {}; for (const d of CHAIN_DEFS) { d.sig = chainSig(d); d.length = part(d.ck) + part(d.cover) + part(d.nb) + (d.keyA ? 1 : 0) + (d.keyB ? 1 : 0);
  d.frozenKey = d.keyA === 'frozen' || d.keyB === 'frozen'; d.lockedFrozen = d.ck === 'lockIce' || d.cover === 'lockIce' || d.nb === 'lockIce'; d.needsUi = d.frozenKey || d.lockedFrozen ? 'frozen-key-marker' : null; CHAIN[d.sig] = d; }
const CHAIN_SHAPES = CHAIN_DEFS.map(d => d.sig);
// rich first: shape indices with 3-4 links (the ones Dennis rated 4-5 stars), longest first; the 2-link shapes stay available but are flagged easy (card.trap.links = 2, card.trap.easy)
const CHAIN_RICH = CHAIN_DEFS.map((d, i) => i).filter(i => CHAIN_DEFS[i].length >= 3).sort((a, b) => CHAIN_DEFS[b].length - CHAIN_DEFS[a].length || a - b), CHAIN_EASY = CHAIN_DEFS.map((d, i) => i).filter(i => CHAIN_DEFS[i].length <= 2);
// a UI limitation, checked in www/js/board.js + specials.js (obKind): one overlay per tile, ice before lock before key: a FROZEN KEY shows only the ice,
// a frozen LOCKED tile shows only the ice. So no tile carries two roles: frozen keys / frozen locked tiles are expressed through their covers and neighbours.
const CHAIN_UI_NOTE = "obKind() shows one overlay per tile (ice, else lock, else key): a tile that is both frozen and a key (or locked) shows only the ice until the display fix lands (another agent, 2026-11-13). Shapes with a frozen key or a frozen locked tile are built and marked card.trap.needsUi = 'frozen-key-marker'; they are for Dennis only after that fix.";

const cost1 = (c, j) => digCost(c, j);
function digDrop(c, roles, drops, rng) {   // drops: Map frozen tile -> Set of its neighbours that the plan must not count on
  if (!drops.size) return B.planDig(c, roles, rng);
  const inb = c.inb.map((a, i) => drops.has(i) ? a.filter(j => !drops.get(i).has(j)) : a);
  return B.planDig({ ...c, inb }, roles, rng);
}
// twins for the lonely neighbours: visible, buried (2+ covers), outside the dig and the mechanism
function pickTwins(c, v, rng, wrong, mech, P) {
  const twins = [], taken = new Set([...mech, ...wrong, ...P]);
  for (const l of wrong) {
    const cand = [...Array(c.n).keys()].filter(t => !taken.has(t) && !twins.includes(t) && c.above[t].size >= 2 && v[t].picture && !c.above[t].has(l) && !c.above[l].has(t)
      && [...c.above[t]].every(j => !mech.has(j) && !wrong.includes(j) && !P.includes(j)));
    if (!cand.length) return null;
    twins.push(shuffle(rng, cand.sort((a, b) => c.above[b].size - c.above[a].size).slice(0, 6))[0]);
  }
  return twins;
}
// a frozen tile g (ice 2) that can sit on key `A` as its only cover (mode 'cover') or as the cover next to it under another cover (mode 'way')
function keyGuard(c, v, rng, mode, used, avoidKey) {
  const out = [];
  for (let A = 0; A < c.n; A++) {
    if (used.has(A) || avoidKey.has(A) || !c.roleShown0[A] || !v[A].role) continue;
    const cov = [...c.above[A]]; if ([...cov].some(j => used.has(j))) continue;
    if (mode === 'cover') { if (cov.length !== 1) continue; const g = cov[0]; if (!c.free0[g] || c.above[g].size || !c.roleShown0[g] || !v[g].role) continue; const nb = thawNbs(c, g); if (nb.length < 2 || nb.length > 5) continue; out.push([A, g]); }
    else { if (cov.length < 2 || cov.length > 3) continue; for (const w of cov) if (c.above[w].size >= 1 && cov.some(x => c.above[w].has(x)) && c.roleShown0[w] && v[w].role) { const nb = thawNbs(c, w); if (nb.length >= 2 && nb.length <= 5) out.push([A, w]); } }
  }
  return shuffle(rng, out);
}
// The dig order planDig gives takes the highest tiles first, so the tiles the free key's partner needs may come after unrelated ones: then the early free key is harmless
// (a route exists that takes the keys before the orphans pile up). keysFirst re-orders the dig so the way to the far key A comes first, then the free key B, then the rest in the old order:
// the orphans are then A's own prerequisites and taking B early holds a slot through all of them. Null when A's own dig leaves the planned dig, or the order is not legal.
function keysFirst(c, roles, P, keyB, rng) {
  const A = roles.keys.find(k => k !== keyB), fake = { ...roles, clock: A, locks: new Set(), keys: [], holderSpecials: new Set() }, P1 = B.planDig(c, fake, rng);
  if (!P1 || P1[P1.length - 1] !== A) return null;
  const inP = new Set(P); if (P1.some(t => !inP.has(t))) return null;
  const Pn = P1.concat([keyB], P.filter(t => !P1.includes(t) && t !== keyB)), al = new Uint8Array(c.n).fill(1), all = al.slice();
  const rules = { ice: roles.ice, iceNb: c.inb, locks: roles.locks.size ? new Set(roles.locks) : null, keys: roles.locks.size ? roles.keys.slice() : [] };
  for (const t of Pn) { if (!L.takeable(t, al, c.nb, rules, all)) return null; al[t] = 0; }
  return Pn.length === P.length ? Pn : null;
}

function placeChain(c, brief, rng) {
  const d = CHAIN[brief.chain]; if (!d) return { fail: 'unknownChainShape' };
  const tg = brief.targets || {}, v = vis0Of(c), pre = tg.digBefore || [4, 7], kc = tg.keyCover || [1, 3], nWrongMax = tg.wrongMelts ?? 1;
  const usesLock = [d.ck, d.cover, d.nb].some(x => x === 'lock' || x === 'lockIce');
  const depth = brief.frame?.depth != null ? [brief.frame.depth, brief.frame.depth] : d.cover ? [1, 2] : [0, 2];
  const clocks = shuffle(rng, [...Array(c.n).keys()].filter(i => c.above[i].size >= depth[0] && c.above[i].size <= depth[1] && c.roleShown0[i]));
  let tried = 0;
  for (const ck of clocks) {
    if (++tried > 90) return { fail: 'noChain' };
    const roles = emptyRoles(ck), links = [], used = new Set([ck, ...c.above[ck]]);
    let F = null, g = null;
    if (d.ck === 'lock' || d.ck === 'lockIce') roles.locks.add(ck); if (d.ck === 'ice' || d.ck === 'lockIce') { roles.ice[ck] = 2; F = ck; }
    if (d.cover) {
      const gs = [...c.above[ck]].filter(j => c.free0[j] && !c.above[j].size && c.roleShown0[j] && v[j].role);
      if (!gs.length) { no('ch:noCover'); continue; }
      g = gs[Math.floor(rng() * gs.length)]; links.push([ck, g]); used.add(g);
      if (d.cover === 'ice' || d.cover === 'lockIce') { roles.ice[g] = 2; if (F == null) F = g; } if (d.cover === 'lock' || d.cover === 'lockIce') roles.locks.add(g);
    }
    // the neighbours that can melt F: lonely free ones (the bait), the special one (locked / frozen), the plain ones that go with it
    let wrong = [], right = [], others = [], special = null, nbs = []; const drops = new Map(), hostOf = new Map();
    if (F != null) {
      nbs = thawNbs(c, F).filter(j => !used.has(j));
      const covIn = c.inb[F].filter(j => c.above[F].has(j)).length, need = 2 - covIn;
      if ((need < 1 || need > 2) && no('ch:need')) continue;
      if ((nbs.length < need || nbs.length > 8) && no('ch:nbCount')) continue;
      const free = nbs.filter(j => c.free0[j] && !c.above[j].size);
      wrong = shuffle(rng, free).slice(0, Math.min(nWrongMax, free.length));
      const rest = nbs.filter(j => !wrong.includes(j)).sort((a, b) => cost1(c, a) - cost1(c, b) || a - b);
      if (d.nb) {
        const sp = rest.filter(j => c.roleShown0[j] && v[j].role && c.above[j].size <= 2 && (!(d.nb === 'ice' || d.nb === 'lockIce') || thawNbs(c, j).filter(x => x !== F && !used.has(x)).length >= 2));
        if (!sp.length && no('ch:noSpecial')) continue;
        special = shuffle(rng, sp.slice(0, 3))[0];
      }
      const plain = rest.filter(j => j !== special);
      right = (special != null ? [special] : []).concat(plain.slice(0, need - (special != null ? 1 : 0)));
      if ((right.length < need || (right.length > (special != null ? 1 : 0) && cost1(c, right[right.length - 1]) > (tg.rightCost || 6))) && no('ch:rightDear')) continue;
      others = rest.filter(j => !right.includes(j));
      if (others.some(j => c.free0[j] && !c.above[j].size) && no('ch:freeAlt')) continue;   // a free neighbour that is neither lonely nor right = a cheap way round
      if (special != null) { if (d.nb === 'lock' || d.nb === 'lockIce') roles.locks.add(special); if (d.nb === 'ice' || d.nb === 'lockIce') roles.ice[special] = 2; links.push([F, special]); }
      for (const j of right) if (j !== special) links.push([F, j]);
      for (const j of wrong) { links.push([F, j]); hostOf.set(j, F); }
      drops.set(F, new Set([...wrong, ...others]));
    }
    const thawArea = new Set([ck, ...c.above[ck], ...(F != null ? [F, ...c.above[F], ...nbs, ...nbs.flatMap(j => [...c.above[j]])] : [])]);
    // the keys
    let keyEarly = null;
    if (usesLock) {
      const modeA = d.keyA || 'far', modeB = d.keyB || 'free', picked = new Set(thawArea);
      let A = null, B2 = null, guards = {};
      const frozenKey = (avoid) => {   // a key tile that is frozen itself (ice 2): 0-1 covers, 2-5 thaw-neighbours that are not in use, far from the clock
        const cs = [...Array(c.n).keys()].filter(i => !picked.has(i) && !avoid.has(i) && c.roleShown0[i] && v[i].role && c.above[i].size <= 1 && ![...c.above[i]].some(j => picked.has(j))
          && c.dist(i, F ?? ck) >= 3 && thawNbs(c, i).length >= 2 && thawNbs(c, i).length <= 5 && thawNbs(c, i).every(j => !picked.has(j))
          && thawNbs(c, i).filter(j => c.above[j].size >= 1).length >= 2 && !thawNbs(c, i).some(j => c.free0[j] && !c.above[j].size));   // its thaw-neighbours lie under tiles: the way to the key is forced, no free pair melts it for nothing
        return cs.length ? shuffle(rng, cs.sort((a, b) => c.dist(b, F ?? ck) - c.dist(a, F ?? ck)).slice(0, 5))[0] : null;
      };
      if (modeA === 'frozen') {
        A = frozenKey(new Set()); if (A == null) { no('ch:noFrozenKey'); continue; } roles.ice[A] = 2; guards.A = A;
      } else if (modeA === 'far') {
        const fars = keyCands(c, ck, picked, kc, [pre[0] - 1, pre[1] + 1]).sort((a, b) => c.dist(b, ck) - c.dist(a, ck)).slice(0, 8);
        if (!fars.length) { no('ch:noFarKey'); continue; } A = shuffle(rng, fars.slice(0, 4))[0];
      } else {
        const gl = keyGuard(c, v, rng, modeA, picked, new Set()); if (!gl.length) { no('ch:noKeyGuard'); continue; }
        [A, guards.A] = gl[0]; roles.ice[guards.A] = 2; links.push([A, guards.A]);
      }
      for (const j of [A, ...(guards.A != null ? [guards.A, ...c.above[A], ...thawNbs(c, guards.A), ...thawNbs(c, guards.A).flatMap(x => [...c.above[x]])] : c.above[A])]) picked.add(j);
      if (modeB === 'free') {
        const Bs = [...Array(c.n).keys()].filter(i => !picked.has(i) && c.free0[i] && !c.above[i].size && c.roleShown0[i] && v[i].role && c.dist(i, F ?? ck) >= 4 && c.dist(i, A) >= 3)
          .sort((a, b) => c.dist(b, F ?? ck) - c.dist(a, F ?? ck)).slice(0, 6);
        if (!Bs.length) { no('ch:noFreeB'); continue; } B2 = shuffle(rng, Bs.slice(0, 3))[0]; keyEarly = B2;
      } else if (modeB === 'frozen') {
        B2 = frozenKey(new Set([A])); if (B2 == null) { no('ch:noFrozenKeyB'); continue; } roles.ice[B2] = 2; guards.B = B2;
      } else {
        const gl = keyGuard(c, v, rng, modeB, picked, new Set([A])); if (!gl.length) { no('ch:noKeyGuardB'); continue; }
        [B2, guards.B] = gl[0]; roles.ice[guards.B] = 2; links.push([B2, guards.B]);
      }
      roles.keys = [A, B2];
      // no free key and no lonely neighbour yet: a lonely free neighbour of a frozen key cover is the bait
      if (keyEarly == null && !wrong.length) for (const gh of [guards.A, guards.B]) {
        if (gh == null || wrong.length) continue;
        const fr = thawNbs(c, gh).filter(j => c.free0[j] && !c.above[j].size && !picked.has(j) && !roles.keys.includes(j) && !roles.locks.has(j) && !roles.ice[j]);
        if (fr.length >= 1 && thawNbs(c, gh).length - 1 >= (gh === roles.keys[0] || gh === roles.keys[1] ? 1 : 2)) { const l = shuffle(rng, fr)[0]; wrong.push(l); links.push([gh, l]); drops.set(gh, new Set([l])); hostOf.set(l, gh); }
      }
      for (const L of roles.locks) { links.push([L, A], [L, B2]); }
    }
    // the dig: the cheapest legal way to the clock WITHOUT the lonely neighbours and the plain-but-not-right ones (more neighbours only thaw sooner)
    let P = digDrop(c, roles, drops, rng);
    if ((!P || P.length < (tg.minWay ?? 5)) && no('ch:noDig')) continue;
    const evenFirstKey = brief.pressure || CHAIN_DEFS.indexOf(d) >= 16;   // see below
    if (keyEarly != null && evenFirstKey) { const Pn = keysFirst(c, roles, P, keyEarly, rng); if (Pn) P = Pn; else no('ch:keysFirstNo'); }
    if (wrong.some(l => P.includes(l)) && no('ch:wrongInDig')) continue;
    const specialsT = [...roles.locks, ...Object.keys(roles.ice).map(Number)];
    if (specialsT.some(t => !P.includes(t)) && no('ch:specialOffWay')) continue;
    // the free key taken early only bites when the dig holds 2 orphans: those fit (2 waiting + the first key + no open pair = 3, the cap) only when an EVEN number of dig tiles lies before the first key
    // (measured: 0 of 18 odd-position builds were lethal). Applied to the new shapes (index 16+) and whenever a pressure dial is asked for; the old shapes keep their rng stream.
    if (keyEarly != null) { const pk = Math.min(P.indexOf(roles.keys[0]), P.indexOf(roles.keys[1])); if ((pk < pre[0] || pk > pre[1]) && no('ch:digBefore')) continue; if (evenFirstKey && pk % 2 && no('ch:oddFirstKey')) continue; }
    const hostNbs = uniq([...drops.keys(), ...roles.keys.filter(k => roles.ice[k])]).flatMap(h => thawNbs(c, h).flatMap(j => [j, ...c.above[j]]));
    const mech = new Set([...thawArea, ...hostNbs, ...roles.keys, ...roles.keys.flatMap(k => [...c.above[k]]), ...P, ...specialsT]);
    const twins = wrong.length ? pickTwins(c, v, rng, wrong, mech, P) : [];
    if (!twins && no('ch:noTwin')) continue;
    if (!wrong.length && keyEarly == null && no('ch:noBait')) continue;
    roles.dig = P;
    const keep = uniq([ck, ...(g != null ? [g] : []), ...c.above[ck], ...specialsT, ...roles.keys, ...roles.keys.flatMap(k => [...c.above[k]]), ...nbs, ...nbs.flatMap(j => [...c.above[j]]), ...hostNbs, ...twins, ...twins.flatMap(t => [...c.above[t]]), ...wrong,
      ...(F != null ? [F] : []), ...(keyEarly != null ? [keyEarly] : [])]);
    const tiles = (keyEarly != null ? [keyEarly] : []).concat(wrong, twins);
    roles.bait = { type: 'chain', chain: d.sig, def: d, tiles, single: [keyEarly != null ? keyEarly : wrong[0]], pairs: wrong.map((l, i) => [l, twins[i]]), keepUp: keep, keyEarly, wrong: wrong.slice(), twins: twins.slice(),
      links, frozen: F, special, right: right.slice(), clockCover: g };
    return roles;
  }
  return { fail: 'noChain' };
}

// the one-sentence "what the player has to see", from the shape
function chainSee(d, bait) {
  const p = [];
  if (d.ck === 'lock') p.push('the clock is locked, so both keys must go first');
  if (d.ck === 'ice') p.push('the clock is frozen, so two of its neighbours must go first');
  if (d.cover) p.push(`the tile lying on the clock is ${d.cover === 'ice' ? 'frozen and must be thawed first' : 'locked, so both keys must go first'}`);
  if (d.nb) p.push(`one of the neighbours that can melt it is ${d.nb === 'lock' ? 'locked (it needs the keys)' : 'frozen itself (it needs its own neighbours)'}`);
  if (d.keyA === 'cover') p.push('a key lies under a frozen tile, so thaw that tile first');
  if (d.keyA === 'way') p.push('the way to a key runs past a frozen tile, so thaw that tile first');
  if (d.keyB === 'cover') p.push('the other key also lies under a frozen tile');
  const t = [];
  if (bait.keyEarly != null) t.push('do not take the free key early: it would sit in the tray through the whole dig');
  if (bait.wrong.length) t.push('do not melt with the free neighbour whose twin is buried: it would wait in the tray');
  const s = p.join('; ') + (t.length ? ': ' + t.join(', and ') : '');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
// graph of "needs" links: every special (clock, locks, keys, ice) is in the clock's component
function chainConnected(design, roles) {
  const adj = new Map(), add = (a, b) => { (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); (adj.get(b) || adj.set(b, new Set()).get(b)).add(a); };
  for (const [a, b] of roles.bait.links) add(a, b);
  const ob = design.obst, sp = [...(ob.locks || []), ...(ob.keys || []), ...Object.keys(ob.ice || {}).map(Number)], seen = new Set([design.clock.i]), st = [design.clock.i];
  while (st.length) for (const j of adj.get(st.pop()) || []) if (!seen.has(j)) { seen.add(j); st.push(j); }
  const lost = sp.filter(t => !seen.has(t));
  return { ok: !lost.length, disconnected: lost };
}
// does removing special `t` (a lock tile or an ice tile) matter: the proven clock route gets shorter, or the primary bait turns harmless
function chainIdle(design, roles, ctx, P, baitsKept) {
  const { k, spare } = ctx, ob = design.obst, rows = [];
  const harmless = mod => {
    const d2 = JSON.parse(JSON.stringify({ ...design, obst: { ...design.obst, ...mod } })); let C2, g2, s2;
    try { C2 = D.clockGames(d2); g2 = C2.at(d2.clock.n); s2 = E.start(g2); } catch (e) { return false; }
    const legal = new Set(E.legal(g2, s2).filter(a => typeof a === 'number'));
    for (const b of baitsKept) {
      if (!b.tiles.every(i => legal.has(i))) continue;
      const w2 = D.work(1.5e6), p = priceBait(C2, s2, b.t, k, P.work.nShipMax, w2);
      if (!p.exact || p.result === 'unknown') return false;
      if (provenCost(p, spare)) return false;
    }
    return true;
  };
  if ((ob.locks || []).length > 1) {   // several locked tiles, ONE key pair opens them all: no single lock is needed on its own - the set is (remove every lock: the route gets shorter)
    const kk = kWith(design, { locks: [], keys: [] }); if (kk == null) return { ok: false, why: 'idleUnproven:lockGroup', rows };
    rows.push({ kind: 'lockGroup', tiles: ob.locks.slice(), kWithout: kk, k }); if (!(kk < k)) return { ok: false, why: 'lockGroupIdle:' + kk + '>=' + k, rows };
  } else for (const t of ob.locks || []) {
    const locks = ob.locks.filter(x => x !== t), kk = kWith(design, { locks });
    if (kk == null) return { ok: false, why: 'idleUnproven:lock' + t, rows };
    const row = { kind: 'lock', tile: t, kWithout: kk, k }; rows.push(row);
    if (!(kk < k)) { if (harmless({ locks })) row.harmlessBait = true; else return { ok: false, why: 'lockIdle:' + t + ':' + kk + '>=' + k, rows }; }
  }
  for (const t of Object.keys(ob.ice || {}).map(Number)) {
    const ice = { ...ob.ice }; delete ice[t]; const kk = kWith(design, { ice });
    if (kk == null) return { ok: false, why: 'idleUnproven:ice' + t, rows };
    const row = { kind: 'ice', tile: t, kWithout: kk, k }; rows.push(row);
    if (!(kk < k)) { if (harmless({ ice })) row.harmlessBait = true; else return { ok: false, why: 'iceIdle:' + t + ':' + kk + '>=' + k, rows }; }
  }
  return { ok: true, rows };
}
// ---------- tray pressure and first moves (Dennis, lab 5 on 296: "the trap is too easy ... make it smarter or a bit more tray pressure") ----------
// Read along the stored (right) route up to and including the clock tile, strict rules. occ[p] = tiles waiting after move p.
//   peak            most tiles waiting (3 is the cap: a 4th loses)             run2        longest run of consecutive moves with 2 or more waiting
//   at3             moves that end with 3 waiting (every tap that does not match then loses)       waiters  tiles that wait 3+ moves before their twin comes (the orphans of the dig)
//   twinAfterClock  tiles still waiting when the clock is taken (their twins come only after it)
function pressureOf(design) {
  const g = E.game(design, { strict: true }), sol = design.solution, ci = sol.indexOf(design.clock.i); let s = E.start(g);
  const occ = [], since = new Map(), waiters = []; let run = 0, run2 = 0, runEnd = -1;
  for (let p = 0; p <= ci; p++) {
    const t = sol[p], q = s.tray.findIndex(x => g.faces[x] === g.faces[t]); if (q >= 0 && p - since.get(s.tray[q]) >= 3) waiters.push({ tile: s.tray[q], from: since.get(s.tray[q]), to: p });
    s = E.step(g, s, t); if (!s) return null; if (q < 0) since.set(t, p);
    occ.push(s.tray.length); if (s.tray.length >= 2) { run++; if (run > run2) { run2 = run; runEnd = p; } } else run = 0;
  }
  const open = s.tray.slice();
  return { k: ci + 1, occ: occ.join(''), peak: Math.max(0, ...occ), run2, run2From: runEnd < 0 ? null : runEnd - run2 + 1, at3: occ.filter(x => x === 3).length, moves2plus: occ.filter(x => x >= 2).length,
    waiters: waiters.length, waiterTiles: waiters, twinAfterClock: open.length, openAtClock: open.slice() };
}
// can the board be won while at most `cap` tiles ever wait (peek pairs and the clock included)? 'win' | 'lose' | 'unknown'
function winnableWithin(g, s0, cap, budget) {
  const dead = new Set(); let nodes = 0; const BUD = {};
  const key = s => { let k = ''; for (let i = 0; i < s.alive.length; i += 8) { let b = 0; for (let j = 0; j < 8 && i + j < s.alive.length; j++) if (s.alive[i + j]) b |= 1 << j; k += String.fromCharCode(48 + (b >> 4), 48 + (b & 15)); }
    return k + '|' + s.tray.map(t => g.faces[t]).sort((a, b) => a - b).join(',') + (s.clockTaken ? '' : '#' + s.moves); };
  const rec = s => {
    if (E.won(g, s)) return true; if (++nodes > budget) throw BUD;
    const k = key(s); if (dead.has(k)) return false;
    const tf = new Set(s.tray.map(t => g.faces[t])), acts = E.legal(g, s).sort((a, b) => (tf.has(g.faces[typeof b === 'object' ? b.pair[0] : b]) ? 1 : 0) - (tf.has(g.faces[typeof a === 'object' ? a.pair[0] : a]) ? 1 : 0));
    for (const a of acts) { const s2 = E.step(g, s, a); if (!s2 || s2.tray.length > cap) continue; if (rec(s2)) return true; }
    dead.add(k); return false;
  };
  try { return rec(s0) ? 'win' : 'lose'; } catch (e) { if (e === BUD) return 'unknown'; throw e; }
}
// the heavier facts of a proven board (engine only, budgeted): the least tray the board needs, and how many first moves keep it winnable
function pressureFacts(design, opts = {}) {
  const P = pressureOf(design), C = D.clockGames(design), g = C.at(design.clock.n), s0 = E.start(g), budget = opts.capNodes ?? 80000;
  const need = { cap1: winnableWithin(g, s0, 1, budget), cap2: winnableWithin(g, s0, 2, budget) };
  // every winning play holds at least `needsWaiting` tiles at some moment (a proven lower bound; 'unknown' stops the claim)
  const needsWaiting = need.cap1 === 'lose' ? (need.cap2 === 'lose' ? 3 : need.cap2 === 'win' ? 2 : 2) : need.cap1 === 'win' ? 1 : 1;
  const proven = need.cap1 === 'lose' && need.cap2 !== 'unknown' ? true : need.cap1 === 'win' ? true : false;
  const w = D.work(opts.firstNodes ?? 1.5e6), moves = E.legal(g, s0).filter(a => typeof a === 'number'), rows = []; let ok = 0, unknown = 0;
  for (const m of moves) {
    const s1 = E.step(g, s0, m); if (!s1) { rows.push({ tile: m, result: 'lose' }); continue; }
    if (E.won(g, s1)) { rows.push({ tile: m, result: 'win' }); ok++; continue; }
    const r = w.win(g, s1, 100000); rows.push({ tile: m, result: r.result }); if (r.result === 'win') ok++; else if (r.result === 'unknown') unknown++;
  }
  return { ...P, capProof: need, needsWaiting, needsWaitingProven: proven, firstMoves: { legal: moves.length, winning: ok, unknown, rows: rows.filter(r => r.result !== 'win').map(r => r.tile), atLeast3: ok >= 3 } };
}

function proveChain(design, roles, ctx) {
  const P = baseProof(design, roles, ctx, 'chain'); if (P.why) return P;
  const { k, spare, c } = ctx, { C, s0, nShipMax, w } = P.work, bait = roles.bait, d = bait.def, sol = design.solution, ci = sol.indexOf(design.clock.i);
  if (ci + 1 !== k) { P.why = 'storedRouteNotShortest'; return P; }
  const con = chainConnected(design, roles); if (!con.ok) { P.why = 'notConnected:' + con.disconnected.join(','); return P; }
  // the stored (right) route uses every lock and ice tile before the clock
  const specials = [...(design.obst.locks || []), ...Object.keys(design.obst.ice || {}).map(Number)];
  if (specials.some(t => sol.indexOf(t) < 0 || sol.indexOf(t) > ci)) { P.why = 'routeAvoidsSpecial'; return P; }
  // the pressure dial (brief.pressure = { run2, at3 }): the stored route keeps 2+ tiles waiting for run2 moves in a row and sits at 3 waiting at3 times
  const press = pressureOf(design), dial = ctx.brief?.pressure || null;
  if (!press) { P.why = 'noPressure'; return P; }
  if (dial && ((dial.run2 != null && press.run2 < dial.run2) || (dial.at3 != null && press.at3 < dial.at3))) { P.why = 'pressureLow:' + press.run2 + '/' + press.at3; return P; }
  const list = []; if (bait.keyEarly != null) list.push({ name: 'keyEarly', take: [bait.keyEarly] }); for (const l of bait.wrong) list.push({ name: 'lonelyNeighbour', take: [l] });
  // price each designated bait (cheap, fails fast); the control (24 more prices) only for boards that have a costly bait and no idle special
  const cand = [], dropped = [];
  for (const b of list) {
    const t = { kind: b.take.length > 1 ? 'pair' : 'single', take: b.take }, price = priceBait(C, s0, t, k, nShipMax, w);
    if (provenCost(price, spare)) cand.push({ name: b.name, tiles: b.take.slice(), result: price.result, cost: price.cost, exact: price.exact, price, t });
    else dropped.push({ name: b.name, result: price.result, cost: price.cost, exact: price.exact, why: 'notCostly' });
  }
  if (!cand.length && process.env.DBG3 && bait.keyEarly != null) { const g2 = C.at(k), s1 = E.step(g2, E.start(g2), bait.keyEarly), w1 = s1 && E.winnable(g2, s1, { nodes: 300000, ms: 20000 }); console.log('CHAINDBG2 B', bait.keyEarly, 'A', roles.keys.filter(x => x !== bait.keyEarly), 'after B first:', w1 && w1.result, JSON.stringify(w1 && w1.path), 'faces of sol head', sol.slice(0, ci + 1).map(t => design.faces[t]).join(',')); }
  if (!cand.length && process.env.DBG3) console.log('CHAINDBG', d.sig, 'k', k, 'occ', press.occ, 'keys', design.obst.keys.join(','), 'ice', JSON.stringify(design.obst.ice), 'locks', design.obst.locks.join(','), 'sol', sol.slice(0, ci + 1).join(','), 'down', (design.down || []).length);
  if (!cand.length) { P.why = 'noProvenBait:' + dropped.map(x => x.name + ':' + x.result + ':' + x.cost).join('|'); return P; }
  const idle = chainIdle(design, roles, ctx, P, cand); if (!idle.ok) { P.why = idle.why; return P; }
  const control = controlOf(design, roles, ctx, P); if (control.unknown) { P.why = 'controlUnknown'; return P; }
  const kept = [];
  for (const b of cand) { b.value = num(b.price, control.cap); if (b.value > control.value && kept.length < 2) kept.push(b); else dropped.push({ name: b.name, result: b.result, cost: b.cost, exact: b.exact, why: 'notAboveControl' }); }
  if (!kept.length) { P.why = 'noBaitAboveControl:' + dropped.map(x => x.name + ':' + x.result + ':' + x.cost + ':' + x.why).join('|') + ':ctrl' + control.value; return P; }
  const b0 = kept[0], fork = b0.result === 'lose' ? fairness(C, s0, b0.t, design, P, ctx) : { fair: null, why: [], skipped: 'bait wins at the loosest spare' };
  const see = chainSee(d, { keyEarly: kept.some(b => b.name === 'keyEarly') ? bait.keyEarly : null, wrong: kept.filter(b => b.name === 'lonelyNeighbour').map(b => b.tiles[0]) });   // only the baits that are proven
  // the card's bait is the proven ones only
  roles.bait.tiles = uniq(kept.flatMap(b => b.name === 'lonelyNeighbour' ? [b.tiles[0], bait.twins[bait.wrong.indexOf(b.tiles[0])]] : b.tiles)); roles.bait.see = see;
  return finish(design, roles, ctx, P, b0.t, b0.price, { card: { shape: d.sig, trapType: 'chain:' + d.sig, chainLength: d.length, fair: fork.fair, fairWhy: fork.why, baits: kept.map(bt), droppedBaits: dropped, control, idle: idle.rows, links: d.length, easy: d.length <= 2, linkPairs: bait.links.map(l => l.slice()), needsUi: d.needsUi || null, frozenKey: d.frozenKey, lockedFrozen: d.lockedFrozen, pressureDial: dial,
    pressure: { k: press.k, peak: press.peak, run2: press.run2, run2From: press.run2From, at3: press.at3, moves2plus: press.moves2plus, waiters: press.waiters, twinAfterClock: press.twinAfterClock, occ: press.occ },
    connected: con.ok, specials: { locks: design.obst.locks.slice(), keys: design.obst.keys.slice(), ice: { ...design.obst.ice } }, uiNote: CHAIN_UI_NOTE }, facts: { fork, control } });
}

// ---------- readable stacking (Dennis, lab 5, level 296 on layout 8 "cross": "I like to see this way of stacking more. You see things better.") ----------
// What sets layout 8 apart (measured over the 48 layouts, all tiles on the board at move 0, geometry as the game draws it):
//   it is deep (89% of the tiles lie under another, up to 8 tiles above one, 5 layers) AND the stacks are staggered by half a tile in both directions (no layout stacks exactly aligned),
//   so a covered tile still shows its face: 84% of the covered tiles have their picture readable (the layout average is about 70%; the deep layouts 2, 21, 27 stay near 60-65%).
//   "Stacking you can read" = how many of ALL tiles lie under something and can still be read, plus how many pictures are visible at all, plus the mean uncovered share, minus the tiles that are mostly hidden.
//     readStack = coveredShare * share of covered tiles whose picture is visible        picVis = share of tiles whose picture is visible        meanShown = mean uncovered share (shown.js)
//     hidden    = share of tiles with less than 45% of the face uncovered
//   score = 0.45 readStack + 0.30 picVis + 0.15 meanShown + 0.10 (1 - hidden), each min-max scaled over the 48 layouts. Layout 8 ranks 13th, in the top third (16).
function readableLayouts() {
  const rows = B.LAYOUTS.map((l, idx) => {
    const T = l.tiles.map(t => ({ x: t[0], y: t[1], z: t[2] })), n = T.length, nb = L.neighbors(T), sh = shownAll(T);
    const vis = tileVisibility(T, { alive: new Uint8Array(n).fill(1), down: new Uint8Array(n), openPeek: -1 }, null).tiles;
    const above = nb.above.map(a => a.size !== undefined ? a.size : a.length), cov = [...Array(n).keys()].filter(i => above[i] > 0);
    const covRead = cov.length ? cov.filter(i => vis[i].picture).length / cov.length : 1;
    return { layout: idx, shape: l.shape, tiles: n, layers: Math.max(...T.map(t => t.z)) + 1, maxDepth: Math.max(...above), meanDepth: +(above.reduce((a, b) => a + b, 0) / n).toFixed(2),
      coveredShare: +(cov.length / n).toFixed(3), coveredReadable: +covRead.toFixed(3), readStack: +(covRead * cov.length / n).toFixed(3), picVis: +(vis.filter(v => v.picture).length / n).toFixed(3),
      meanShown: +(sh.reduce((a, b) => a + b, 0) / n).toFixed(3), hidden: +(sh.filter(x => x < 0.45).length / n).toFixed(3) };
  });
  const mm = k => { const v = rows.map(r => r[k]), lo = Math.min(...v), hi = Math.max(...v); return r => hi > lo ? (r[k] - lo) / (hi - lo) : 0; };
  const nR = mm('readStack'), nP = mm('picVis'), nS = mm('meanShown'), nH = mm('hidden');
  for (const r of rows) r.score = +(0.45 * nR(r) + 0.30 * nP(r) + 0.15 * nS(r) + 0.10 * (1 - nH(r))).toFixed(3);
  const ranked = rows.slice().sort((a, b) => b.score - a.score || a.layout - b.layout).map((r, i) => ({ rank: i + 1, ...r }));
  return { ranked, top: ranked.slice(0, Math.ceil(ranked.length / 3)).map(r => r.layout), reference: { layout: 8, rank: ranked.findIndex(r => r.layout === 8) + 1 } };
}

// ---------- frozen keys and frozen locked tiles (Dennis 2026-11-13: the display fix for the missing marker is being made by another agent) ----------
// Gate A2 (static_gates.js) rejects any tile that carries two roles (ice+key, ice+lock): "the game shows one overlay per tile". For the chain shapes that DEFINE such a tile
// (CHAIN_DEFS frozenKey / lockedFrozen, card needsUi 'frozen-key-marker') that single clause is lifted - only while the story builds and re-proves, only for ice+key / ice+lock tiles,
// and only when A2 is otherwise met (readable, the keys seen early). Every other gate, threshold and profile stays as it is; the card carries needsUi so the board is shown to Dennis only after the display fix.
const FROZEN_OK = roles => roles.length === 2 && roles.includes('ice') && (roles.includes('key') || roles.includes('lock'));
function withFrozenRoles(on, fn) {
  if (!on) return fn();
  const orig = SG.staticGates;
  SG.staticGates = function (design, o = {}, ...rest) {
    const x = orig.call(SG, design, o.stopEarly ? { ...o, stopEarly: false } : o, ...rest), a2 = x.gates && x.gates.A2, rc = a2 && a2.detail && a2.detail.roleConflicts;
    if (a2 && a2.pass !== true && rc && rc.length && rc.every(r => FROZEN_OK(r.roles)) && a2.detail.readable && a2.detail.bothKeysSeenAtMove != null) {
      x.gates.A2 = { ...a2, wasPass: false, pass: true, roleConflictsAllowed: rc.map(r => ({ tile: r.tile, roles: r.roles })), why: 'frozen key / frozen locked tile shape (needsUi frozen-key-marker)' };
      x.pass = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A9'].every(g => x.gates[g].pass === true) && !!(x.shipSpares && x.shipSpares.length);
    }
    return x;
  };
  try { return fn(); } finally { SG.staticGates = orig; }
}
const needsFrozenRoles = name => { const d = CHAIN[name]; return !!(d && d.needsUi); };

// ---------- the stories ----------
const STORIES = {
  lockedMelt: { title: 'Locked melt', sentence: 'A frozen clock whose neighbours are locked, plain or lonely: the keys open the lock, the lonely neighbour and the near key are traps.',
    spec: { keys: 'far', trap: 5 }, place: placeLockedMelt, prove: proveLockedMelt, profile: 'traps-v1' },
  guardedKey: { title: 'Guarded key', sentence: 'A locked clock; one key lies under a frozen tile that must be thawed first, the other key is free and tempting to take at once.',
    spec: { keys: 'far', trap: 4 }, place: placeGuardedKey, prove: proveGuardedKey, profile: 'traps-v1' },
  keyOnClock: { title: 'Key on the clock', sentence: 'A locked clock; one key lies free at it (half on it or on a neighbour), the other is buried far away. Taking the near key first strands it in the tray.',
    spec: { keys: 'far', trap: 1 }, place: placeKeyOnClock, prove: proveKeyOnClock, profile: 'traps-v1' },
  shortThaw: { title: 'The short thaw', sentence: 'A frozen clock: one neighbour is locked, one is cheap, one lies under a free pair. The pair looks like a short melt but costs more than the keys.',
    spec: { keys: 'far', trap: 2 }, place: placeShortThaw, prove: proveShortThaw, profile: 'traps-v1' },
  wrongMelt: { title: 'The wrong melt', sentence: 'A frozen clock with several free neighbours; the one whose twin is buried deep is a trap, the pair that goes together melts it.',
    spec: { trap: 3 }, place: placeWrongMelt, prove: proveWrongMelt, profile: 'traps-v1' },
};
STORIES.chain = { title: 'Chain trap', sentence: 'A chain of obstacles in front of the clock (locks, ice, covers): each needs another one to go first.', spec: { keys: 'far', trap: 6 }, place: placeChain, prove: proveChain, profile: 'traps-v1' };
for (const [k, v] of Object.entries(STORIES)) B.STORIES[k] = v;

// spare 1 by default; when the brief names no spare and no board is honest at spare 1 (A4 needs two winning openings at the shipped
// spare, and a lethal bait leaves few), the build is retried at spare 2 (the spec's dial 1-2). frame.spare fixes it.
function build(name, brief = {}, opts = {}) {
  if (!STORIES[name]) return { fail: 'unknownTrapStory', detail: name };
  if (name === 'chain') {   // the chain shape signature (brief.chain, or brief.shape when it is one); brief.shape would otherwise name the layout shape
    const sig = brief.chain || (CHAIN[brief.shape] ? brief.shape : null); if (!CHAIN[sig]) return { fail: 'unknownChainShape', detail: sig };
    const b2 = { ...brief, chain: sig }; if (CHAIN[b2.shape]) delete b2.shape; brief = b2;
  }
  const VC = require('../builder-next/construct.js'), fixed = brief.frame?.spare != null, spares = fixed ? [brief.frame.spare] : [1, 2];
  let last = null;
  for (const spare of spares) {
    const used = { ...brief, frame: { ...(brief.frame || {}), spare }, targets: { trayRoom: 0, maxDown: 0.2, hiddenOnWay: 0, ...(brief.targets || {}) }, story: name };
    const r = withFrozenRoles(name === 'chain' && needsFrozenRoles(brief.chain), () => VC.build(used, { tries: 40, ...opts }));
    if (r.design) { r.brief = used; r.card.trapType = name === 'chain' ? 'chain:' + brief.chain : name; return r; }
    last = last ? { ...r, fails: { ...Object.fromEntries(Object.entries(last.fails || {}).map(([k, v]) => ['s' + spares[0] + ':' + k, v])), ...r.fails } } : r;
  }
  return last;
}

// ---------- re-proof and twin separation of a built board ----------
// the story proof + static gates (traps-v1, A5 met by the story proof) re-run on a design that kept the same tiles and roles (e.g. after bank/separate.js)
function reprove(name, design, roles, brief, spare, k) {
  return withFrozenRoles(name === 'chain' && needsFrozenRoles(brief.chain), () => reprove0(name, design, roles, brief, spare, k));
}
function reprove0(name, design, roles, brief, spare, k) {
  const proof = STORIES[name].prove(design, roles, { c: B.context(design.tiles), brief, spare, k });
  if (!proof || proof.ok !== true) return { ok: false, why: 'trapProof:' + (proof && proof.why) };
  const SGm = SG, GP = require('./loop/gate_profile.js'), sg = GP.applyStatic(SGm.staticGates(design, { story: name }), GP.loadProfile('traps-v1'), { storyProof: proof });
  if (!sg.pass) return { ok: false, why: 'staticGates' };
  if (!(sg.shipSpares || []).includes(spare)) return { ok: false, why: 'trapSpareNotShippable' };
  return { ok: true, proof, shipSpares: sg.shipSpares };
}
// re-pair pictures so that twins do not lie together (bank/separate.js), keeping the trap: every kept state replays strictly, keeps the clock minimum k,
// is readable, passes the story proof and the static gates. r = a T.build result. opts: { seed, wallMs, freeze (default: the bait tiles) }
function separateBoard(name, r, opts = {}) {
  const SEP = require('./bank/separate.js'), PS = require('../factory/placement_score.js'), k = r.card.clock.fewestMoves, spare = r.card.clock.spare;
  let last = null;
  const validate = d => {
    if (!E.replay(d, d.solution, { strict: true }).ok) return { ok: false, why: 'replay' };
    const cs = E.clockShortest(E.game(JSON.parse(JSON.stringify(d))), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity });
    if (!cs || cs.unsure || cs.k !== k) return { ok: false, why: 'k ' + (cs && cs.k) };
    let rd = false; try { rd = PS.readable(d); } catch (e) { /* unreadable */ }
    if (!rd) return { ok: false, why: 'unreadable' };
    const rp = reprove(name, d, r.roles, r.brief, spare, k); last = rp;
    return rp.ok ? { ok: true } : { ok: false, why: rp.why };
  };
  // stages: first the bait tiles (and every tile with their pictures) stay untouched; if twins remain, the bait pictures may move too (the story proof decides)
  const wall = opts.wallMs ?? 60000, t0 = Date.now(), stages = [{ freeze: r.roles.bait.tiles }, { freeze: [] }];
  const before = SEP.closeTwins(r.design); let cur = r.design, edits = [], notes = [], validations = 0, best = null, proposals = 0;
  for (let i = 0; i < stages.length && Date.now() - t0 < wall; i++) {
    const left = wall - (Date.now() - t0), out = SEP.separate(cur, { ...opts, seed: (opts.seed || 1) + i, wallMs: Math.max(3000, i === 0 ? left * 0.6 : left), freeze: stages[i].freeze, validate, k });
    notes.push('stage ' + i + (stages[i].freeze.length ? '' : ' (bait pictures free)') + ': ' + out.before.count + ' -> ' + out.after.count + ' close, ' + out.edits.length + ' swaps'); validations += out.validations; proposals += out.proposals; notes.push(...out.notes.map(x => '   ' + x));
    if (out.validated && out.edits.length) { cur = out.design; edits = edits.concat(out.edits); }
    best = SEP.closeTwins(cur); if (best.meets) break;
  }
  const rp = reprove(name, cur, r.roles, r.brief, spare, k);
  return { design: cur, before, after: best || before, edits, validated: rp.ok, notes, validations, proposals, remaining: (best || before).count, ms: Date.now() - t0, proof: rp.ok ? rp.proof : null, proofOk: rp.ok, proofWhy: rp.why || null };
}

// tail hardness (bank/tail.js): re-pair pictures AFTER the clock until the greedy player's win share lies in the band (default 0.15-0.40), every kept state
// replays strictly, keeps the clock minimum k, is readable, passes the story proof and the static gates; the bait pictures and the pre-clock part are not touched.
function tuneTail(name, r, design, opts = {}) {
  const Tl = require('./bank/tail.js'), PS = require('../factory/placement_score.js'), k = r.card.clock.fewestMoves, spare = r.card.clock.spare;
  const validate = d => {
    if (!E.replay(d, d.solution, { strict: true }).ok) return { ok: false, why: 'replay' };
    const cs = E.clockShortest(E.game(JSON.parse(JSON.stringify(d))), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity });
    if (!cs || cs.unsure || cs.k !== k) return { ok: false, why: 'k ' + (cs && cs.k) };
    let rd = false; try { rd = PS.readable(d); } catch (e) { /* unreadable */ }
    if (!rd) return { ok: false, why: 'unreadable' };
    const rp = reprove(name, d, r.roles, r.brief, spare, k); return rp.ok ? { ok: true } : { ok: false, why: rp.why };
  };
  return Tl.tune(design, { wallMs: 40000, freeze: r.roles.bait.tiles, ...opts, validate });
}

module.exports = { withFrozenRoles, CHAIN_RICH, CHAIN_EASY, tuneTail, readableLayouts, pressureOf, pressureFacts, winnableWithin, WHY, STORIES, NAMES, RETIRED, CHAIN, CHAIN_DEFS, CHAIN_SHAPES, CHAIN_UI_NOTE, build, reprove, separateBoard, shownFacts, capOf, vis0Of, thawNbs, digCost };
