/* Builder v2 (Claude, 2026-11-06): a level built backwards from a brief, not a random deal with traps bolted on.
   Dennis: "Focus on making the builder better before letting it learn." Spec: SPEC.md section 4.

   1. Roles: the story (stories.js) picks the clock, keys, locks and ice on the chosen shape (geometry only).
   2. The dig: the tiles the clock needs, worked back from the clock (its cover, the keys of any lock met, the
      cheapest neighbours of any ice, a side when a tile is boxed in), in a legal order: the dig P.
      Holders: tiles that stay covered during the whole dig. Only they may hold the twin of a tile that is still
      waiting when the clock goes, so nothing on the dig can be relieved early. A story with covered partners
      locks them (the keys come after the clock), freezes them, or picks the deepest ones.
      The rest of the board Q follows in a legal order that reaches the holders first.
   3. Pictures along that way: during the dig every new picture waits until the tray holds `cap` = 3 - trayRoom;
      then the next dig tile closes one. At most 2 wait when the clock goes (the board must stay playable while the
      holders are dug out). After the clock the waiting twins come free first (relief), then calm pairs; pictures
      used four times only on calm pairs late in the way. The way is a real solution by construction.
   4. Face-down tiles (some on the dig: the skilled player's luck moments), then the clock from the engine:
      n = real fewest moves (peek pairs included) + spare.
   5. Proofs (engine.js): winnable witness, honest clock, every special changes the fewest way to the clock or
      holds the partners back (idle ones are taken off, the story's own specials must survive), the tray
      pressure on the way, decision traps on the way (counted).
     const { build } = require('./builder.js'); build(brief, opts) -> { design, card, intents, ms } | { fail, detail }

   What the descriptors say (analysis/builder/descriptors-report.md): the family loses on the clock way to moves
   with 3 tiles waiting; the skilled player loses to face-down tiles uncovered with 2+ waiting (luck moments).
   So trayRoom (cap) is the family's knob and hiddenOnWay the skilled player's.                                 */
'use strict';
const path = require('path'), fs = require('fs');
const L = global.Layouts || (global.Layouts = require('../../www/layouts.js'));
const { exactRoute } = require('../lab/exact.js');
const E = require('./engine.js');
const { STORIES } = require('./stories.js');

const LAYOUTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'layouts.json'), 'utf8'));
const rngOf = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296; };
const shuffle = (rng, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the shape and what blocks what ----------
function context(tilesIn) {
  const tiles = tilesIn.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t), n = tiles.length;
  const nb = L.neighbors(tiles), inb = L.iceNeighbors(tiles);
  const above = tiles.map((_, i) => { const s = new Set(), todo = [i]; while (todo.length) for (const j of nb.above[todo.pop()]) if (!s.has(j)) { s.add(j); todo.push(j); } return s; });
  const all = new Uint8Array(n).fill(1), free0 = tiles.map((_, i) => L.isFree(i, all, nb));
  const maxZ = Math.max(...tiles.map(t => t.z));
  // peaks ("islands"): our layouts never split at the base, but many rise in two or more separate towers. The first
  // layer from which the tiles at or above it fall into 2+ groups of 4+ tiles gives the peaks; below that: -1.
  let peak = new Array(n).fill(-1), peaks = 0;
  for (let zc = 1; zc <= maxZ && !peaks; zc++) {
    const comp = new Array(n).fill(-1), idx = tiles.map((_, i) => i).filter(i => tiles[i].z >= zc); let nc = 0;
    for (const i of idx) if (comp[i] < 0) { comp[i] = nc; const st = [i]; while (st.length) { const a = tiles[st.pop()];
      for (const j of idx) if (comp[j] < 0 && Math.abs(tiles[j].x - a.x) <= 2 && Math.abs(tiles[j].y - a.y) <= 2) { comp[j] = nc; st.push(j); } } nc++; }
    const size = {}; for (const i of idx) size[comp[i]] = (size[comp[i]] || 0) + 1;
    const big = Object.keys(size).filter(k => size[k] >= 4).map(Number);
    if (big.length >= 2) { peaks = big.length; for (const i of idx) peak[i] = big.indexOf(comp[i]); }
  }
  const cx = tiles.reduce((s, t) => s + t.x, 0) / n, cy = tiles.reduce((s, t) => s + t.y, 0) / n;
  const dist = (i, j) => Math.hypot(tiles[i].x - tiles[j].x, (tiles[i].y - tiles[j].y) * 0.8);
  const centre = i => Math.hypot(tiles[i].x - cx, (tiles[i].y - cy) * 0.8);
  return { tiles, n, nb, inb, above, free0, peak, peaks, dist, centre, maxZ };
}

// ---------- 1. roles ----------
function placeRoles(c, story, brief, rng) {
  const s = story.spec, depth = brief.frame?.depth != null ? [brief.frame.depth, brief.frame.depth] : (s.clockDepth || [0, 2]);
  const inRange = (v, [a, b]) => v >= a && v <= b;
  if (story.needs === 'islands' && c.peaks < 2) return { fail: 'needsIslands' };
  let clocks = [];
  for (let i = 0; i < c.n; i++) if (inRange(c.above[i].size, depth)) clocks.push(i);
  // ice on the clock only counts when its cover (which goes anyway) is not enough to thaw it
  const coverInb = i => c.inb[i].filter(j => c.above[i].has(j)).length;
  if (s.clockIce) clocks = clocks.filter(i => coverInb(i) < s.clockIce && c.inb[i].length >= s.clockIce + 1);
  if (story.needs === 'islands') clocks = clocks.filter(i => c.peak[i] >= 0);
  if (brief.stage === 'centre') clocks.sort((a, b) => c.centre(a) - c.centre(b));
  else if (brief.stage === 'edge') clocks.sort((a, b) => c.centre(b) - c.centre(a));
  else if (brief.stage === 'top') clocks = shuffle(rng, clocks).sort((a, b) => c.tiles[b].z - c.tiles[a].z);
  else clocks = shuffle(rng, clocks);
  // a little variety between attempts even with a fixed stage
  if (brief.stage) clocks = clocks.slice(0, 6).sort(() => rng() - 0.5).concat(clocks.slice(6));
  for (const ck of clocks.slice(0, 12)) {
    const roles = { clock: ck, locks: new Set(), keys: [], ice: {}, holderSpecials: new Set() };
    if (s.clockIce) roles.ice[ck] = s.clockIce;
    if (s.clockLock) roles.locks.add(ck);
    if (s.coverLock) { const cov = [...c.above[ck]].sort((a, b) => c.tiles[b].z - c.tiles[a].z); if (cov.length < s.coverLock) continue; cov.slice(0, s.coverLock).forEach(i => roles.locks.add(i)); }
    if (s.lockIceNeighbours && s.clockIce) {
      // lock neighbours until fewer than h unlocked ones remain: the thaw needs the keys
      // lock the other neighbours until fewer than h - (its cover) stay unlocked: the thaw needs the keys
      const nbs = shuffle(rng, c.inb[ck].filter(j => !c.above[ck].has(j)));
      const free = Math.max(0, s.clockIce - 1 - coverInb(ck));
      for (const j of nbs.slice(0, nbs.length - free)) roles.locks.add(j);
    }
    const needKeys = roles.locks.size > 0 || s.coverPartners === 'locked';
    if (needKeys) {
      const kc = s.keyCover || [1, 3], used = new Set([ck, ...roles.locks, ...c.above[ck]]);
      let cands = [];
      for (let i = 0; i < c.n; i++) if (!used.has(i) && inRange(c.above[i].size, kc) && ![...roles.locks].some(l => c.above[l].has(i))
        && (!s.keyIce || (coverInb(i) < s.keyIce && c.inb[i].filter(j => !roles.locks.has(j) && !c.above[j].has(i)).length >= s.keyIce + 1))) cands.push(i);
      if (s.keys === 'island') cands = cands.filter(i => c.peak[i] >= 0 && c.peak[i] !== c.peak[ck]);
      if (s.keys === 'far' || s.keys === 'island') cands.sort((a, b) => c.dist(b, ck) - c.dist(a, ck));
      else if (s.keys === 'deep') cands.sort((a, b) => c.above[b].size - c.above[a].size || c.dist(b, ck) - c.dist(a, ck));
      else cands.sort((a, b) => c.dist(a, ck) - c.dist(b, ck));
      cands = shuffle(rng, cands.slice(0, 6)).concat(cands.slice(6, 16));
      let pair = null;
      for (const a of cands) { for (const b of cands) if (b !== a && c.dist(a, b) <= 6 && !c.above[a].has(b) && !c.above[b].has(a)) { pair = [a, b]; break; } if (pair) break; }
      if (!pair) continue;
      roles.keys = pair;
      if (s.keyIce) for (const k of pair) roles.ice[k] = s.keyIce;
    }
    return roles;
  }
  return { fail: 'noClockPlace' };
}

// ---------- 2. the dig, holders and the rest ----------
const rulesOf = (c, roles) => ({ iceNb: c.inb, ice: roles.ice, locks: roles.locks.size ? roles.locks : null, keys: roles.keys });
// the tiles the clock still needs, worked back as a person does
function needSet(c, roles, alive) {
  const need = new Set([roles.clock]), todo = [roles.clock];
  const add = u => { if (alive[u] && !need.has(u)) { need.add(u); todo.push(u); } };
  while (todo.length) {
    const u = todo.pop();
    for (const a of c.above[u]) add(a);
    if (roles.locks.has(u)) for (const k of roles.keys) add(k);
    const h = roles.ice[u] || 0;
    if (h) {
      const gone = c.inb[u].filter(j => !alive[j]).length, planned = c.inb[u].filter(j => alive[j] && need.has(j)).length;
      let left = h - gone - planned;
      if (left > 0) {
        const cost = j => 1 + [...c.above[j]].filter(a => alive[a]).length + (roles.locks.has(j) && roles.keys.some(k => alive[k]) ? 50 : 0) + (roles.ice[j] ? 10 : 0);
        for (const j of c.inb[u].filter(j => alive[j] && !need.has(j) && !c.above[j].has(u)).sort((a, b) => cost(a) - cost(b))) { if (left-- <= 0) break; add(j); }
      }
    }
  }
  return need;
}
function planDig(c, roles, rng) {
  const alive = new Uint8Array(c.n).fill(1), all = alive.slice(), rules = rulesOf(c, roles), P = [];
  const can = i => L.takeable(i, alive, c.nb, rules, all);
  for (let guard = 0; guard < c.n; guard++) {
    if (!alive[roles.clock]) return P;
    const need = needSet(c, roles, alive);
    let ready = [...need].filter(can);
    if (!ready.length) {
      // boxed in sideways: open the cheaper side of a needed tile that has nothing above it
      let side = null;
      for (const i of [...need].filter(i => [...c.above[i]].every(a => !alive[a]))) for (const dir of ['left', 'right']) {
        const chain = []; let cur = [i], ok = true;
        while (cur.length) { const nxt = []; for (const t of cur) for (const j of c.nb[dir][t]) if (alive[j]) { chain.push(j); nxt.push(j); } cur = nxt; if (chain.length > 8) { ok = false; break; } }
        const end = chain.filter(j => can(j));
        if (ok && end.length && (!side || chain.length < side.cost)) side = { cost: chain.length, tile: end[0] };
      }
      if (!side) return null;
      ready = [side.tile];
    }
    // the keys before anything else, the clock last, a little randomness among the rest
    const score = i => (roles.keys.includes(i) ? 100 : 0) + (i === roles.clock ? -100 : 0) + c.tiles[i].z + rng() * 0.5;
    ready.sort((a, b) => score(b) - score(a));
    const i = ready[0]; alive[i] = 0; P.push(i);
  }
  return null;
}
// tiles that stay covered (not free) during the whole dig
function coveredDuringDig(c, P) {
  const alive = new Uint8Array(c.n).fill(1), cov = new Uint8Array(c.n).fill(1);
  for (let k = 0; k <= P.length; k++) {
    for (let i = 0; i < c.n; i++) if (alive[i] && cov[i] && L.isFree(i, alive, c.nb)) cov[i] = 0;
    if (k < P.length) alive[P[k]] = 0;
  }
  return cov;
}
function chooseHolders(c, roles, P, spec, rng) {
  const inP = new Set(P), cov = coveredDuringDig(c, P);
  const pool = [...Array(c.n).keys()].filter(i => cov[i] && !inP.has(i) && i !== roles.clock && !roles.keys.includes(i) && !roles.locks.has(i) && !roles.ice[i]);
  if (!spec.coverPartners) return { cov, holders: null };
  let cands;
  if (spec.coverPartners === 'buried') cands = shuffle(rng, pool).sort((a, b) => c.above[b].size - c.above[a].size);
  else if (spec.coverPartners === 'locked') cands = shuffle(rng, pool.filter(h => !roles.keys.some(k => c.above[k].has(h)))).sort((a, b) => c.dist(a, roles.clock) - c.dist(b, roles.clock));
  else cands = shuffle(rng, pool.filter(h => c.inb[h].length >= 3 && c.inb[h].filter(j => inP.has(j)).length <= 1)).sort((a, b) => c.dist(a, roles.clock) - c.dist(b, roles.clock));
  const holders = cands.slice(0, spec.coverPartners === 'buried' ? 4 : 3);
  if (holders.length < 2) return { fail: 'fewHolders' };
  for (const h of holders) {
    if (spec.coverPartners === 'locked') { roles.locks.add(h); roles.holderSpecials.add('lock ' + h); }
    if (spec.coverPartners === 'frozen') { roles.ice[h] = 2; roles.holderSpecials.add('ice ' + h); }
  }
  return { cov, holders: new Set(holders) };
}
function planRest(c, roles, P, wanted, rng) {
  const alive = new Uint8Array(c.n).fill(1), all = alive.slice(), rules = rulesOf(c, roles), Q = [];
  for (const i of P) alive[i] = 0;
  const can = i => L.takeable(i, alive, c.nb, rules, all);
  for (let left = c.n - P.length; left > 0; left--) {
    const ready = []; for (let i = 0; i < c.n; i++) if (alive[i] && can(i)) ready.push(i);
    if (!ready.length) return null;
    // the wanted tiles (holders, keys of locked holders) first, then what uncovers them, then the rest
    const score = i => (wanted.has(i) ? 3 : 0) + ([...wanted].some(w => alive[w] && c.above[w].has(i)) ? 2 : 0) + rng();
    ready.sort((a, b) => score(b) - score(a));
    const i = ready[0]; alive[i] = 0; Q.push(i);
  }
  return Q;
}

// ---------- 3. pictures ----------
function placePictures(c, roles, P, hold, brief, rng) {
  const cap = Math.max(1, Math.min(3, 3 - (brief.targets?.trayRoom ?? 1)));
  const inP = new Set(P), { cov, holders } = hold;
  const mayHold = t => holders ? holders.has(t) : !!cov[t] && !inP.has(t);
  const wanted = new Set(holders ? [...holders] : [...Array(c.n).keys()].filter(mayHold));
  // at most 2 wait when the clock goes, unless a holder can be taken right after it (it closes one at once)
  const afterDig = new Uint8Array(c.n).fill(1); for (const i of P) afterDig[i] = 0;
  const holderNext = [...wanted].some(h => L.takeable(h, afterDig, c.nb, rulesOf(c, roles), new Uint8Array(c.n).fill(1)));
  const endCap = holderNext ? cap : Math.min(cap, 2);
  if (holders && [...holders].some(h => roles.locks.has(h))) for (const k of roles.keys) if (!inP.has(k)) wanted.add(k);
  const Q = planRest(c, roles, P, wanted, rng); if (!Q) return { fail: 'restOrder' };
  const W = P.concat(Q), pos = new Array(c.n); W.forEach((t, k) => pos[t] = k);
  // freeAt[t]: the dig step after which t is free (Infinity: not during the dig). A dig tile may only close a waiting
  // one that was taken before it came free, else a player takes the two together and the tray never fills.
  const freeAt = new Array(c.n).fill(Infinity); { const al = new Uint8Array(c.n).fill(1);
    for (let k = 0; k <= P.length; k++) { for (let i = 0; i < c.n; i++) if (al[i] && freeAt[i] === Infinity && L.isFree(i, al, c.nb)) freeAt[i] = k; if (k < P.length) al[P[k]] = 0; } }
  const [k1, k2] = roles.keys.length ? roles.keys.slice().sort((a, b) => pos[a] - pos[b]) : [-1, -1];
  const pairOf = new Array(c.n).fill(-1), open = [];
  const closeWith = (t, o) => { pairOf[t] = o; pairOf[o] = t; open.splice(open.indexOf(o), 1); };
  let maxWait = 0, atCap = 0;
  for (let k = 0; k < W.length; k++) {
    const t = W[k], inDig = k < P.length, left = W.length - k;
    if (t === k2 && pairOf[k1] < 0) { closeWith(t, k1); continue; }         // the keys are one pair
    if (t === k1) { if (open.length >= 3) return { fail: 'trayOverflow' }; open.push(t); maxWait = Math.max(maxWait, open.length); continue; }
    const fromDig = o => pos[o] < P.length;
    // in the dig a tile closes only one lying on top of it: then no order of the dig takes the two together
    let closable = open.filter(o => o !== k1 && (inDig ? c.above[t].has(o) : (!fromDig(o) || mayHold(t))));
    // no such tile but the tray is at its cap: close one anyway (that pair can be taken together: less pressure)
    if (inDig && !closable.length && open.length >= cap) closable = open.filter(o => o !== k1);
    const mustClose = open.length >= 3 || open.length >= left - (pairOf[k1] < 0 && k1 >= 0 && pos[k1] <= k ? 1 : 0);
    let close;
    if (inDig) close = open.length >= cap || (k === P.length - 1 && open.length >= endCap) || mustClose;
    else close = closable.some(fromDig) || mustClose || open.length >= 2 || (open.length >= 1 && rng() < 0.55);
    if (close && closable.length) {
      const pickFrom = inDig ? closable : closable.filter(fromDig).concat(closable.filter(o => !fromDig(o)));
      closeWith(t, pickFrom[0]);
    } else {
      if (open.length >= 3) return { fail: 'trayOverflow' };
      open.push(t);
    }
    if (inDig) { maxWait = Math.max(maxWait, open.length); if (open.length >= cap) atCap++; }
  }
  if (open.length) return { fail: 'unpaired' };
  // pairs -> pictures: 36 pictures; a picture four times only on calm pairs late in the way
  const pairs = [], seen = new Set();
  for (const t of W) if (!seen.has(t)) { seen.add(t); seen.add(pairOf[t]); pairs.push([t, pairOf[t]]); }
  const doubles = Math.max(0, pairs.length - 36);
  const late = pairs.map((p, k) => k).filter(k => Math.min(pos[pairs[k][0]], pos[pairs[k][1]]) > P.length + 6);
  if (late.length < doubles * 2) return { fail: 'tooFewLatePairs' };
  const lateSet = new Set(shuffle(rng, late).slice(0, doubles * 2)), order = shuffle(rng, [...Array(36).keys()]);
  const faces = new Array(c.n).fill(-1); let f = 0;
  pairs.forEach((p, k) => { if (!lateSet.has(k)) { faces[p[0]] = faces[p[1]] = order[f++]; } });
  const lateList = [...lateSet];
  for (let k = 0; k < lateList.length; k += 2) { const face = order[f++]; for (const q of [lateList[k], lateList[k + 1]]) faces[pairs[q][0]] = faces[pairs[q][1]] = face; }
  return { W, Q, faces, pairOf, pos, cap, maxWait, atCap };
}

// ---------- 4. face-down tiles ----------
function placeDown(c, roles, P, brief, rng) {
  const target = Math.round((brief.targets?.maxDown ?? 0.3) * c.n), onWay = brief.targets?.hiddenOnWay ?? 1;
  const special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const inP = new Set(P);
  // on the dig: the deeper tiles first (they come free while tiles wait: the luck moments)
  const dig = shuffle(rng, P.filter(i => !c.free0[i] && !special.has(i))).sort((a, b) => P.indexOf(b) - P.indexOf(a)).slice(0, onWay);
  const rest = shuffle(rng, [...Array(c.n).keys()].filter(i => !c.free0[i] && !special.has(i) && !inP.has(i)));
  return dig.concat(rest.slice(0, Math.max(0, target - dig.length)));
}

// ---------- 5. proofs ----------
const designOf = (c, faces, down, roles, clock, solution = []) => ({
  tiles: c.tiles.map(t => [t.x, t.y, t.z]), faces, down, gold: [],
  obst: { ice: Object.fromEntries(Object.entries(roles.ice).map(([k, v]) => [+k, v])), locks: [...roles.locks], keys: roles.locks.size ? roles.keys.slice() : [] },
  clock, solution });
function fewest(c, faces, down, roles, budget) {
  const d = designOf(c, faces, down, roles, { i: roles.clock, n: 999 });
  const r = E.clockShortest(E.game(d), budget);
  return r && !r.unsure ? r : null;
}
// every lock and ice tile must change the fewest way to the clock (or be a holder special, checked apart);
// idle ones are taken off one at a time (redundancy shifts after each removal)
function prune(c, faces, down, roles, k0, budget, deadline = Infinity) {
  const removed = [];
  for (let round = 0; round < 12; round++) {
    if (Date.now() > deadline) return null;
    let idle = null;
    const specials = [...roles.locks].map(l => 'lock ' + l).concat(Object.keys(roles.ice).map(i => 'ice ' + i)).filter(s => !roles.holderSpecials.has(s));
    for (const s of shuffle(rngOf(round + 7), specials)) {
      const r = { ...roles, locks: new Set(roles.locks), ice: { ...roles.ice } };
      const [kind, i] = s.split(' '); if (kind === 'lock') r.locks.delete(+i); else delete r.ice[+i];
      const w = fewest(c, faces, down, r, budget);
      if (w && w.k >= k0) { idle = { s, r }; break; }
    }
    if (!idle) break;
    removed.push(idle.s); roles.locks = idle.r.locks; roles.ice = idle.r.ice;
  }
  return removed;
}
function storyKept(spec, roles, c) {
  const missing = [];
  if (spec.clockLock && !roles.locks.has(roles.clock)) missing.push('clock lock');
  if (spec.clockIce && !roles.ice[roles.clock]) missing.push('clock ice');
  if ((spec.lockIceNeighbours || spec.coverLock) && ![...roles.locks].some(l => l !== roles.clock)) missing.push('locks on the way');
  if (spec.keyIce && !roles.keys.some(k => roles.ice[k])) missing.push('frozen keys');
  if (spec.coverPartners === 'locked' && ![...roles.locks].length) missing.push('locked partners');
  return missing;
}
// the tray along a flat path up to the clock (peek pairs need no slot)
function trayOnWay(d, flat) {
  const g = E.game(d), F = d.faces, tray = [], ck = d.clock.i; let max = 0, three = 0, luck = 0;
  const alive = new Uint8Array(F.length).fill(1);
  const uncovers = i => { const a2 = alive.slice(); a2[i] = 0; return d.down.some(j => a2[j] && !L.isFree(j, alive, g.nb) && L.isFree(j, a2, g.nb)); };
  for (let p = 0; p < flat.length; p++) {
    const i = flat[p], q = tray.indexOf(F[i]);
    if (q < 0 && tray.length >= 3) { alive[i] = 0; alive[flat[p + 1]] = 0; p++; if (flat[p] === ck || i === ck) break; continue; }
    if (q < 0 && tray.length >= 2 && uncovers(i)) luck++;
    alive[i] = 0; if (q >= 0) tray.splice(q, 1); else tray.push(F[i]);
    max = Math.max(max, tray.length); if (tray.length >= 3) three++;
    if (i === ck) break;
  }
  return { max, three, luck };
}

/* Forced tray pressure: can the clock be taken within its n moves while never more than `limit` tiles wait (peek
   pairs need no slot; the rest of the board is ignored, so a 'no' is a proof that every way to the clock in time
   fills the tray beyond `limit`)? -> 'no' | 'yes' | 'unknown' */
function canReachWithin(d, limit, nodes = 200000) {
  const g = E.game(d), n = d.faces.length, F = d.faces, ck = d.clock.i, init = new Uint8Array(n).fill(1);
  const rules = g.rules, can = (i, al) => al[i] && (rules ? L.takeable(i, al, g.nb, rules, init) : L.isFree(i, al, g.nb));
  const lb = g.lb, seen = new Set(); let count = 0;
  const rec = (al, tray, m) => {
    if (++count > nodes) throw BUDGETX;
    if (m + lb(al) > d.clock.n) return false;
    const key = al.join('') + '|' + tray.slice().sort((a, b) => a - b).join(',');
    if (seen.has(key)) return false; seen.add(key);
    const free = []; for (let i = 0; i < n; i++) if (can(i, al)) free.push(i);
    for (const i of free) {
      const q = tray.indexOf(F[i]);
      if (q < 0 && tray.length >= limit) continue;
      if (i === ck) return m + 1 <= d.clock.n;
      const a2 = al.slice(); a2[i] = 0;
      if (rec(a2, q >= 0 ? tray.filter((_, k) => k !== q) : tray.concat(F[i]), m + 1)) return true;
    }
    for (const i of free) for (const j of free) if (i < j && F[i] === F[j] && (g.down[i] || g.down[j]) && !tray.includes(F[i])) {
      if (i === ck || j === ck) return m + 2 <= d.clock.n;
      const a2 = al.slice(); a2[i] = 0; a2[j] = 0;
      if (rec(a2, tray, m + 2)) return true;
    }
    return false;
  };
  try { return rec(init.slice(), [], 0) ? 'yes' : 'no'; } catch (e) { if (e === BUDGETX) return 'unknown'; throw e; }
}
const BUDGETX = { budget: true };

function build(briefIn, opts = {}) {
  const t0 = Date.now(), brief = { targets: {}, ...briefIn };
  const story = STORIES[brief.story]; if (!story) return { fail: 'unknownStory', detail: brief.story, ms: 0 };
  let tiles = brief.tiles, shape = brief.shape || null;
  if (!tiles) {
    const lays = LAYOUTS.filter(l => l.shape === brief.shape || l.base === brief.shape);
    const lay = brief.layout != null ? LAYOUTS[brief.layout] : lays[(brief.seed ?? 0) % Math.max(1, lays.length)];
    if (!lay) return { fail: 'unknownShape', detail: brief.shape, ms: 0 };
    tiles = lay.tiles; shape = lay.shape;
  }
  const c = context(tiles);
  if (c.n % 2) return { fail: 'oddTiles', ms: 0 };
  const budget = opts.budget || { nodes: 300000, ms: 3000 }, spare = brief.frame?.spare ?? 1, fails = {};
  let last = null;
  for (let attempt = 0; attempt < (opts.tries ?? 16); attempt++) {
    if (Date.now() - t0 > (opts.ms ?? 15000)) break;
    const note = f => { fails[f.fail] = (fails[f.fail] || 0) + 1; last = f; };
    const rng = rngOf((brief.seed ?? 1) * 7919 + attempt * 104729);
    const roles = placeRoles(c, story, brief, rng); if (roles.fail) { note(roles); if (roles.fail === 'needsIslands') break; continue; }
    const P = planDig(c, roles, rng); if (!P) { note({ fail: 'dig' }); continue; }
    const hold = chooseHolders(c, roles, P, story.spec, rng); if (hold.fail) { note(hold); continue; }
    const plan = placePictures(c, roles, P, hold, brief, rng); if (plan.fail) { note(plan); continue; }
    const down = placeDown(c, roles, P, brief, rng);
    const way = fewest(c, plan.faces, down, roles, budget); if (!way) { note({ fail: 'clockWayUnresolved' }); continue; }
    const pruned = prune(c, plan.faces, down, roles, way.k, budget, t0 + (opts.ms ?? 15000));
    if (!pruned) { note({ fail: 'slow' }); break; }
    const missing = storyKept(story.spec, roles, c); if (missing.length) { note({ fail: 'storyLost', detail: missing.join(', ') }); continue; }
    const clock = { i: roles.clock, n: way.k + spare };
    // the witness: a strict one (no peek pair, valid for the game's own tests) when it fits the clock
    const strict = exactRoute({ tiles: c.tiles, nb: c.nb, faces: plan.faces, rules: rulesOf(c, roles) }, roles.clock, budget.nodes, budget.ms);
    let design = designOf(c, plan.faces, down, roles, clock, strict && strict.k <= clock.n ? strict.path : E.flatten(way.path));
    let rep = E.replay(design, design.solution);
    if (!rep.ok) { design = designOf(c, plan.faces, down, roles, clock, E.flatten(way.path)); rep = E.replay(design, design.solution); }
    if (!rep.ok) { note({ fail: 'witness', detail: rep.why }); continue; }
    const al = new Uint8Array(c.n).fill(1); if (down.some(i => L.isFree(i, al, c.nb))) { note({ fail: 'downFree' }); continue; }
    // holder specials: at the clock every holder is still out of reach (locked or frozen), so the dig's twins wait
    const g = E.game(design); let s = E.start(g); const clockAt = design.solution.indexOf(roles.clock);
    for (let p = 0; p <= clockAt && s; p++) { const i = design.solution[p], j = design.solution[p + 1];
      const nx = E.step(g, s, i); if (nx) s = nx; else if (j !== undefined) { s = E.step(g, s, { pair: g.down[j] ? [i, j] : [j, i] }); p++; } else s = null; }
    const heldBack = hold.holders ? [...hold.holders].filter(h => s && s.alive[h] && !E.legal(g, s).some(a => a === h)).length : null;
    const tray = trayOnWay(design, design.solution);
    const forced = canReachWithin(design, plan.cap - 1);
    let trapInfo = null;
    if (opts.traps !== false) { try { const tr = E.traps(g, null, { nodes: 20000, ms: 150 }); trapInfo = { points: tr.length, tempting: tr.reduce((s, t) => s + t.tempting.length, 0) }; } catch (e) { trapInfo = null; } }
    const intents = [
      { name: 'witness valid (' + (rep.pairs ? 'uses ' + rep.pairs + ' peek pair' + (rep.pairs > 1 ? 's' : '') : 'strict rules') + ')', proven: true },
      { name: 'honest clock: real fewest moves ' + way.k + ' + spare ' + spare, proven: true },
      { name: 'no idle lock or ice', proven: true, detail: pruned.length ? 'taken off: ' + pruned.join(', ') : 'none idle' },
      { name: 'tray reaches ' + plan.cap + ' on the fewest way to the clock', proven: tray.max >= plan.cap, detail: 'max ' + tray.max + ', moves with 3 waiting ' + tray.three +
        '; forced on every way in time: ' + (forced === 'no' ? 'yes' : forced === 'yes' ? 'no (a careful order keeps ' + (plan.cap - 1) + ')' : 'unresolved') },
      ...(hold.holders ? [{ name: 'partners held back at the clock (' + story.spec.coverPartners + ')', proven: story.spec.coverPartners === 'buried' ? heldBack >= 1 : heldBack >= 2, detail: heldBack + ' of ' + hold.holders.size + ' holders out of reach' }] : []),
    ];
    const card = {
      story: story.title, sentence: story.sentence, shape, tiles: c.n, stage: brief.stage || null,
      clock: { tile: roles.clock, depth: c.above[roles.clock].size, fewestMoves: way.k, strictMoves: strict ? strict.k : null, spare, n: clock.n, locked: roles.locks.has(roles.clock), ice: roles.ice[roles.clock] || 0 },
      keys: roles.locks.size ? roles.keys.map(k => ({ tile: k, cover: c.above[k].size, ice: roles.ice[k] || 0, otherPeak: c.peak[k] >= 0 && c.peak[k] !== c.peak[roles.clock] })) : [],
      locks: roles.locks.size, iceTiles: Object.keys(roles.ice).length, dig: P.length, trayCap: plan.cap,
      tray: { ...tray, forced: forced === 'no' ? plan.cap : null }, faceDown: down.length, faceDownOnDig: down.filter(i => P.includes(i)).length, traps: trapInfo, attempt,
      bites: [
        `The clock needs ${way.k} moves and gets ${clock.n}: ${spare} to spare.`,
        `On the way the tray fills to ${tray.max}` + (tray.three ? `, ${tray.three} move${tray.three > 1 ? 's' : ''} with 3 waiting.` : '.'),
        ...(tray.luck ? [`${tray.luck} dig${tray.luck > 1 ? 's' : ''} uncover a face-down tile while 2 wait (luck).`] : []),
        ...(hold.holders ? [`The twins of the tiles on the way are ${story.spec.coverPartners} until after the clock.`] : []),
      ],
    };
    return { design, card, intents, roles: { clock: roles.clock, locks: [...roles.locks], keys: roles.keys, ice: roles.ice }, ms: Date.now() - t0 };
  }
  return { ...(last || { fail: 'noAttempt' }), fails, ms: Date.now() - t0 };
}
// does a story fit a layout at all (islands need two peaks)?
const fits = (storyId, tiles) => STORIES[storyId]?.needs !== 'islands' || context(tiles).peaks >= 2;
module.exports = { build, fits, context, placeRoles, planDig, needSet, placePictures, chooseHolders, coveredDuringDig, LAYOUTS, STORIES };
