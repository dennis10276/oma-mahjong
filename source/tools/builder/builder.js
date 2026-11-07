/* Builder v2 (Claude, 2026-11-06; helper D, 2026-11-06): a level built backwards from a brief, not a random deal with
   traps bolted on. Dennis: "Focus on making the builder better before letting it learn." Spec: SPEC.md section 4.
   Notes, numbers and what changed: analysis/builder/builder-notes.md.

   1. Roles: the story (stories.js) picks the clock, keys, locks and ice on the chosen shape (geometry only). Locks
      on the clock's ice-neighbours: only the ones that would be a cheaper thaw than the keys (no idle locks to prune).
   2. The dig: the tiles the clock needs, worked back from the clock (its cover, the keys of any lock met, the
      cheapest neighbours of any ice, a side when a tile is boxed in), in a legal order: the dig P. The keys are
      taken together once both are free. NECESSARY tiles N: tiles no way to the clock can avoid (with the tile pinned
      to the board the clock can never be reached; unlimited time, so this holds for every order a player picks).
      Holders: tiles that stay covered during the whole dig. A story with covered partners locks them (the keys
      come after the clock), freezes them, or picks the deepest ones.
      The rest of the board Q follows in a legal order that reaches the holders first.
   3. Pictures. FORCED PRESSURE (trayRoom 0, cap 3): two necessary dig tiles, early on the dig, get holders as twins
      (orphans: they wait until after the clock in EVERY order, a twin under the rest of the pile cannot be reached
      within the spare). Then the clock itself makes the third: it either closes a dig tile, which waits beside the
      two orphans until then, or it opens with the two waiting. No order of play keeps a slot free; the engine-free
      search canReachWithin(design, cap - 1) proves it and placements are retried until it says 'no'.
      (cap 2: one orphan; cap 1: none.) The other dig tiles pair greedily along P (open, then the next one closes
      it): with both orphans out every new picture brings the tray to 3. After the clock the holders come first
      (relief), then calm pairs; pictures used four times only on calm pairs late in the way. Decision traps: a free
      face-up pair off the dig, in sight from the start (taking it spends two moves; with spare 1, or with the
      forced pressure, it loses).
   4. Face-down tiles: hiddenOnWay of them, each uncovered by a dig take that opens a picture while 2+ wait (a luck
      moment, as roomProfile counts it); no other face-down tile comes free at such a moment on the planned way.
      Then the clock from the engine: n = real fewest moves (peek pairs included) + spare. When the fewest way is
      shorter than the planned dig, its prefix becomes the dig and the pictures are placed again.
   5. Proofs (engine.js): winnable witness (the planned way when it is a fewest way), honest clock, every special
      changes the fewest way to the clock or holds the partners back (idle ones are taken off, the story's own
      specials must survive), the tray pressure on the way (and forced on every way in time), luck moments on the
      way = target, decision traps (E.winnable: lost after the tempting move), no free cruising before the main
      puzzle (clock not in the last third of the solution, the tray not calm for the whole first half).
     const { build } = require('./builder.js'); build(brief, opts) -> { design, card, intents, roles, fails, ms } | { fail, detail, fails, ms }
   Brief fields beyond SPEC (all optional): frame.way = fewest moves to the clock (within 1; a covered-clock story may
   dig deeper than its depth for it), targets.three = moves with 3 waiting on the way (within 1), targets.luck = luck
   moments (default hiddenOnWay; only possible with trayRoom 0: a luck moment brings the tray to 3), targets.traps.
   Only a board with EVERY intent proven is returned; else { fail: 'unproven', detail }. A build stops at
   opts.hardMs (4.5 s); opts.softMs (2.5 s) ends the search for forced pressure once a proven board is in hand.
   Covered-partner stories (roomInTray*, deepClock) need cap >= 2; an incompatible brief fails explicitly.
   The requested cap is exact; hiddenOnWay is a minimum number of dig tiles, maxDown is a maximum share.
   Explicit trap counts must be proven. frame.share and targets.trapDepth return unsupportedTarget until implemented.
   fits(story, tiles) runs placeRoles with fixed seeds (cached), so it answers "can the roles be placed here".

   What the descriptors say (analysis/builder/descriptors-report.md): the family loses on the clock way to moves
   with 3 tiles waiting; the skilled player loses to face-down tiles uncovered with 2+ waiting (luck moments).
   So trayRoom (cap) is the family's knob and hiddenOnWay the skilled player's.                                 */
'use strict';
const path = require('path'), fs = require('fs');
const L = global.Layouts || (global.Layouts = require('../../www/layouts.js'));
const { exactRoute } = require('../lab/exact.js');
const E = require('./engine.js');
const { STORIES } = require('./stories.js');
const { tileVisibility } = require('../sim/refit/human_board_visibility.js');
const readableOf = d => { try { return require('../factory/placement_score.js').readable(d); } catch (e) { return false; } };

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
  // layer from which the tiles at or above it fall into 2+ groups of 4+ touching tiles gives the peaks (checked on
  // all 48 layouts: the 29 without are single hills, also "castle/oval · two islands"; a smaller group size finds
  // no more). A peak's territory: its tiles plus every lower tile under or beside it (touching) and under or
  // beside no other peak, so keys can lie IN an island (covered), not only on its top layer. Elsewhere: -1.
  let peak = new Array(n).fill(-1), peaks = 0, peakZ = -1;
  const touch = (a, b) => Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2;
  for (let zc = 1; zc <= maxZ && !peaks; zc++) {
    const comp = new Array(n).fill(-1), idx = tiles.map((_, i) => i).filter(i => tiles[i].z >= zc); let nc = 0;
    for (const i of idx) if (comp[i] < 0) { comp[i] = nc; const st = [i]; while (st.length) { const a = tiles[st.pop()];
      for (const j of idx) if (comp[j] < 0 && touch(tiles[j], a)) { comp[j] = nc; st.push(j); } } nc++; }
    const size = {}; for (const i of idx) size[comp[i]] = (size[comp[i]] || 0) + 1;
    const big = Object.keys(size).filter(k => size[k] >= 4).map(Number);
    if (big.length >= 2) { peaks = big.length; peakZ = zc; for (const i of idx) peak[i] = big.indexOf(comp[i]); }
  }
  if (peaks) {
    const top = tiles.map((_, i) => i).filter(i => peak[i] >= 0);
    for (let i = 0; i < n; i++) if (tiles[i].z < peakZ) {
      const ps = new Set(top.filter(j => touch(tiles[i], tiles[j])).map(j => peak[j]));
      if (ps.size === 1) peak[i] = [...ps][0];
    }
  }
  const cx = tiles.reduce((s, t) => s + t.x, 0) / n, cy = tiles.reduce((s, t) => s + t.y, 0) / n;
  const dist = (i, j) => Math.hypot(tiles[i].x - tiles[j].x, (tiles[i].y - tiles[j].y) * 0.8);
  const centre = i => Math.hypot(tiles[i].x - cx, (tiles[i].y - cy) * 0.8);
  // roleShown0[i]: the tile's role overlay (key, lock, ice) is in sight at the start - the game's own rule, as the
  // bots see it (human_board_visibility.js). Builder v3 (Claude 2026-11-07): whether the keys show at the start is
  // what made built boards 3 or 20 tries (analysis/builder/why-hard-claude.md).
  const vis0 = tileVisibility(tiles, { alive: all, down: new Uint8Array(n), openPeek: -1 }, null).tiles;
  const roleShown0 = vis0.map(v => !!v.role);
  return { tiles, n, nb, inb, above, free0, peak, peaks, peakZ, dist, centre, maxZ, roleShown0 };
}

// ---------- 1. roles ----------
// rough moves to take tile i from the full board: itself, its cover, and the cheaper side when it is boxed in
function digCost(c, i) {
  const al = new Uint8Array(c.n).fill(1); for (const a of c.above[i]) al[a] = 0;
  let side = 0;
  if (!L.isFree(i, al, c.nb)) side = Math.min(...['left', 'right'].map(dir => { let k = 0, cur = [i]; const seen = new Set();
    while (cur.length && k < 9) { const nx = []; for (const t of cur) for (const j of c.nb[dir][t]) if (!seen.has(j)) { seen.add(j); k += 1 + c.above[j].size; nx.push(j); } cur = nx; } return k; }));
  return 1 + c.above[i].size + side;
}
function placeRoles(c, story, brief, rng) {
  const s = story.spec, way = brief.frame?.way;
  let depth = brief.frame?.depth != null ? [brief.frame.depth, brief.frame.depth] : (s.clockDepth || [0, 2]);
  // a way target (fewest moves to the clock): a story about a covered clock may dig deeper than its usual depth
  if (way != null && brief.frame?.depth == null && !s.clockLock && !s.clockIce) depth = [depth[0], Math.max(depth[1], way - 1)];
  const inRange = (v, [a, b]) => v >= a && v <= b;
  if (story.needs === 'islands' && c.peaks < 2) return { fail: 'needsIslands' };
  let clocks = [];
  for (let i = 0; i < c.n; i++) if (inRange(c.above[i].size, depth)) clocks.push(i);
  // ice on the clock only counts when its cover (which goes anyway) is not enough to thaw it
  const coverInb = i => c.inb[i].filter(j => c.above[i].has(j)).length;
  // the ice-neighbours that can go before tile i (not under it)
  const thawNbs = i => c.inb[i].filter(j => !c.above[i].has(j) && !c.above[j].has(i));
  if (s.clockIce) clocks = clocks.filter(i => coverInb(i) < s.clockIce && thawNbs(i).length >= s.clockIce - coverInb(i) + (s.lockIceNeighbours ? 0 : 1));
  if (story.needs === 'islands') clocks = clocks.filter(i => c.peak[i] >= 0);
  if (brief.stage === 'centre') clocks.sort((a, b) => c.centre(a) - c.centre(b));
  else if (brief.stage === 'edge') clocks.sort((a, b) => c.centre(b) - c.centre(a));
  else if (brief.stage === 'top') clocks = shuffle(rng, clocks).sort((a, b) => c.tiles[b].z - c.tiles[a].z);
  else clocks = shuffle(rng, clocks);
  // a little variety between attempts even with a fixed stage
  if (brief.stage) clocks = clocks.slice(0, 6).sort(() => rng() - 0.5).concat(clocks.slice(6));
  // locked thaw neighbours: the fewer the clock has, the fewer locks (each one must matter, and proving that a
  // lock is idle costs a full search): clocks with few thaw neighbours first
  if (s.lockIceNeighbours) clocks = clocks.map((i, k) => [thawNbs(i).length * 1000 + k, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  // frozen keys: h = keyIce beyond what their own cover thaws (at most 2: the game draws 1 and 2)
  // a key must come free without digging a whole tower: its cover, and at most a short side (6 moves)
  const openable = i => digCost(c, i) - 1 - c.above[i].size <= 6;
  const keyH = i => { if (!s.keyIce) return 0; const h = Math.max(s.keyIce, coverInb(i) + 1); return h <= 2 ? h : -1; };
  if (way != null) clocks = clocks.map(i => [Math.abs(c.above[i].size + 1 - way) + rng(), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  for (const ck of clocks.slice(0, way != null ? 60 : 12)) {
    const roles = { clock: ck, locks: new Set(), keys: [], ice: {}, holderSpecials: new Set() };
    if (s.clockIce) roles.ice[ck] = s.clockIce;
    if (s.clockLock) roles.locks.add(ck);
    if (s.coverLock) { const cov = [...c.above[ck]].sort((a, b) => c.tiles[b].z - c.tiles[a].z); if (cov.length < s.coverLock) continue; cov.slice(0, s.coverLock).forEach(i => roles.locks.add(i)); }
    let thawLocks = null;
    if (s.lockIceNeighbours && s.clockIce) {
      // the thaw needs h - (its cover) more neighbours; leave one fewer unlocked (the cheapest), lock the rest that
      // could go before the clock. Which of those matter depends on the keys' cost: trimmed below.
      const nbs = shuffle(rng, thawNbs(ck)).sort((a, b) => digCost(c, a) - digCost(c, b));
      const free = Math.max(0, s.clockIce - 1 - coverInb(ck));
      thawLocks = nbs.slice(free);
      if (!thawLocks.length) continue;
      for (const j of thawLocks) roles.locks.add(j);
    }
    const needKeys = roles.locks.size > 0 || s.coverPartners === 'locked';
    if (needKeys) {
      const kc = brief.targets?.keysShown != null ? [0, Math.max(4, (s.keyCover || [1, 3])[1])] : (s.keyCover || [1, 3]), used = new Set([ck, ...roles.locks, ...c.above[ck]]);
      let cands = [];
      for (let i = 0; i < c.n; i++) if (!used.has(i) && inRange(c.above[i].size, kc) && ![...roles.locks].some(l => c.above[l].has(i)) && openable(i)
        && (!s.keyIce || (keyH(i) > 0 && c.inb[i].filter(j => !roles.locks.has(j) && !c.above[j].has(i)).length >= keyH(i) + 1))) cands.push(i);
      if (s.keys === 'island') cands = cands.filter(i => c.peak[i] >= 0 && c.peak[i] !== c.peak[ck]);
      if (s.keys === 'far' || s.keys === 'island') cands.sort((a, b) => c.dist(b, ck) - c.dist(a, ck));
      else if (s.keys === 'deep') cands.sort((a, b) => c.above[b].size - c.above[a].size || c.dist(b, ck) - c.dist(a, ck));
      else cands.sort((a, b) => c.dist(a, ck) - c.dist(b, ck));
      cands = shuffle(rng, cands.slice(0, 6)).concat(cands.slice(6, 16));
      // frozen keys must not thaw each other (each would wait for the other)
      // targets.keysShown (0, 1, 2): how many keys show as keys at the start (a frozen key shows its ice: hidden)
      const shown = k => c.roleShown0[k] && !s.keyIce;
      const wantShown = brief.targets?.keysShown;
      const okPair = (a, b, d) => b !== a && c.dist(a, b) <= d && !c.above[a].has(b) && !c.above[b].has(a) && !(s.keyIce && c.inb[a].includes(b))
        && (wantShown == null || (shown(a) ? 1 : 0) + (shown(b) ? 1 : 0) === wantShown);
      let pair = null;
      for (const d of [6, 9]) { for (const a of cands) { for (const b of cands) if (okPair(a, b, d)) { pair = [a, b]; break; } if (pair) break; } if (pair) break; }
      if (!pair) continue;
      roles.keys = pair;
      if (s.keyIce) for (const k of pair) roles.ice[k] = keyH(k);
      if (thawLocks) {
        // a locked neighbour only matters when going round it is cheaper than the keys: unlock the dear ones
        const keyCost = new Set([...pair, ...c.above[pair[0]], ...c.above[pair[1]]]).size + (s.keyIce ? 2 : 0);
        const first = digCost(c, thawLocks[0]);
        for (const j of thawLocks.slice(1)) if (digCost(c, j) >= keyCost + first + 2) roles.locks.delete(j);
      }
    }
    // the way target: the tiles the clock needs from the full board, roughly the dig
    if (way != null) { const P = planDig(c, roles, rngOf(5)); if (!P || Math.abs(P.length - way) > 1) continue; }
    return roles;
  }
  return { fail: way != null ? 'noClockForWay' : 'noClockPlace' };
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
      // planned: needed neighbours that can go before u on their own (not frozen or locked themselves, not under u):
      // two frozen keys side by side must not count on each other
      const gone = c.inb[u].filter(j => !alive[j]).length;
      const planned = c.inb[u].filter(j => alive[j] && need.has(j) && !roles.ice[j] && !roles.locks.has(j) && !c.above[j].has(u)).length;
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
    // only a lone key is ready while its partner is boxed in: open the partner's side first (keys go together)
    const keysLeft0 = roles.keys.filter(k => alive[k]);
    const loneKey = ready.length && ready.every(i => roles.keys.includes(i)) && keysLeft0.some(k => !can(k));
    if (!ready.length || loneKey) {
      // boxed in sideways: open the cheaper side of a needed tile that has nothing above it
      let side = null;
      for (const i of [...need].filter(i => [...c.above[i]].every(a => !alive[a]) && (!loneKey || (roles.keys.includes(i) && !can(i))))) for (const dir of ['left', 'right']) {
        const chain = []; let cur = [i], ok = true;
        while (cur.length) { const nxt = []; for (const t of cur) for (const j of c.nb[dir][t]) if (alive[j]) { chain.push(j); nxt.push(j); } cur = nxt; if (chain.length > 14) { ok = false; break; } }
        let end = chain.filter(j => can(j)), cost = chain.length;
        // the row's end is covered: dig its cover first
        if (ok && !end.length && chain.length) { const e = chain[chain.length - 1], cov = [...c.above[e]].filter(a => alive[a]); end = cov.filter(a => can(a)); cost += cov.length; }
        if (ok && end.length && (!side || cost < side.cost)) side = { cost, tile: end[0] };
      }
      if (side) ready = [side.tile];
      else if (!ready.length) return null;
    }
    // the keys together once both are free (a key alone waits; a pair taken at once keeps the plan's tray simple),
    // the clock last, a little randomness among the rest
    const keysLeft = roles.keys.filter(k => alive[k]), keysReady = keysLeft.filter(can).length === keysLeft.length;
    const score = i => (roles.keys.includes(i) ? (keysReady ? 100 : -50) : 0) + (i === roles.clock ? -100 : 0) + c.tiles[i].z + rng() * 0.5;
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
    const keysLeft = roles.keys.filter(k => alive[k]), keysReady = keysLeft.every(k => can(k));
    const score = i => (wanted.has(i) ? 3 : 0) + ([...wanted].some(w => alive[w] && c.above[w].has(i)) ? 2 : 0) + rng()
      + (roles.keys.includes(i) ? (keysReady ? 10 : -10) : 0);
    ready.sort((a, b) => score(b) - score(a));
    const i = ready[0]; alive[i] = 0; Q.push(i);
  }
  return Q;
}

// ---------- order-free facts: what every way to the clock must do ----------
// what can leave the board (unlimited time, tray ignored) while tile `pin` stays: 1 = stays
function stuckWith(c, roles, pin) {
  const rules = rulesOf(c, roles), alive = new Uint8Array(c.n).fill(1), all = alive.slice();
  for (let changed = true; changed;) { changed = false; for (let i = 0; i < c.n; i++) if (alive[i] && i !== pin && L.takeable(i, alive, c.nb, rules, all)) { alive[i] = 0; changed = true; } }
  return alive;
}
// necessary dig tiles: with one pinned the clock can never be taken, so every way takes it (before the clock)
function necessary(c, roles, P) {
  const N = new Set([roles.clock]);
  for (const t of P) if (t !== roles.clock && stuckWith(c, roles, t)[roles.clock]) N.add(t);
  return N;
}

// ---------- 3. pictures ----------
/* The dig's pairs along P. orphans: open until after the clock (their twins are holders). The keys are one pair.
   Every other dig tile closes an open one when it can (one on top of it first), else opens. The clock closes the
   last open one or opens (then the first tile after the dig closes it). Fails when the tray would hold more than
   cap, or a dig tile is left open at the clock. */
function digPairs(c, roles, P, orphans, cap) {
  const pos = new Map(P.map((t, k) => [t, k])), ck = roles.clock, orph = new Set(orphans);
  const inKeys = roles.keys.filter(k => pos.has(k));
  if (inKeys.length === 1) return null;
  const keys = inKeys.length === 2 ? inKeys.sort((a, b) => pos.get(a) - pos.get(b)) : null;
  const pairOf = new Map(), open = [], occ = [], opens = []; let w = 0;
  const close = (t, o) => { pairOf.set(t, o); pairOf.set(o, t); open.splice(open.indexOf(o), 1); };
  for (const t of P) {
    let opened = false;
    if (orph.has(t)) { w++; opened = true; }
    else if (keys && t === keys[1]) close(t, keys[0]);
    else if (keys && t === keys[0]) { open.push(t); opened = true; }
    else {
      const cl = open.filter(o => !keys || o !== keys[0]);
      if (cl.length) close(t, cl.find(o => c.above[t].has(o)) ?? cl[cl.length - 1]);
      else { open.push(t); opened = true; }
    }
    if (w + open.length > cap) return null;
    occ.push(w + open.length); opens.push(opened);
  }
  const clockOpen = open.includes(ck);
  if (open.length > (clockOpen ? 1 : 0)) return null;
  return { pairOf, orphans: orphans.slice(), clockOpen, occ, opens, open: [...orphans, ...open] };
}
/* choose the orphans: necessary dig tiles (not the clock or a key). The earlier they go, the longer the tray sits
   at the cap: `three` (moves with 3 waiting on the dig) picks the choice nearest to it; without a target, the
   earliest feasible choice (the most pressure). A variant takes another choice of about the same quality. */
function planDigPictures(c, roles, P, N, cap, rng, variant, three, luck = 0) {
  const want = Math.max(0, cap - 1), pos = new Map(P.map((t, k) => [t, k]));
  // the steps of P that uncover a tile that may be face-down (for luck moments)
  const special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const frees = []; { const al = new Uint8Array(c.n).fill(1);
    for (const t of P) { const before = []; for (let i = 0; i < c.n; i++) before.push(al[i] && L.isFree(i, al, c.nb)); al[t] = 0;
      let k = false; for (let i = 0; i < c.n && !k; i++) if (al[i] && !before[i] && !special.has(i) && L.isFree(i, al, c.nb)) k = true; frees.push(k); } }
  const luckSteps = d => d.opens.filter((o, k) => o && (k ? d.occ[k - 1] : 0) >= 2 && frees[k]).length;
  const nec = P.filter(t => N.has(t) && t !== roles.clock && !roles.keys.includes(t));
  // too few necessary tiles: dig tiles that are not necessary help the planned way (not every way)
  const cands = nec.length >= want ? nec : nec.concat(P.filter(t => !N.has(t) && !roles.keys.includes(t) && !roles.locks.has(t)));
  for (let m = Math.min(want, cands.length); m >= 0; m--) {
    let combos = [];
    if (m === 0) combos = [[]];
    else if (m === 1) combos = cands.map(a => [a]);
    else for (let a = 0; a < cands.length; a++) for (let b = a + 1; b < cands.length; b++) combos.push([cands[a], cands[b]]);
    const ok = [];
    for (const o of combos) { const d = digPairs(c, roles, P, o, cap); if (d) ok.push(d); }
    if (!ok.length) continue;
    const at3 = d => d.occ.filter(w => w >= 3).length, early = d => d.orphans.reduce((s, t) => s + pos.get(t), 0);
    const cost = d => (three != null ? Math.abs(at3(d) - three) * 100 : 0) + Math.max(0, luck - luckSteps(d)) * 40 + early(d) + (variant ? rng() * 3 * variant : 0);
    ok.sort((a, b) => cost(a) - cost(b));
    return { ...ok[0], forcedShape: m === want && want > 0 && ok[0].orphans.every(t => N.has(t)) };
  }
  return null;
}
/* Decision traps: a free face-up pair off the dig, in sight from the start. It does not help the clock (not on the
   dig, not beside a dig tile, not a thaw neighbour of a frozen tile on the way, no special), so taking it spends
   two moves; with spare 1 that loses, and with the forced pressure even one of them does. */
function trapCandidates(c, roles, P, wanted) {
  const inP = new Set(P), special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const nearDig = new Set();
  for (const t of P) { for (const j of c.nb.left[t]) nearDig.add(j); for (const j of c.nb.right[t]) nearDig.add(j); }
  for (const f of Object.keys(roles.ice).map(Number)) for (const j of c.inb[f]) nearDig.add(j);
  return [...Array(c.n).keys()].filter(i => c.free0[i] && !inP.has(i) && !special.has(i) && !wanted.has(i) && !nearDig.has(i));
}
function placePictures(c, roles, P, hold, brief, rng, N, variant = 0) {
  const cap = capOf(brief), spare = brief.frame?.spare ?? 1;
  const inP = new Set(P), { cov, holders } = hold, ck = roles.clock;
  // a holder: covered during the whole dig and more than `spare` moves away from it (else a player takes it in time)
  const after = new Uint8Array(c.n).fill(1); for (const i of P) after[i] = 0;
  const deep = t => { const a = after.slice(); let cost = 1; for (const x of c.above[t]) if (a[x]) { a[x] = 0; cost++; }
    return cost + (L.isFree(t, a, c.nb) ? 0 : 1) > spare; };
  const mayHold = t => holders ? holders.has(t) : !!cov[t] && !inP.has(t) && deep(t);
  const wanted = new Set(holders ? [...holders] : [...Array(c.n).keys()].filter(mayHold));
  if (holders && [...holders].some(h => roles.locks.has(h))) for (const k of roles.keys) if (!inP.has(k)) wanted.add(k);
  // Retry other roles when this dig cannot meet the requested cap; never silently increase it.
  const dig = planDigPictures(c, roles, P, N || new Set([ck]), cap, rng, variant, brief.targets?.three, luckTargetOf(brief, cap));
  if (!dig) return { fail: 'digPictures' };
  let Q = planRest(c, roles, P, wanted, rng); if (!Q) return { fail: 'restOrder' };
  // decision traps: move the later tile of each pair next to the earlier one (moving a free tile earlier keeps
  // the order legal); not among the first tiles after the dig (the tray is full there)
  const nTraps = brief.targets?.traps ?? (spare <= 1 ? 1 : 0), traps = [];
  if (nTraps > 0) {
    const cands = shuffle(rng, trapCandidates(c, roles, P, wanted)), qpos = new Map(Q.map((t, k) => [t, k]));
    const late = cands.filter(t => qpos.get(t) >= 4).sort((a, b) => qpos.get(a) - qpos.get(b));
    const used = new Set();
    for (const x of late) { if (traps.length >= nTraps) break; if (used.has(x)) continue;
      const y = late.find(t => t !== x && !used.has(t) && qpos.get(t) > qpos.get(x)); if (y === undefined) continue;
      used.add(x); used.add(y); traps.push([x, y]); }
    for (const [x, y] of traps) { Q = Q.filter(t => t !== y); Q.splice(Q.indexOf(x) + 1, 0, y); }
  }
  const W = P.concat(Q), pos = new Array(c.n); W.forEach((t, k) => pos[t] = k);
  const pairOf = new Array(c.n).fill(-1); for (const [a, b] of dig.pairOf) pairOf[a] = b;
  const fixed = new Map(); for (const [x, y] of traps) { fixed.set(x, y); fixed.set(y, x); }
  const qKeys = roles.keys.length === 2 && roles.keys.every(k => !inP.has(k)) ? roles.keys : null;
  if (qKeys) { fixed.set(qKeys[0], qKeys[1]); fixed.set(qKeys[1], qKeys[0]); }
  const open = dig.open.slice(), fromDig = o => pos[o] < P.length;
  const closeWith = (t, o) => { pairOf[t] = o; pairOf[o] = t; open.splice(open.indexOf(o), 1); };
  let freeLeft = Q.filter(t => !fixed.has(t)).length;
  for (let k = P.length; k < W.length; k++) {
    const t = W[k];
    const f = fixed.get(t);
    if (f !== undefined) {
      if (open.includes(f)) closeWith(t, f);
      else { if (open.length >= 3) return { fail: 'trayOverflow' }; open.push(t); }
      continue;
    }
    // the dig's open tiles close only on a holder (the clock: on anything, it is gone already)
    const closable = open.filter(o => !fixed.has(o) && (o === ck || !fromDig(o) || mayHold(t)));
    const openFree = open.filter(o => !fixed.has(o)).length;
    const mustClose = open.length >= 3 || openFree >= freeLeft;
    freeLeft--;
    const close = closable.some(fromDig) || mustClose || open.length >= 2 || (open.length >= 1 && rng() < 0.55);
    if (close && closable.length) closeWith(t, closable.filter(fromDig).concat(closable.filter(o => !fromDig(o)))[0]);
    else { if (open.length >= 3) return { fail: 'trayOverflow' }; open.push(t); }
  }
  if (open.length) return { fail: 'unpaired' };
  // pairs -> pictures: 36 pictures; a picture four times only on calm pairs late in the way
  const pairs = [], seen = new Set();
  for (const t of W) if (!seen.has(t)) { seen.add(t); seen.add(pairOf[t]); pairs.push([t, pairOf[t]]); }
  const doubles = Math.max(0, pairs.length - 36);
  const trapT = new Set(traps.flat());
  const late = pairs.map((p, k) => k).filter(k => Math.min(pos[pairs[k][0]], pos[pairs[k][1]]) > P.length + 6 && !trapT.has(pairs[k][0]));
  if (late.length < doubles * 2) return { fail: 'tooFewLatePairs' };
  const lateSet = new Set(shuffle(rng, late).slice(0, doubles * 2)), order = shuffle(rng, [...Array(36).keys()]);
  const faces = new Array(c.n).fill(-1); let f = 0;
  pairs.forEach((p, k) => { if (!lateSet.has(k)) { faces[p[0]] = faces[p[1]] = order[f++]; } });
  const lateList = [...lateSet];
  for (let k = 0; k < lateList.length; k += 2) { const face = order[f++]; for (const q of [lateList[k], lateList[k + 1]]) faces[pairs[q][0]] = faces[pairs[q][1]] = face; }
  const maxWait = Math.max(0, ...dig.occ), atCap = dig.occ.filter(w => w >= cap).length;
  return { W, Q, faces, pairOf, pos, cap, maxWait, atCap, dig, traps, clockTwin: pairOf[ck] };
}

// ---------- 4. face-down tiles ----------
/* hiddenOnWay luck moments on the planned way: a dig take that opens a picture while 2+ wait and uncovers a
   face-down tile. Exactly that many such tiles; every other face-down tile comes free at another moment (or after
   the clock), so the planned way has exactly hiddenOnWay luck moments. Never face-down: specials, the clock's twin
   and the tile it closes (a peek pair with the clock would skip a tray slot), the trap pairs (they must be in sight). */
function placeDown(c, roles, P, plan, brief, rng) {
  const target = Math.round((brief.targets?.maxDown ?? 0.3) * c.n), onWay = luckTargetOf(brief, plan.cap);
  const onDig = Math.max(onWay, brief.targets?.hiddenOnWay ?? 0);
  const special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const avoid = new Set([...special, plan.clockTwin, ...plan.traps.flat()]);
  const inP = new Set(P);
  const alive = new Uint8Array(c.n).fill(1), luckSteps = [], atLuck = new Set();
  for (let k = 0; k < P.length; k++) {
    const before = []; for (let i = 0; i < c.n; i++) before.push(alive[i] && L.isFree(i, alive, c.nb));
    alive[P[k]] = 0;
    const newly = []; for (let i = 0; i < c.n; i++) if (alive[i] && !before[i] && L.isFree(i, alive, c.nb)) newly.push(i);
    const wBefore = k ? plan.dig.occ[k - 1] : 0;
    if (plan.dig.opens[k] && wBefore >= 2) { if (P[k] !== roles.clock) luckSteps.push({ k, newly }); for (const i of newly) atLuck.add(i); }
  }
  // spread the chosen moments over the luck steps; a dig tile first at each
  const down = [], steps = luckSteps.filter(s => s.newly.some(i => !avoid.has(i)));
  const pickSteps = [];
  for (let q = 0; q < Math.min(onWay, steps.length); q++) pickSteps.push(steps[Math.floor((q + 0.5) * steps.length / Math.min(onWay, steps.length))]);
  for (const s of pickSteps) {
    const ok = shuffle(rng, s.newly.filter(i => !avoid.has(i) && !down.includes(i)));
    const pick = ok.find(i => inP.has(i)) ?? ok[0];
    if (pick !== undefined) down.push(pick);
  }
  const luckPicked = down.length;
  // more face-down tiles on the dig (hiddenOnWay counts tiles on the dig): ones that come free at a calm moment
  for (const i of shuffle(rng, P.filter(i => !c.free0[i] && !avoid.has(i) && !atLuck.has(i) && !down.includes(i)))) { if (down.filter(t => inP.has(t)).length >= onDig) break; down.push(i); }
  // the rest: off the dig, never uncovered at a luck moment of the planned way, not free at the start
  const rest = shuffle(rng, [...Array(c.n).keys()].filter(i => !c.free0[i] && !avoid.has(i) && !inP.has(i) && !atLuck.has(i) && !down.includes(i)));
  return { down: down.concat(rest.slice(0, Math.max(0, target - down.length))), luckPlanned: luckPicked, luckSteps: luckSteps.length };
}

// a luck moment is a take that brings the tray to 3: only possible when the cap is 3
const luckTargetOf = (brief, cap = capOf(brief)) => cap >= 3 ? Math.max(0, brief.targets?.luck ?? brief.targets?.hiddenOnWay ?? 0) : 0;   // v3: the way stays readable unless asked (Dennis's rule; Task 10 pilot failed it)
// The requested tray cap. Incompatible stories must fail rather than change the brief.
function capOf(brief) {
  return Math.max(1, Math.min(3, 3 - (brief.targets?.trayRoom ?? 1)));
}

// ---------- 5. proofs ----------
const designOf = (c, faces, down, roles, clock, solution = []) => ({
  tiles: c.tiles.map(t => [t.x, t.y, t.z]), faces, down, gold: [],
  obst: { ice: Object.fromEntries(Object.entries(roles.ice).map(([k, v]) => [+k, v])), locks: [...roles.locks], keys: roles.locks.size ? roles.keys.slice() : [] },
  clock, solution });
// budgets never run past the build's deadline (clockSearch gives every candidate goal its own finishing budget:
// keep that small too)
let DEADLINE = Infinity;
const within = b => { const left = Math.max(1, DEADLINE - Date.now()); return { nodes: b.nodes, ms: Math.min(b.ms, left), finishNodes: Math.min(b.nodes, 100000), finishMs: Math.min(800, left) }; };
function fewest(c, faces, down, roles, budget) {
  if (Date.now() > DEADLINE) return null;
  const d = designOf(c, faces, down, roles, { i: roles.clock, n: 999 });
  const r = E.clockShortest(E.game(d), within(budget));
  return r && !r.unsure ? r : null;
}
// every lock and ice tile must change the fewest way to the clock (or be a holder special, checked apart);
// idle ones are taken off one at a time (redundancy shifts after each removal). A safety net: placeRoles locks
// only what should matter.
/* a quick proof that a special matters: without it a shorter legal way to the clock exists (planned like the dig,
   the tray never over 3, the rest provably winnable), so the fewest way gets shorter. No proof: ask the engine. */
function shorterWithout(c, faces, down, r, k0) {
  const P = planDig(c, r, rngOf(11)); if (!P || P.length >= k0) return false;
  const d = designOf(c, faces, down, r, { i: r.clock, n: 999 }), g = E.game(d);
  let st = E.start(g); for (const i of P) { st = E.step(g, st, i); if (!st) return false; }
  return E.winnable(g, st, { nodes: 40000, ms: 300 }).result === 'win';
}
// locks on the clock's thaw neighbours that do not shorten the planned dig when taken off: off before the pictures
function trimThawLocks(c, roles, story) {
  if (!story.spec.lockIceNeighbours) return [];
  const base = planDig(c, roles, rngOf(11)); if (!base) return [];
  const off = [];
  for (const j of [...roles.locks]) {
    if (j === roles.clock || roles.holderSpecials.has('lock ' + j) || roles.locks.size <= 1) continue;
    const r = { ...roles, locks: new Set(roles.locks) }; r.locks.delete(j);
    const P = planDig(c, r, rngOf(11));
    if (P && P.length >= base.length) { roles.locks.delete(j); off.push('lock ' + j); }
  }
  return off;
}
function prune(c, faces, down, roles, k0, budget, deadline = Infinity, spec = {}) {
  const removed = [];
  const storyOwn = s => s === 'lock ' + roles.clock || s === 'ice ' + roles.clock || (spec.keyIce && roles.keys.some(k => s === 'ice ' + k));
  for (let round = 0; round < 12; round++) {
    if (Date.now() > deadline) return null;
    let idle = null;
    const specials = [...roles.locks].map(l => 'lock ' + l).concat(Object.keys(roles.ice).map(i => 'ice ' + i)).filter(s => !roles.holderSpecials.has(s));
    const order = shuffle(rngOf(round + 7), specials).sort((a, b) => storyOwn(b) - storyOwn(a));
    for (const s of order) {
      if (Date.now() > deadline) return null;
      const r = { ...roles, locks: new Set(roles.locks), ice: { ...roles.ice } };
      const [kind, i] = s.split(' '); if (kind === 'lock') r.locks.delete(+i); else delete r.ice[+i];
      // an unresolved search proves nothing: try once more with four times the budget, else give up (never
      // claim "none idle" without a proof)
      if (shorterWithout(c, faces, down, r, k0)) continue;
      // idle when no way takes the clock in k0 - 1 moves without a 4th waiting tile (the rest of the board ignored:
      // a sufficient proof, much cheaper than the engine's finishable search)
      if (canReachWithin(designOf(c, faces, down, r, { i: r.clock, n: k0 - 1 }), 3, 30000) === 'no') { idle = { s, r }; break; }
      let w = fewest(c, faces, down, r, budget);
      if (!w) w = fewest(c, faces, down, r, { nodes: budget.nodes * 4, ms: Math.max(0, Math.min(budget.ms * 2, deadline - Date.now())) });
      if (!w) return { unresolved: s };
      if (w.k >= k0) { idle = { s, r }; break; }
    }
    if (!idle) break;
    removed.push(idle.s); roles.locks = idle.r.locks; roles.ice = idle.r.ice;
    if (storyOwn(idle.s) && storyKept(spec, roles).length) return removed;   // the story is lost: no need to go on
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
// the tray along a flat path up to the clock (peek pairs need no slot); firstTwo: index at which 2 first wait
function trayOnWay(d, flat) {
  const g = E.game(d), F = d.faces, tray = [], ck = d.clock.i; let max = 0, three = 0, luck = 0, firstTwo = -1, firstOne = -1;
  const alive = new Uint8Array(F.length).fill(1);
  const uncovers = i => { const a2 = alive.slice(); a2[i] = 0; return d.down.some(j => a2[j] && !L.isFree(j, alive, g.nb) && L.isFree(j, a2, g.nb)); };
  for (let p = 0; p < flat.length; p++) {
    const i = flat[p], q = tray.indexOf(F[i]);
    if (q < 0 && tray.length >= 3) { alive[i] = 0; alive[flat[p + 1]] = 0; p++; if (flat[p] === ck || i === ck) break; continue; }
    if (q < 0 && tray.length >= 2 && uncovers(i)) luck++;
    alive[i] = 0; if (q >= 0) tray.splice(q, 1); else tray.push(F[i]);
    max = Math.max(max, tray.length); if (tray.length >= 3) three++;
    if (tray.length >= 2 && firstTwo < 0) firstTwo = p;
    if (tray.length >= 1 && firstOne < 0) firstOne = p;
    if (i === ck) break;
  }
  return { max, three, luck, firstTwo, firstOne };
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
    if (m >= d.clock.n) return false;
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
      if (i === ck || j === ck) return m + 1 <= d.clock.n; // one action, checked after both removals
      const a2 = al.slice(); a2[i] = 0; a2[j] = 0;
      if (rec(a2, tray, m + 2)) return true;
    }
    return false;
  };
  try { return rec(init.slice(), [], 0) ? 'yes' : 'no'; } catch (e) { if (e === BUDGETX) return 'unknown'; throw e; }
}
const BUDGETX = { budget: true };

// one try at pictures + face-down tiles on a fixed dig; forced: the quick proof with the clock at |P| + spare
// (the real n is never larger: k <= |P|), so a 'no' here stays a 'no'
function picturesFor(c, roles, P, hold, brief, rng, N, cap, spare, variants, note) {
  let pick = null;
  for (let v = 0; v < variants; v++) {
    const plan = placePictures(c, roles, P, hold, brief, rng, N, v);
    if (plan.fail) { note(plan); continue; }
    const pd = placeDown(c, roles, P, plan, brief, rng);
    if (pd.down.filter(i => P.includes(i)).length < (brief.targets?.hiddenOnWay ?? 0)) { note({ fail: 'hiddenOnWay', detail: 'not enough eligible dig tiles' }); continue; }
    if (pd.down.length > Math.round((brief.targets?.maxDown ?? 0.3) * c.n)) { note({ fail: 'maxDown' }); continue; }
    let forced = 'skip';
    if (cap > 1 && plan.dig.forcedShape) forced = canReachWithin(designOf(c, plan.faces, pd.down, roles, { i: roles.clock, n: P.length + spare }), cap - 1, 40000);
    const cand = { plan, down: pd.down, luckPlanned: pd.luckPlanned, forced };
    const lt = luckTargetOf(brief, cap), luckOk = x => Math.abs(x.luckPlanned - lt) <= 1;
    const rank = x => (luckOk(x) ? 8 : 0) + (x.forced === 'no' ? 4 : 0) + (x.plan.dig.forcedShape ? 2 : 0) - Math.abs(x.luckPlanned - lt) * 0.1;
    if (!pick || rank(cand) > rank(pick)) pick = cand;
    if (luckOk(cand) && (forced === 'no' || cap <= 1 || !plan.dig.forcedShape)) break;
  }
  return pick;
}

function build(briefIn, opts = {}) {
  const t0 = Date.now(), brief = { targets: {}, ...briefIn };
  const story = STORIES[brief.story]; if (!story) return { fail: 'unknownStory', detail: brief.story, ms: 0 };
  if (brief.targets.trayRoom != null && ![0, 1, 2].includes(brief.targets.trayRoom)) return { fail: 'invalidBrief', detail: 'trayRoom must be 0, 1 or 2', ms: 0 };
  if (story.spec.coverPartners && capOf(brief) < 2) return { fail: 'incompatibleBrief', detail: 'A covered-partner story needs at least two waiting tiles; choose trayRoom 0 or 1.', ms: 0 };
  if (brief.targets.luck > 0 && capOf(brief) < 3) return { fail: 'incompatibleBrief', detail: 'Luck moments require trayRoom 0.', ms: 0 };
  if (brief.frame?.share != null || brief.targets.trapDepth != null) return { fail: 'unsupportedTarget', detail: 'frame.share and targets.trapDepth are not implemented; no proof can be claimed.', ms: 0 };
  let tiles = brief.tiles, shape = brief.shape || null;
  if (!tiles) {
    const lays = LAYOUTS.filter(l => l.shape === brief.shape || l.base === brief.shape);
    const lay = brief.layout != null ? LAYOUTS[brief.layout] : lays[(brief.seed ?? 0) % Math.max(1, lays.length)];
    if (!lay) return { fail: 'unknownShape', detail: brief.shape, ms: 0 };
    tiles = lay.tiles; shape = lay.shape;
  }
  if (tiles.length < 72 || tiles.length > 96) return { fail: 'tileCount', detail: 'Builder v2 requires 72 to 96 tiles.', ms: Date.now() - t0 };
  const c = ctxOf(tiles);
  if (c.n % 2) return { fail: 'oddTiles', ms: 0 };
  if (opts.keep?.geometry && opts.keep.geometry !== JSON.stringify(c.tiles)) return { fail: 'incompatibleKeep', detail: 'The kept puzzle belongs to another layout.', ms: 0 };
  if (opts.keep?.story && opts.keep.story !== brief.story) return { fail: 'incompatibleKeep', detail: 'The kept puzzle belongs to another story.', ms: 0 };
  const budget = opts.budget || { nodes: 300000, ms: 3000 }, spare = brief.frame?.spare ?? 1, fails = {};
  const msMax = opts.ms ?? 15000, deadline = t0 + Math.min(msMax, opts.hardMs ?? 4500), cap = capOf(brief);
  // forced pressure is a goal: keep trying other roles while it is missing, within this soft time
  const softMs = opts.softMs ?? Math.min(2500, msMax / 3), variants = opts.variants ?? 6;
  DEADLINE = deadline;
  try { return buildIn(c, story, brief, shape, opts, { t0, budget, spare, fails, msMax, deadline, cap, softMs, variants }); } finally { DEADLINE = Infinity; }
}
function buildIn(c, story, brief, shape, opts, { t0, budget, spare, fails, msMax, deadline, cap, softMs, variants }) {
  let last = null, best = null, built = 0;
  for (let attempt = 0; attempt < (opts.tries ?? 16); attempt++) {
    if (Date.now() > deadline) break;
    if (best && best.allProven && (best.forcedOk || Date.now() - t0 > softMs || built >= (opts.goalTries ?? 4))) break;
    const note = f => { fails[f.fail] = (fails[f.fail] || 0) + 1; last = f; };
    const rng = rngOf((brief.seed ?? 1) * 7919 + attempt * 104729);
    // opts.keep (a result's .keep): the same puzzle - clock, keys, locks, ice, dig and holders - with only the
    // pictures and face-down tiles placed again, so one target (three, luck, traps, spare) can change on its own
    let roles, trimmed = [], P, hold;
    if (opts.keep) {
      const k = opts.keep;
      roles = { clock: k.roles.clock, locks: new Set(k.roles.locks), keys: k.roles.keys.slice(), ice: { ...k.roles.ice }, holderSpecials: new Set(k.roles.holderSpecials) };
      P = k.P.slice(); hold = { cov: coveredDuringDig(c, P), holders: k.holders ? new Set(k.holders) : null };
    } else {
      roles = placeRoles(c, story, brief, rng); if (roles.fail) { note(roles); if (roles.fail === 'needsIslands') break; continue; }
      trimmed = trimThawLocks(c, roles, story);
      P = planDig(c, roles, rng); if (!P) { note({ fail: 'dig' }); continue; }
      if (brief.frame?.way != null && Math.abs(P.length - brief.frame.way) > 2) { note({ fail: 'wayLength', detail: P.length + ' for ' + brief.frame.way }); continue; }
      hold = chooseHolders(c, roles, P, story.spec, rng); if (hold.fail) { note(hold); continue; }
    }
    const keepOf = () => ({ geometry: JSON.stringify(c.tiles), story: brief.story, roles: { clock: roles.clock, locks: [...roles.locks], keys: roles.keys.slice(), ice: { ...roles.ice }, holderSpecials: [...roles.holderSpecials] }, P: P.slice(), holders: curHold.holders ? [...curHold.holders] : null });
    let pick = null, way = null, pruned = trimmed.slice(), replans = 0, stop = false, N = null, curHold = hold;
    for (let round = 0; round < 4 && !stop; round++) {
      N = necessary(c, roles, P);
      pick = picturesFor(c, roles, P, curHold, brief, rng, N, cap, spare, variants, note);
      if (!pick) { stop = true; break; }
      if (curHold.holders) {
        // a holder's lock or ice only matters when it holds the twin of a dig tile that waits at the clock
        const orph = new Set(pick.plan.dig.orphans), used = [...curHold.holders].filter(h => orph.has(pick.plan.pairOf[h]));
        if (used.length < holdersNeeded(story, pick.plan.dig.orphans)) { note({ fail: 'fewHolderTwins' }); stop = true; break; }
        if (opts.keep && used.length !== curHold.holders.size) { note({ fail: 'unproven', detail: 'The requested pictures would discard a kept holder.' }); stop = true; break; }
        for (const h of curHold.holders) if (!used.includes(h)) {
          if (roles.holderSpecials.delete('lock ' + h)) roles.locks.delete(h);
          if (roles.holderSpecials.delete('ice ' + h)) delete roles.ice[h];
        }
        curHold = { cov: curHold.cov, holders: new Set(used) };
      }
      way = fewest(c, pick.plan.faces, pick.down, roles, budget); if (!way) { note({ fail: 'clockWayUnresolved' }); stop = true; break; }
      // the fewest way is shorter than the planned dig: its prefix is the dig, place the pictures again
      if (way.k < P.length && replans < 2) {
        if (opts.keep) { note({ fail: 'unproven', detail: 'The requested pictures would shorten the kept dig.' }); stop = true; break; }
        const flat = E.flatten(way.path), P2 = flat.slice(0, flat.indexOf(roles.clock) + 1), cov2 = coveredDuringDig(c, P2);
        if (curHold.holders && [...curHold.holders].some(h => !cov2[h] || P2.includes(h))) { note({ fail: 'holdersOnWay' }); stop = true; break; }
        P = P2; curHold = { cov: cov2, holders: curHold.holders }; replans++; continue;
      }
      const pr = prune(c, pick.plan.faces, pick.down, roles, way.k, opts.pruneBudget || { nodes: 150000, ms: 1500 }, deadline, story.spec);
      if (!pr) { note({ fail: 'slow' }); stop = true; break; }
      if (pr.unresolved) { note({ fail: 'pruneUnresolved', detail: pr.unresolved }); stop = true; break; }
      if (opts.keep && pr.length) { note({ fail: 'unproven', detail: 'The requested pictures would prune a kept special.' }); stop = true; break; }
      pruned = pruned.concat(pr);
      if (storyKept(story.spec, roles).length) break;
      if (pr.length && round < 3) continue;          // a special went: the necessary tiles may have changed
      if (pr.length) pick.stale = true;              // (last round: prove the pressure again on the final board)
      break;
    }
    if (stop || !pick || !way) continue;
    const missing = storyKept(story.spec, roles, c); if (missing.length) { note({ fail: 'storyLost', detail: missing.join(', ') }); continue; }
    const { plan, down } = pick;
    const clock = { i: roles.clock, n: way.k + spare };
    // the witness: the planned way when it is a fewest way (its luck and tray are the planned ones), else a strict
    // one (no peek pair, valid for the game's own tests) when it fits the clock, else the engine's
    let design = null, rep = null, witness = null;
    if (P.length === way.k) { design = designOf(c, plan.faces, down, roles, clock, plan.W); rep = E.replay(design, design.solution); witness = 'planned'; }
    if (!rep || !rep.ok) {
      const strict = exactRoute({ tiles: c.tiles, nb: c.nb, faces: plan.faces, rules: rulesOf(c, roles) }, roles.clock, budget.nodes, Math.max(1, Math.min(budget.ms, deadline - Date.now())));
      design = designOf(c, plan.faces, down, roles, clock, strict && strict.k <= clock.n ? strict.path : E.flatten(way.path));
      rep = E.replay(design, design.solution); witness = strict && strict.k <= clock.n ? 'strict' : 'engine';
      if (!rep.ok) { design = designOf(c, plan.faces, down, roles, clock, E.flatten(way.path)); rep = E.replay(design, design.solution); witness = 'engine'; }
    }
    if (!rep.ok) { note({ fail: 'witness', detail: rep.why }); continue; }
    const al = new Uint8Array(c.n).fill(1); if (down.some(i => L.isFree(i, al, c.nb))) { note({ fail: 'downFree' }); continue; }
    const res = prove(c, story, brief, roles, P, curHold, plan, down, design, rep, way, clock, spare, pruned, N, pick, witness, budget, deadline);
    res.card.attempt = attempt; res.card.shape = shape; res.keep = keepOf(); built++;
    if (!res.allProven) note({ fail: 'unproven', detail: res.intents.filter(i => !i.proven).map(i => i.name + ' (' + (i.detail || '') + ')').join('; ') });
    if (!best || res.score > best.score) best = res;
  }
  // only a board whose every intent is proven leaves the builder
  if (!best || !best.allProven) return { ...(best ? { fail: 'unproven', detail: best.intents.filter(i => !i.proven).map(i => i.name + ' (' + (i.detail || '') + ')').join('; ') } : last || { fail: 'noAttempt' }), fails, ms: Date.now() - t0 };
  const { design, card, intents, roles, keep } = best;
  return { design, card, intents, roles, keep, fails, ms: Date.now() - t0 };
}

const holdersNeeded = (story, orphans) => Math.max(1, Math.min(story.spec.coverPartners === 'buried' ? 1 : 2, orphans.length));
// the intents and the card of one built board
function prove(c, story, brief, roles, P, hold, plan, down, design, rep, way, clock, spare, pruned, N, pick, witness, budget, deadline) {
  const g = E.game(design), sol = design.solution, clockAt = sol.indexOf(roles.clock), cap = plan.cap;
  // holder specials: at the clock every holder is still out of reach (locked or frozen), so the dig's twins wait
  let s = E.start(g);
  for (let p = 0; p <= clockAt && s; p++) { const i = sol[p], j = sol[p + 1];
    const nx = E.step(g, s, i); if (nx) s = nx; else if (j !== undefined) { s = E.step(g, s, { pair: g.down[j] ? [i, j] : [j, i] }); p++; } else s = null; }
  const orph = new Set(plan.dig.orphans);
  const heldBack = hold.holders ? [...hold.holders].filter(h => s && s.alive[h] && !E.legal(g, s).some(a => a === h) && orph.has(plan.pairOf[h]) && s.tray.includes(plan.pairOf[h])).length : null;
  const tray = trayOnWay(design, sol);
  const forced = cap > 1 ? (pick.forced === 'no' && P.length + spare === clock.n && !pick.stale ? 'no' : canReachWithin(design, cap - 1, 60000)) : 'skip';
  // decision traps: from the start, taking a tile of the free pair loses (proven) and is tempting (its twin in sight)
  const s0 = E.start(g), trapRes = [];
  for (const [x, y] of plan.traps) {
    if (Date.now() > deadline) { trapRes.push({ x, y, result: 'unknown' }); continue; }
    const kind = E.kindOf(g, s0, x), s1 = E.step(g, s0, x);
    const r = s1 ? E.winnable(g, s1, { nodes: 60000, ms: 400 }).result : 'lose';
    trapRes.push({ x, y, kind, result: r });
  }
  const trapsProven = trapRes.filter(t => t.result === 'lose' && t.kind === 'pair').length;
  const luckTarget = luckTargetOf(brief, cap);
  // keys in sight: how many show as keys at the start, and after how many moves of the way both have shown
  let keysShown = null, keysRevealAt = null;
  if (roles.locks.size && roles.keys.length) {
    const shownNow = alive => tileVisibility(c.tiles, { alive, down: new Uint8Array(c.n), openPeek: -1 }, null).tiles;
    const isShown = (v, k) => v[k].role && !(roles.ice[k] > 0);
    const al = new Uint8Array(c.n).fill(1);
    keysShown = roles.keys.filter(k => isShown(shownNow(al), k)).length;
    for (let m = 0; m <= clockAt; m++) {
      const v = shownNow(al);
      if (roles.keys.every(k => !al[k] || isShown(v, k))) { keysRevealAt = m; break; }
      al[sol[m]] = 0;
    }
  }
  const n = c.n, busy = Math.min(2, cap), firstBusy = busy >= 2 ? tray.firstTwo : tray.firstOne, calmHalf = firstBusy < 0 || firstBusy >= n / 2;
  const intents = [
    { name: 'witness valid (' + (rep.pairs ? 'uses ' + rep.pairs + ' peek pair' + (rep.pairs > 1 ? 's' : '') : 'strict rules') + ')', proven: true, detail: witness + ' way' },
    { name: 'honest clock: real fewest moves ' + way.k + ' + spare ' + spare, proven: true },
    { name: 'no idle lock or ice', proven: true, detail: pruned.length ? 'taken off: ' + pruned.join(', ') : 'none idle' },
    { name: 'tray reaches exactly ' + cap + ' on the fewest way to the clock', proven: tray.max === cap, detail: 'max ' + tray.max + ', moves with 3 waiting ' + tray.three +
      '; forced on every way in time: ' + (forced === 'no' ? 'yes' : forced === 'yes' ? 'no (a careful order keeps ' + (cap - 1) + ')' : forced === 'skip' ? 'not asked' : 'unresolved') },
    ...(hold.holders ? [{ name: 'partners held back at the clock (' + story.spec.coverPartners + ')', proven: heldBack >= holdersNeeded(story, plan.dig.orphans),
      detail: heldBack + ' of ' + hold.holders.size + ' holders out of reach, each holding the twin of a tile waiting at the clock' }] : []),
    { name: 'luck moments on the way: ' + luckTarget + ' (within 1)' + (cap < 3 && (brief.targets?.luck ?? brief.targets?.hiddenOnWay) ? ' (none possible: the tray never reaches 3)' : ''), proven: Math.abs(tray.luck - luckTarget) <= 1,
      detail: tray.luck + ' face-down tile' + (tray.luck === 1 ? '' : 's') + ' uncovered while 2+ wait (planned ' + pick.luckPlanned + ')' },
    ...(brief.targets?.keysShown != null && keysShown != null ? [{ name: 'keys showing at the start: ' + brief.targets.keysShown, proven: keysShown === brief.targets.keysShown,
      detail: keysShown + ' of 2 show; both seen after ' + keysRevealAt + ' moves of the way' }] : []),
    ...(brief.frame?.way != null ? [{ name: 'way to the clock: ' + brief.frame.way + ' moves (within 1)', proven: Math.abs(way.k - brief.frame.way) <= 1, detail: 'fewest ' + way.k }] : []),
    ...(brief.targets?.three != null ? [{ name: 'moves with 3 waiting on the way: ' + brief.targets.three + ' (within 1)', proven: Math.abs(tray.three - brief.targets.three) <= 1, detail: 'measured ' + tray.three }] : []),
    ...(brief.targets?.hiddenOnWay != null ? [{ name: 'at least ' + brief.targets.hiddenOnWay + ' face-down tiles on the dig', proven: down.filter(i => P.includes(i)).length >= brief.targets.hiddenOnWay,
      detail: 'measured ' + down.filter(i => P.includes(i)).length }] : []),
    // Dennis's readability rule, as the factory checks it (placement_score.readable): the goal of each phase in
    // sight, at most one face-down tile on the way, no face-down clock, key or lock. Task 10's pilot failed it.
    { name: 'readable objective (clock, keys, locks and the way in sight)', proven: readableOf(design) },
    { name: 'face-down share within maximum', proven: down.length <= Math.round((brief.targets?.maxDown ?? 0.3) * n), detail: down.length + ' of ' + n },
    ...(brief.targets?.traps != null ? [{ name: 'at least ' + brief.targets.traps + ' proven decision traps', proven: trapsProven >= brief.targets.traps, detail: 'proven ' + trapsProven + ' of ' + plan.traps.length + ' designed' }] : []),
    // a designed trap that the engine cannot prove lost is not claimed (card.traps.designed vs .tempting)
    ...(trapsProven ? [{ name: 'decision trap: a free pair in sight that loses', proven: true,
      detail: trapRes.map(t => `${t.x}+${t.y}: ${t.result}${t.kind ? ' (' + t.kind + ')' : ''}`).join('; ') }] : []),
    { name: 'no free cruising: the clock not in the last third, the tray busy in the first half', proven: clockAt < (2 * n) / 3 && !calmHalf,
      detail: `clock at move ${clockAt + 1} of ${n}; ${busy} waiting first at move ${firstBusy + 1}` },
  ];
  const card = {
    story: story.title, sentence: story.sentence, shape: brief.shape || null, tiles: c.n, stage: brief.stage || null,
    clock: { tile: roles.clock, depth: c.above[roles.clock].size, fewestMoves: way.k, strictMoves: null, spare, n: clock.n, locked: roles.locks.has(roles.clock), ice: roles.ice[roles.clock] || 0, at: clockAt + 1 },
    keys: roles.locks.size ? roles.keys.map(k => ({ tile: k, cover: c.above[k].size, ice: roles.ice[k] || 0, otherPeak: c.peak[k] >= 0 && c.peak[k] !== c.peak[roles.clock] })) : [],
    keysShown, keysRevealAt,
    locks: roles.locks.size, iceTiles: Object.keys(roles.ice).length, dig: P.length, necessary: N.size, trayCap: cap,
    tray: { ...tray, forced: forced === 'no' ? cap : null, forcedProof: forced }, orphans: plan.dig.orphans, faceDown: down.length, faceDownOnDig: down.filter(i => P.includes(i)).length,
    traps: { points: trapsProven ? 1 : 0, tempting: trapsProven, designed: plan.traps.length, pairs: plan.traps }, witness,
    bites: [
      `The clock needs ${way.k} moves and gets ${clock.n}: ${spare} to spare.`,
      ...(keysShown != null ? [keysShown === 2 ? 'Both keys are in sight from the start.' : `${2 - keysShown} key${keysShown === 1 ? ' is' : 's are'} hidden at the start; both show after ${keysRevealAt} moves of the way.`] : []),
      ...(forced === 'no' ? [`${plan.dig.orphans.length} tile${plan.dig.orphans.length > 1 ? 's' : ''} you must take on the way wait in the tray until after the clock: whatever the order, the tray reaches ${cap}.`] : []),
      `On the way the tray fills to ${tray.max}` + (tray.three ? `, ${tray.three} move${tray.three > 1 ? 's' : ''} with 3 waiting.` : '.'),
      ...(tray.luck ? [`${tray.luck} dig${tray.luck > 1 ? 's' : ''} uncover a face-down tile while 2 wait (luck).`] : []),
      ...(trapsProven ? [`A free pair in sight from the start is a trap: taking it spends the spare move${trapsProven > 1 ? ' (' + trapsProven + ' such pairs)' : ''}.`] : []),
      ...(hold.holders ? [`The twins of the tiles on the way are ${story.spec.coverPartners} until after the clock.`] : []),
    ],
  };
  const score = (forced === 'no' ? 100 : 0) + intents.filter(i => i.proven).length * 5 + tray.three;
  const allProven = intents.every(i => i.proven);
  return { design, card, intents, roles: { clock: roles.clock, locks: [...roles.locks], keys: roles.keys, ice: roles.ice }, score: score + (allProven ? 1000 : 0), allProven, forcedOk: forced === 'no' || cap <= 1 };
}
// does a story fit a layout at all? Islands need two peaks, and the story's roles must be placeable (keys buried in
// the other island, frozen keys with guards, ...): placeRoles with a few fixed seeds (geometry only, no engine).
const CTX = new WeakMap(), FITS = new WeakMap();
const ctxOf = tiles => { if (!CTX.has(tiles)) CTX.set(tiles, context(tiles)); return CTX.get(tiles); };
function fits(storyId, tiles, brief = {}) {
  const story = STORIES[storyId]; if (!story) return false;
  const plain = !brief.frame && !brief.stage;
  if (plain && FITS.has(tiles) && FITS.get(tiles)[storyId] !== undefined) return FITS.get(tiles)[storyId];
  const c = ctxOf(tiles); let ok = false;
  if (story.needs !== 'islands' || c.peaks >= 2) for (let s = 1; s <= 8 && !ok; s++) ok = !placeRoles(c, story, { targets: {}, ...brief }, rngOf(s * 7919)).fail;
  if (plain) { if (!FITS.has(tiles)) FITS.set(tiles, {}); FITS.get(tiles)[storyId] = ok; }
  return ok;
}
module.exports = { build, fits, context, placeRoles, planDig, needSet, placePictures, chooseHolders, coveredDuringDig, necessary, canReachWithin, trayOnWay, LAYOUTS, STORIES };
