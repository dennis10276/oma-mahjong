/* Builder v2, phase 1: what makes a board hard, without bots (helper B, 2026-11-06; SPEC.md section 3).
   describe(design, opts) -> plain numbers about one board: the frame (the alarm clock and the way to it), the order
   puzzle (what has to go before what), tray pressure along the way, hidden tiles, where the pressure sits, and the
   story/stage/shape. Everything is computed from the board alone: the game's own rules (layouts.js), the stored
   way through (design.solution), the exact fewest-moves clock way (lab/exact.js) and roomProfile (luck moments).

   const { describe } = require('./describe.js');
   describe(design, { shape, exactNodes: 150000, exactMs: 1500, room: true }) -> { frame, order, pressure, hidden,
     where, stage, traps: null, flat }      // flat: the same numbers as one level of keys (for tables)

   Words used below:
   - way (exact): the shortest way to the clock found by exactRoute, up to and including the clock (k moves).
     null when the search ran out of budget (never guessed).
   - witness: the stored solution; its prefix up to the clock is "the witness way".
   - in sight: a picture you can see and use right now = the tile is face-up (not in design.down) and takeable
     (free, not frozen, not locked). A free face-down tile can be peeked one at a time in the game, so it does not
     count as in sight.
   - peel round: take off every takeable tile at once, again and again (no tray). The round in which a tile goes is
     the length of the longest "must go first" chain in front of it: covers, row ends, ice (h neighbours) and locks
     (both keys). It ignores the tray, so it is a pure order-puzzle number.                                      */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js'));
if (!global.Layouts) global.Layouts = L;
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const { exactRoute, makeLowerBound } = require(path.join(ROOT, 'tools', 'lab', 'exact.js'));
let roomProfile = null;
const room = d => { if (!roomProfile) roomProfile = require(path.join(ROOT, 'tools', 'factory', 'design_traps.js')).roomProfile; return roomProfile(d); };

const SLOTS = L.SLOTS;                     // 4: a 4th waiting tile loses, so 3 may wait
const r3 = x => x == null || !Number.isFinite(x) ? x : Math.round(x * 1000) / 1000;
const tilesOf = d => d.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t);

/* The game object every helper here uses: the same shape as ideas.js gameG / hard.js (rules null without ice/locks). */
function gameOf(d) {
  const tiles = tilesOf(d), o = d.obst || {}, ice = o.ice || {}, keys = o.keys || [];
  const hasIce = Object.keys(ice).length > 0, hasLock = keys.length > 0 && (o.locks || []).length > 0;
  const rules = hasIce || hasLock ? { iceNb: L.iceNeighbors(tiles), ice: hasIce ? ice : {}, locks: hasLock ? new Set(o.locks) : null, keys: hasLock ? keys : [] } : null;
  const n = tiles.length, down = new Uint8Array(n); (d.down || []).forEach(i => down[i] = 1);
  return { tiles, nb: L.neighbors(tiles), faces: d.faces, rules, clock: d.clock && d.clock.i >= 0 ? d.clock : null, down, n };
}
const takeableIn = (g, init) => (i, alive) => alive[i] && (g.rules ? L.takeable(i, alive, g.nb, g.rules, init) : L.isFree(i, alive, g.nb));

function coverSet(nb, i) {           // every tile transitively above i
  const s = new Set(), st = [i];
  while (st.length) { const j = st.pop(); for (const a of nb.above[j]) if (!s.has(a)) { s.add(a); st.push(a); } }
  return s;
}

/* Peel rounds (see the header). withRules false: covers and row ends only. */
function peel(g, withRules = true) {
  const n = g.n, alive = new Uint8Array(n).fill(1), init = alive.slice(), round = new Int16Array(n).fill(-1);
  const can = withRules && g.rules ? (i => L.takeable(i, alive, g.nb, g.rules, init)) : (i => L.isFree(i, alive, g.nb));
  let left = n, r = 0;
  while (left > 0) {
    r++;
    const now = [];
    for (let i = 0; i < n; i++) if (alive[i] && can(i)) now.push(i);
    if (!now.length) break;                    // stuck (cannot happen on a valid board)
    for (const i of now) { alive[i] = 0; round[i] = r; left--; }
  }
  return { round, rounds: r, stuck: left };
}

/* Walk a sequence of moves from the start and record the tray and what is in sight before every move. */
function walk(g, seq) {
  const n = g.n, init = new Uint8Array(n).fill(1), alive = init.slice(), can = takeableIn(g, init), F = g.faces;
  const tray = [], steps = [];
  const revealed = new Set();      // face-down tiles that became free during the walk
  const freeNow = new Uint8Array(n);
  for (let i = 0; i < n; i++) freeNow[i] = L.isFree(i, alive, g.nb) ? 1 : 0;
  let pendingPeek = -1;            // the first tile of a peek pair (taken with its twin, no tray slot)
  for (let k = 0; k < seq.length; k++) {
    const m = seq[k];
    // before the move: what can be used right now (takeable tiles), per picture face-up (u) and face-down (d)
    const up = new Map(), dn = new Map(); let free = 0, hiddenFree = 0;
    for (let i = 0; i < n; i++) {
      if (!alive[i] || !can(i, alive)) continue;
      free++;
      if (g.down[i]) { hiddenFree++; dn.set(F[i], (dn.get(F[i]) || 0) + 1); }
      else up.set(F[i], (up.get(F[i]) || 0) + 1);
    }
    // (a) face-up pairs: both free and face-up (the first still goes to the tray)
    let pairs = 0; for (const c of up.values()) pairs += c >> 1;
    // (b) peek pairs: both free, at least one face-down: taken together WITHOUT a tray slot, even with 3 waiting
    //     (SPEC section 1, board.js peekPair). Disjoint pairs that each hold a face-down tile.
    let peekPairs = 0; for (const [f, d] of dn) peekPairs += Math.min(d, ((up.get(f) || 0) + d) >> 1);
    let matches = 0; for (const t of tray) if (up.get(F[t]) || dn.get(F[t])) matches++;
    const waitingBefore = tray.length;
    const q = tray.findIndex(t => F[t] === F[m]);
    // the way takes m and right after it m's twin, one of them face-down, both takeable now: a peek pair in the
    // game, so m never occupies a slot
    let peekMove = false;
    if (pendingPeek === m) { peekMove = true; pendingPeek = -1; }
    else if (q < 0 && k + 1 < seq.length) {
      const m2 = seq[k + 1];
      if (F[m2] === F[m] && (g.down[m] || g.down[m2]) && can(m2, alive)) { peekMove = true; pendingPeek = m2; }
    }
    if (!peekMove) { if (q >= 0) tray.splice(q, 1); else tray.push(m); }   // a peek pair never touches the tray
    alive[m] = 0;
    for (let i = 0; i < n; i++) if (alive[i] && !freeNow[i] && L.isFree(i, alive, g.nb)) { freeNow[i] = 1; if (g.down[i]) revealed.add(i); }
    steps.push({ m, waitingBefore, waiting: tray.length, pairs, peekPairs, matches, options: pairs + peekPairs + matches,
      relief: peekPairs + matches, free, hiddenFree, single: q < 0 && !peekMove, peek: peekMove, down: !!g.down[m] });
  }
  return { steps, revealed };
}
function trayStats(w) {
  const s = w.steps; if (!s.length) return null;
  const wait = s.map(x => x.waiting);
  const max = Math.max(...wait);
  return {
    moves: s.length,
    max, mean: r3(wait.reduce((a, b) => a + b, 0) / s.length),
    at3: wait.filter(x => x >= 3).length,                 // moves after which 3 tiles wait (one more single loses)
    at2plus: wait.filter(x => x >= 2).length,
    roomMin: 3 - max,
    pairsMean: r3(s.reduce((a, x) => a + x.pairs, 0) / s.length),
    pairsMin: Math.min(...s.map(x => x.pairs)),
    optionsMean: r3(s.reduce((a, x) => a + x.options, 0) / s.length),
    peekMean: r3(s.reduce((a, x) => a + x.peekPairs, 0) / s.length),
    peekSteps: s.filter(x => x.peekPairs > 0).length,     // steps with a peek pair available (relief without a slot)
    peekTaken: s.filter(x => x.peek).length,              // tiles the way itself takes as a peek pair
    dry: s.filter(x => x.options === 0).length,           // no face-up pair, no peek pair, no match: you must park a single
    dryShare: r3(s.filter(x => x.options === 0).length / s.length),
    // tight moments: 2+ waiting before the move; relief = a tray match or a peek pair available right then
    tight: s.filter(x => x.waitingBefore >= 2).length,
    tightNoRelief: s.filter(x => x.waitingBefore >= 2 && x.relief === 0).length,
    fullNoRelief: s.filter(x => x.waitingBefore >= 3 && x.relief === 0).length,
    singles: s.filter(x => x.single).length,
    downTaken: s.filter(x => x.down).length,              // face-down tiles taken on the way (peeked first)
    downRevealed: w.revealed.size,                        // face-down tiles uncovered by the way
  };
}

/* Where on the board a tile sits: across (centre/middle/edge), layer (top/mid/bottom), island. */
function components(g) {
  const n = g.n, comp = new Int32Array(n).fill(-1), sizes = [];
  const adj = (a, b) => { const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y), dz = Math.abs(a.z - b.z);
    return dz === 0 ? dx <= 2 && dy <= 2 && (dx < 2 || dy < 2) : dx < 2 && dy < 2; };
  let c = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const st = [s]; comp[s] = c; let size = 0;
    while (st.length) { const i = st.pop(); size++; for (let j = 0; j < n; j++) if (comp[j] < 0 && adj(g.tiles[i], g.tiles[j])) { comp[j] = c; st.push(j); } }
    sizes.push(size); c++;
  }
  return { comp, sizes };
}
function placeOf(g, i, geo) {
  if (i == null || i < 0) return null;
  const t = g.tiles[i];
  const u = geo.halfW > 0 ? Math.abs(t.x + 1 - geo.cx) / geo.halfW : 0;          // 0 centre .. 1 edge (across)
  const v = geo.halfH > 0 ? Math.abs(t.y + 1 - geo.cy) / geo.halfH : 0;
  const r = Math.max(u, v);
  return {
    across: r < 0.4 ? 'centre' : r > 0.75 ? 'edge' : 'middle',
    island: geo.sizes[geo.comp[i]] < Math.max(...geo.sizes),
    z: t.z, layer: t.z === geo.maxZ ? 'top' : t.z === 0 ? 'bottom' : 'mid',
    dist: r3(r),
  };
}

function describe(design, opts = {}) {
  const t0 = Date.now();
  const g = gameOf(design), n = g.n, F = g.faces, o = design.obst || {};
  const init = new Uint8Array(n).fill(1), can = takeableIn(g, init);
  const ice = o.ice || {}, iceTiles = Object.keys(ice).map(Number).filter(i => ice[i] > 0);
  const locks = g.rules && g.rules.locks ? [...g.rules.locks] : [], keys = g.rules ? g.rules.keys : [];
  const specialSet = new Set([...iceTiles, ...locks, ...keys, ...(g.clock ? [g.clock.i] : [])]);
  const sol = design.solution || [];
  const valid = !!design.solution && Hard.validSolution(g, sol);
  const ck = g.clock ? g.clock.i : null;
  const pr = peel(g, true), pr0 = peel(g, false);
  const cnt = {}; F.forEach(f => cnt[f] = (cnt[f] || 0) + 1);

  // ---------- frame ----------
  let frame = { hasClock: !!g.clock };
  let exact = null, exactMs = null;
  if (g.clock) {
    const cover = coverSet(g.nb, ck);
    const bound = makeLowerBound(g, ck)(init);
    const ts = Date.now();
    const nodes = opts.exactNodes ?? 150000, ms = opts.exactMs ?? 1500;
    exact = opts.exact === false ? null : exactRoute(g, ck, nodes, ms);
    exactMs = Date.now() - ts;
    const witK = sol.indexOf(ck) + 1;
    const k = exact ? exact.k : null;
    frame = {
      hasClock: true, clockN: g.clock.n,
      depth: cover.size,                          // tiles transitively above the clock
      bound,                                      // exact.js lower bound on the clock way (cheap, always there)
      k, kResolved: !!exact, exactMs,             // exact fewest moves to take the clock (null = budget ran out)
      witnessK: witK,                             // the stored solution takes the clock at this move
      spare: k != null ? g.clock.n - k : null,
      spareWitness: g.clock.n - witK,
      spareBound: g.clock.n - bound,              // an upper bound on the spare
      share: k != null ? r3(k / n) : null,        // way share: k / tiles
      shareWitness: r3(witK / n),
      locked: locks.includes(ck),
      frozen: ice[ck] || 0,
      clockPeel: pr.round[ck],                    // dependency depth of the clock (peel round, with ice/locks)
      clockPeelPlain: pr0.round[ck],              // ... with covers and row ends only
      clockPeelAdded: pr.round[ck] - pr0.round[ck],  // rounds the specials add in front of the clock
      clockCopies: cnt[F[ck]],
      // the clock's twins: how deep the nearest one sits (the clock waits in the tray until a twin comes free)
      twinPeel: Math.min(...F.map((f, j) => f === F[ck] && j !== ck ? pr.round[j] : Infinity)),
    };
    frame.twinAfterClock = frame.twinPeel - frame.clockPeel;
  }

  // ---------- order puzzle ----------
  const keyPeel = keys.length ? Math.max(...keys.map(i => pr.round[i])) : null;
  const wayExact = exact ? exact.path.slice(0, exact.k) : null;
  const wayWit = ck != null ? sol.slice(0, sol.indexOf(ck) + 1) : null;
  const countSpecials = way => way ? {
    all: way.filter(i => specialSet.has(i) && i !== ck).length,
    ice: way.filter(i => ice[i]).length, locks: way.filter(i => locks.includes(i)).length, keys: way.filter(i => keys.includes(i)).length,
  } : null;
  // specials whose own peel round is at most the clock's: they sit in front of (or level with) the clock
  const order = {
    peelRounds: pr.rounds, peelRoundsPlain: pr0.rounds, peelAdded: pr.rounds - pr0.rounds,
    peelMean: r3(pr.round.reduce((a, b) => a + b, 0) / n),
    keyPeel,                                      // the keys' depth (the later of the two)
    lockPeelMax: locks.length ? Math.max(...locks.map(i => pr.round[i])) : null,
    icePeelMax: iceTiles.length ? Math.max(...iceTiles.map(i => pr.round[i])) : null,
    chain: ck != null ? pr.round[ck] : pr.rounds,  // longest chain in front of the clock (or the board without one)
    specialsOnWay: countSpecials(wayExact),
    specialsOnWitnessWay: countSpecials(wayWit),
    nIce: iceTiles.length, nThick: iceTiles.filter(i => ice[i] >= 2).length, nLocks: locks.length, hasKeys: keys.length > 0,
    keysBeforeClock: ck != null && keys.length ? keys.every(i => wayExact ? wayExact.includes(i) : wayWit.includes(i)) : null,
  };

  // ---------- tray pressure along the way ----------
  const wWit = wayWit ? walk(g, wayWit) : null, wExact = wayExact ? walk(g, wayExact) : null;
  const wFull = valid ? walk(g, sol) : null;
  const pressure = {
    witnessWay: wWit ? trayStats(wWit) : null,
    exactWay: wExact ? trayStats(wExact) : null,
    full: wFull ? trayStats(wFull) : null,
  };

  // ---------- hidden tiles ----------
  const down = design.down || [];
  const keysCover = new Set(); for (const k of keys) { keysCover.add(k); for (const j of coverSet(g.nb, k)) keysCover.add(j); }
  const clockCover = ck != null ? new Set([ck, ...coverSet(g.nb, ck)]) : new Set();
  const hidden = {
    nDown: down.length, downShare: r3(down.length / n),
    downOverClock: down.filter(i => clockCover.has(i)).length,     // face-down tiles on top of the clock (or the clock)
    downOverKeys: down.filter(i => keysCover.has(i)).length,
    downOnWay: pressure.exactWay ? pressure.exactWay.downTaken : null,
    downRevealedOnWay: pressure.exactWay ? pressure.exactWay.downRevealed : null,
    downOnWitnessWay: pressure.witnessWay ? pressure.witnessWay.downTaken : null,
    downRevealedOnWitnessWay: pressure.witnessWay ? pressure.witnessWay.downRevealed : null,
    // twins: a face-down tile whose every twin is face-down too (you never see its picture in advance)
    blindPictures: Object.keys(cnt).filter(f => F.every((x, i) => x !== +f || g.down[i])).length,
    luck: null,
  };
  if (opts.room !== false && valid) {
    try {
      const rp = room(design);
      hidden.luck = rp.ok ? { blindTakes: rp.blindTakes, tightBlind: rp.tightBlind, unrelieved: rp.unrelieved, room: rp.room, blindMax: rp.blindMax } : { ok: false };
    } catch (e) { hidden.luck = { error: String(e.message || e) }; }
  }

  // ---------- where the pressure is (on the whole stored solution) ----------
  let where = null;
  if (wFull) {
    const s = wFull.steps, wait = s.map(x => x.waiting), max = Math.max(...wait);
    const firstMax = wait.indexOf(max), first3 = wait.indexOf(3);
    const ckAt = ck != null ? sol.indexOf(ck) : -1;
    const seg = (a, b) => { const w = wait.slice(a, b); return w.length ? { max: Math.max(...w), mean: r3(w.reduce((p, q) => p + q, 0) / w.length) } : null; };
    // the calmest long stretch: most moves in a row with at most 1 waiting
    let run = 0, best = 0; for (const x of wait) { run = x <= 1 ? run + 1 : 0; best = Math.max(best, run); }
    const half = Math.floor(s.length * 0.6);
    const early = seg(0, half), late = seg(half, s.length);
    where = {
      peakAt: r3(firstMax / s.length),                      // share of the solution at which the tray first reaches its max
      first3At: first3 >= 0 ? r3(first3 / s.length) : null,
      clockAt: ckAt >= 0 ? r3((ckAt + 1) / s.length) : null,
      afterClock: ckAt >= 0 ? seg(ckAt + 1, s.length) : null,   // the rest of the level once the clock is taken
      calmRun: best, calmRunShare: r3(best / s.length),
      calmShare: r3(wait.filter(x => x <= 1).length / s.length),
      at3Share: r3(wait.filter(x => x >= 3).length / s.length),
      // Dennis: no free cruising followed by the main puzzle with high tray pressure at the very end
      cruiseThenCrunch: early.max <= 1 && late.max >= 3,
      lateHeavy: r3(late.mean - early.mean),
    };
  }

  // ---------- story / stage / shape ----------
  const xs = g.tiles.map(t => t.x), ys = g.tiles.map(t => t.y), zs = g.tiles.map(t => t.z);
  const { comp, sizes } = components(g);
  const geo = { cx: (Math.min(...xs) + Math.max(...xs) + 2) / 2, cy: (Math.min(...ys) + Math.max(...ys) + 2) / 2,
    halfW: (Math.max(...xs) - Math.min(...xs)) / 2, halfH: (Math.max(...ys) - Math.min(...ys)) / 2, maxZ: Math.max(...zs), comp, sizes };
  const freeStart = []; for (let i = 0; i < n; i++) if (L.isFree(i, init, g.nb)) freeStart.push(i);
  const sightStart = freeStart.filter(i => !g.down[i] && can(i, init));
  const startCnt = {}; sightStart.forEach(i => startCnt[F[i]] = (startCnt[F[i]] || 0) + 1);
  const stage = {
    shape: opts.shape || null, tiles: n, layers: geo.maxZ + 1, islands: sizes.length,
    pictures: Object.keys(cnt).length, rarePictures: Object.values(cnt).filter(c => c === 2).length,
    rareShare: r3(Object.values(cnt).filter(c => c === 2).length / Object.keys(cnt).length),
    clock: ck != null ? placeOf(g, ck, geo) : null,
    keys: keys.length ? keys.map(i => placeOf(g, i, geo)) : null,
    freeStart: freeStart.length, pairsAtStart: Object.values(startCnt).reduce((a, c) => a + (c >> 1), 0),
    specialsVisible: [...specialSet].filter(i => freeStart.includes(i)).length,   // specials free (visible) at the start
    specials: specialSet.size,
    clockVisible: ck != null ? freeStart.includes(ck) : null,
  };

  const out = { valid, frame, order, pressure, hidden, where, stage,
    traps: null,       // TODO(engine.js, helper A): decision traps along the clock way: count, tempting losing moves, depth
    ms: Date.now() - t0 };
  out.flat = flatten(out);
  return out;
}

/* One level of keys, numbers and booleans only (booleans as 0/1), for tables and the analysis. */
function flatten(d) {
  const out = {};
  const put = (k, v) => { if (typeof v === 'boolean') out[k] = v ? 1 : 0; else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v; else if (v === null || v === undefined) out[k] = null; };
  const f = d.frame;
  for (const k of ['hasClock', 'clockN', 'depth', 'bound', 'k', 'witnessK', 'spare', 'spareWitness', 'spareBound', 'share', 'shareWitness', 'locked', 'frozen', 'clockPeel', 'clockPeelPlain', 'clockPeelAdded', 'clockCopies', 'twinPeel', 'twinAfterClock']) put('frame.' + k, f[k]);
  const o = d.order;
  for (const k of ['peelRounds', 'peelRoundsPlain', 'peelAdded', 'peelMean', 'keyPeel', 'lockPeelMax', 'icePeelMax', 'chain', 'nIce', 'nThick', 'nLocks', 'hasKeys', 'keysBeforeClock']) put('order.' + k, o[k]);
  for (const [w, s] of [['way', o.specialsOnWay], ['wit', o.specialsOnWitnessWay]]) for (const k of ['all', 'ice', 'locks', 'keys']) put(`order.specials.${w}.${k}`, s ? s[k] : null);
  for (const w of ['witnessWay', 'exactWay', 'full']) {
    const s = d.pressure[w];
    for (const k of ['moves', 'max', 'mean', 'at3', 'at2plus', 'roomMin', 'pairsMean', 'pairsMin', 'optionsMean', 'peekMean', 'peekSteps', 'peekTaken', 'dry', 'dryShare', 'tight', 'tightNoRelief', 'fullNoRelief', 'singles', 'downTaken', 'downRevealed']) put(`tray.${w}.${k}`, s ? s[k] : null);
  }
  const h = d.hidden;
  for (const k of ['nDown', 'downShare', 'downOverClock', 'downOverKeys', 'downOnWay', 'downRevealedOnWay', 'downOnWitnessWay', 'downRevealedOnWitnessWay', 'blindPictures']) put('hidden.' + k, h[k]);
  const lk = h.luck && h.luck.ok !== false && !h.luck.error ? h.luck : null;
  for (const k of ['blindTakes', 'tightBlind', 'unrelieved', 'room', 'blindMax']) put('luck.' + k, lk ? lk[k] : null);
  const w = d.where;
  for (const k of ['peakAt', 'first3At', 'clockAt', 'calmRun', 'calmRunShare', 'calmShare', 'at3Share', 'cruiseThenCrunch', 'lateHeavy']) put('where.' + k, w ? w[k] : null);
  put('where.afterClock.max', w && w.afterClock ? w.afterClock.max : null);
  put('where.afterClock.mean', w && w.afterClock ? w.afterClock.mean : null);
  const s = d.stage;
  for (const k of ['tiles', 'layers', 'islands', 'pictures', 'rarePictures', 'rareShare', 'freeStart', 'pairsAtStart', 'specialsVisible', 'specials', 'clockVisible']) put('stage.' + k, s[k]);
  put('stage.clock.dist', s.clock ? s.clock.dist : null);
  put('stage.clock.z', s.clock ? s.clock.z : null);
  put('stage.clock.top', s.clock ? s.clock.layer === 'top' : null);
  put('stage.clock.bottom', s.clock ? s.clock.layer === 'bottom' : null);
  put('stage.clock.edge', s.clock ? s.clock.across === 'edge' : null);
  put('stage.clock.centre', s.clock ? s.clock.across === 'centre' : null);
  put('stage.clock.island', s.clock ? s.clock.island : null);
  put('stage.keys.dist', s.keys ? Math.max(...s.keys.map(k => k.dist)) : null);
  put('stage.keys.bottom', s.keys ? s.keys.some(k => k.layer === 'bottom') : null);
  return out;
}

module.exports = { describe, flatten, gameOf, peel, walk, trayStats, coverSet };
