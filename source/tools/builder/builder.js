/* Builder v2 (Claude, 2026-11-06): a level built backwards from a brief, not a random deal with traps bolted on.
   Dennis: "Focus on making the builder better before letting it learn." Spec: SPEC.md section 4.

   1. Roles: the story (stories.js) picks the clock, keys, locks and ice on the chosen shape (geometry only).
   2. The way: the tiles the clock needs, worked back from the clock (its cover, the keys of any lock met, the
      cheapest neighbours of any ice, sides when a tile is boxed in), taken in a legal order: that is the dig P.
      The rest of the board Q follows in a legal order that first reaches the tiles holding the waiting twins.
   3. Pictures along that way: during the dig every new picture waits (its twin lies under tiles the dig does not
      touch) until the tray holds `cap` = 3 - trayRoom; then the next dig tile must close one. After the clock the
      waiting twins come free first (relief), then calm pairs. The way is a real solution by construction.
   4. Face-down tiles, tempting pairs, then the clock: n = exact fewest moves + spare.
   5. Proofs: solution valid, honest clock, every special changes the way (ablation), luck rule; engine.js (when
      present) adds decision-trap proofs.
     const { build } = require('./builder.js'); build(brief, opts) -> { design, card, intents, ms } | { fail, detail }
*/
'use strict';
const path = require('path'), fs = require('fs');
const L = global.Layouts || (global.Layouts = require('../../www/layouts.js'));
const Hard = require('../../www/hard.js');
const { exactRoute } = require('../lab/exact.js');
const { STORIES } = require('./stories.js');
let Engine = null; try { Engine = require('./engine.js'); } catch (e) { Engine = null; }

const LAYOUTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'layouts.json'), 'utf8'));
const rngOf = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296; };
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const shuffle = (rng, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the shape and what blocks what ----------
function context(tilesIn) {
  const tiles = tilesIn.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t), n = tiles.length;
  const nb = L.neighbors(tiles), inb = L.iceNeighbors(tiles);
  const above = tiles.map((_, i) => { const s = new Set(), todo = [i]; while (todo.length) for (const j of nb.above[todo.pop()]) if (!s.has(j)) { s.add(j); todo.push(j); } return s; });
  const all = new Uint8Array(n).fill(1), free0 = tiles.map((_, i) => L.isFree(i, all, nb));
  // islands: footprints that touch (within one tile) belong together
  const comp = new Array(n).fill(-1); let nc = 0;
  for (let i = 0; i < n; i++) if (comp[i] < 0) { const todo = [i]; comp[i] = nc; while (todo.length) { const a = tiles[todo.pop()];
    for (let j = 0; j < n; j++) if (comp[j] < 0 && Math.abs(tiles[j].x - a.x) <= 2 && Math.abs(tiles[j].y - a.y) <= 2) { comp[j] = nc; todo.push(j); } } nc++; }
  const cx = tiles.reduce((s, t) => s + t.x, 0) / n, cy = tiles.reduce((s, t) => s + t.y, 0) / n;
  const dist = (i, j) => Math.hypot(tiles[i].x - tiles[j].x, (tiles[i].y - tiles[j].y) * 0.8);
  const centre = i => Math.hypot(tiles[i].x - cx, (tiles[i].y - cy) * 0.8);
  const maxZ = Math.max(...tiles.map(t => t.z));
  return { tiles, n, nb, inb, above, free0, comp, islands: nc, dist, centre, maxZ };
}

// ---------- 1. roles ----------
function placeRoles(c, story, brief, rng) {
  const s = story.spec, depth = brief.frame?.depth != null ? [brief.frame.depth, brief.frame.depth] : (s.clockDepth || [0, 2]);
  const inRange = (v, [a, b]) => v >= a && v <= b;
  let clocks = [];
  for (let i = 0; i < c.n; i++) if (inRange(c.above[i].size, depth)) clocks.push(i);
  if (s.clockIce) clocks = clocks.filter(i => c.inb[i].length >= s.clockIce + 1);
  if (brief.stage === 'centre') clocks.sort((a, b) => c.centre(a) - c.centre(b));
  else if (brief.stage === 'edge') clocks.sort((a, b) => c.centre(b) - c.centre(a));
  else if (brief.stage === 'top') clocks = clocks.filter(i => c.tiles[i].z === c.maxZ).concat(clocks.filter(i => c.tiles[i].z !== c.maxZ));
  else clocks = shuffle(rng, clocks);
  if (story.needs === 'islands' && c.islands < 2) return { fail: 'needsIslands' };
  for (const ck of clocks.slice(0, 12)) {
    const roles = { clock: ck, locks: new Set(), keys: [], ice: {} , notes: [] };
    if (s.clockIce) roles.ice[ck] = s.clockIce;
    if (s.clockLock) roles.locks.add(ck);
    if (s.coverLock) { const cov = [...c.above[ck]].sort((a, b) => c.tiles[b].z - c.tiles[a].z); if (cov.length < s.coverLock) continue; cov.slice(0, s.coverLock).forEach(i => roles.locks.add(i)); }
    if (s.lockIceNeighbours && s.clockIce) {
      // lock neighbours until fewer than h unlocked ones remain: the thaw needs the keys
      const nbs = shuffle(rng, c.inb[ck].filter(j => !c.above[ck].has(j)));
      const need = c.inb[ck].length - (s.clockIce - 1);
      let k = 0; for (const j of nbs) { if (k >= need) break; roles.locks.add(j); k++; }
      if (k < need) { const rest = c.inb[ck].filter(j => !roles.locks.has(j)); for (const j of rest) { if (k >= need) break; roles.locks.add(j); k++; } }
    }
    const needKeys = roles.locks.size > 0 || s.coverPartners === 'locked';
    if (needKeys) {
      const kc = s.keyCover || [1, 3], used = new Set([ck, ...roles.locks, ...c.above[ck]]);
      let cands = [];
      for (let i = 0; i < c.n; i++) if (!used.has(i) && inRange(c.above[i].size, kc) && ![...roles.locks].some(l => c.above[l].has(i))) cands.push(i);
      if (s.keys === 'island') cands = cands.filter(i => c.comp[i] !== c.comp[ck]);
      if (s.keys === 'far' || s.keys === 'island') cands.sort((a, b) => c.dist(b, ck) - c.dist(a, ck));
      else if (s.keys === 'deep') cands.sort((a, b) => c.above[b].size - c.above[a].size || c.dist(b, ck) - c.dist(a, ck));
      else cands.sort((a, b) => c.dist(a, ck) - c.dist(b, ck));
      cands = cands.slice(0, 16);
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

// ---------- 2. the way ----------
const rulesOf = (c, roles) => ({ iceNb: c.inb, ice: roles.ice, locks: roles.locks.size ? roles.locks : null, keys: roles.keys });
// the tiles the clock still needs, worked back as a person does
function needSet(c, roles, alive) {
  const need = new Set(), todo = [roles.clock], all = new Uint8Array(c.n).fill(1);
  const add = u => { if (alive[u] && !need.has(u)) { need.add(u); todo.push(u); } };
  need.add(roles.clock);
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
      const blocked = [...need].filter(i => [...c.above[i]].every(a => !alive[a]));
      let side = null;
      for (const i of blocked) for (const dir of ['left', 'right']) {
        const chain = []; let cur = [i], ok = true;
        while (cur.length) { const nxt = []; for (const t of cur) for (const j of c.nb[dir][t]) if (alive[j]) { chain.push(j); nxt.push(j); } cur = nxt; if (chain.length > 8) { ok = false; break; } }
        const end = chain.filter(j => can(j));
        if (ok && end.length && (!side || chain.length < side.cost)) side = { cost: chain.length, tile: end[0] };
      }
      if (!side) return null;
      ready = [side.tile];
    }
    // the keys before anything else, then the deepest prerequisite first, a little randomness
    const score = i => (roles.keys.includes(i) ? 100 : 0) + (i === roles.clock ? -100 : 0) + c.tiles[i].z + rng() * 0.5;
    ready.sort((a, b) => score(b) - score(a));
    const i = ready[0]; alive[i] = 0; P.push(i);
  }
  return null;
}
function planRest(c, roles, P, wanted, rng) {
  const alive = new Uint8Array(c.n).fill(1), all = alive.slice(), rules = rulesOf(c, roles), Q = [];
  for (const i of P) alive[i] = 0;
  const can = i => L.takeable(i, alive, c.nb, rules, all);
  for (let left = c.n - P.length; left > 0; left--) {
    const ready = []; for (let i = 0; i < c.n; i++) if (alive[i] && can(i)) ready.push(i);
    if (!ready.length) return null;
    // first the wanted tiles (they will hold the waiting twins), then what uncovers them, then the rest
    const score = i => (wanted.has(i) ? 3 : 0) + ([...wanted].some(w => alive[w] && c.above[w].has(i)) ? 2 : 0) + rng();
    ready.sort((a, b) => score(b) - score(a));
    const i = ready[0]; alive[i] = 0; Q.push(i);
  }
  return Q;
}

// ---------- 3. pictures ----------
function placePictures(c, roles, P, brief, rng) {
  const cap = Math.max(1, Math.min(3, 3 - (brief.targets?.trayRoom ?? 1)));
  // tiles that stay covered for the whole dig: only those may hold the twin of a dig tile
  const alive = new Uint8Array(c.n).fill(1), coveredAll = new Uint8Array(c.n).fill(1);
  for (let k = 0; k <= P.length; k++) {
    for (let i = 0; i < c.n; i++) if (alive[i] && coveredAll[i] && L.isFree(i, alive, c.nb)) coveredAll[i] = 0;
    if (k < P.length) alive[P[k]] = 0;
  }
  const inP = new Set(P);
  const wanted = new Set(); for (let i = 0; i < c.n; i++) if (!inP.has(i) && coveredAll[i]) wanted.add(i);
  const Q = planRest(c, roles, P, wanted, rng); if (!Q) return { fail: 'restOrder' };
  const W = P.concat(Q), pos = new Array(c.n); W.forEach((t, k) => pos[t] = k);
  const pairOf = new Array(c.n).fill(-1), open = [];          // open: tiles waiting, in order
  const keyA = roles.keys[0], keyB = roles.keys[1];
  const closeWith = (t, o) => { pairOf[t] = o; pairOf[o] = t; open.splice(open.indexOf(o), 1); };
  for (let k = 0; k < W.length; k++) {
    const t = W[k], inDig = k < P.length, left = W.length - k;
    if (t === keyB && pairOf[keyA] === -1) { closeWith(t, keyA); continue; }  // the keys are one pair
    if (t === keyA) { open.push(t); continue; }
    const digOpen = open.filter(o => pos[o] < P.length);
    // which open tiles may this one close?
    const closable = open.filter(o => o !== keyA && (inDig ? true : (pos[o] >= P.length || coveredAll[t])));
    const mustClose = open.length >= 3 || open.length >= left - (open.includes(keyA) ? 1 : 0);
    let close = false;
    if (inDig) close = open.length >= cap || mustClose;
    else {
      // after the clock: relief first (the dig's waiting tiles close as their twins come free), then calm
      if (closable.some(o => pos[o] < P.length)) close = true;
      else close = mustClose || (open.length >= 2) || (open.length >= 1 && rng() < 0.55);
    }
    if (close && closable.length) {
      // in the dig close the oldest dig tile; after it prefer the dig's waiting tiles
      const o = (inDig ? closable : closable.filter(o => pos[o] < P.length).concat(closable.filter(o => pos[o] >= P.length)))[0];
      closeWith(t, o);
    } else {
      if (open.length >= 3) return { fail: 'trayOverflow' };
      // a dig tile may only open when a covered-all-dig tile is left to take its twin later
      open.push(t);
    }
  }
  if (open.length) return { fail: 'unpaired' };
  // the dig tiles' twins must lie on tiles covered during the whole dig (no shortcut relief)
  for (const t of P) { const u = pairOf[t]; if (u >= 0 && !inP.has(u) && !coveredAll[u] && pos[u] < P.length + 4 && t !== roles.clock) {} }
  // pairs -> pictures: 36 pictures, a picture twice (4 tiles) only for calm pairs late in the way
  const pairs = []; const seen = new Set();
  for (const t of W) if (!seen.has(t)) { seen.add(t); seen.add(pairOf[t]); pairs.push([t, pairOf[t]]); }
  const faces = new Array(c.n).fill(-1), order = shuffle(rng, [...Array(36).keys()]);
  const late = pairs.map((p, k) => k).filter(k => Math.min(pos[pairs[k][0]], pos[pairs[k][1]]) > P.length + 6);
  const doubles = Math.max(0, pairs.length - 36);
  if (late.length < doubles * 2) return { fail: 'tooFewLatePairs' };
  const lateSet = new Set(shuffle(rng, late).slice(0, doubles * 2));
  let f = 0; const lateFaces = [];
  pairs.forEach((p, k) => { if (lateSet.has(k)) return; const face = order[f++ % 36]; faces[p[0]] = faces[p[1]] = face; });
  // the doubled pictures: reuse faces of other late pairs whose tiles never wait at the same time
  const lateList = [...lateSet];
  for (let k = 0; k < lateList.length; k += 2) { const face = order[(f++) % 36]; for (const q of [lateList[k], lateList[k + 1]]) { faces[pairs[q][0]] = faces[pairs[q][1]] = face; } }
  return { W, P, Q, faces, pairOf, pos, coveredAll, cap };
}

// ---------- 4. face-down tiles and temptations ----------
function placeDown(c, roles, plan, brief, rng) {
  const target = Math.round((brief.targets?.maxDown ?? 0.35) * c.n), onWay = brief.targets?.hiddenOnWay ?? 1;
  const special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const inP = new Set(plan.P);
  const cands = shuffle(rng, [...Array(c.n).keys()].filter(i => !c.free0[i] && !special.has(i)));
  const down = []; let way = 0;
  for (const i of cands) { if (down.length >= target) break; if (inP.has(i)) { if (way >= onWay) continue; way++; } down.push(i); }
  return down;
}
function strictValid(c, roles, design) {
  const g = { tiles: c.tiles, nb: c.nb, faces: design.faces, clock: design.clock, rules: rulesOf(c, roles) };
  return Hard.validSolution(g, design.solution);
}

// ---------- 5. proofs ----------
function clockWay(c, roles, faces, budget) {
  const g = { tiles: c.tiles, nb: c.nb, faces, rules: rulesOf(c, roles) };
  return exactRoute(g, roles.clock, budget?.nodes ?? 200000, budget?.ms ?? 2500);
}
function ablate(c, roles, faces, k0, budget) {
  // each special must change the fewest-moves way to the clock (or be needed for it)
  const out = [];
  const without = (what, r) => { const w = clockWay(c, r, faces, budget); out.push({ name: what, k: w ? w.k : null, matters: !w || w.k < k0 }); };
  for (const l of roles.locks) { const r = { ...roles, locks: new Set([...roles.locks].filter(x => x !== l)) }; if (!r.locks.size) r.keys = roles.keys; without('lock ' + l, r); }
  for (const i of Object.keys(roles.ice).map(Number)) { const ice = { ...roles.ice }; delete ice[i]; without('ice ' + i, { ...roles, ice }); }
  return out;
}

function build(briefIn, opts = {}) {
  const t0 = Date.now(), brief = { targets: {}, ...briefIn };
  const story = STORIES[brief.story]; if (!story) return { fail: 'unknownStory', detail: brief.story, ms: 0 };
  let tiles = brief.tiles;
  if (!tiles) { const lay = LAYOUTS.find(l => l.shape === brief.shape) || LAYOUTS.find(l => l.base === brief.shape); if (!lay) return { fail: 'unknownShape', detail: brief.shape, ms: 0 }; tiles = lay.tiles; }
  const c = context(tiles);
  if (c.n % 2) return { fail: 'oddTiles', ms: 0 };
  const tries = opts.tries ?? 12, budget = opts.budget || { nodes: 200000, ms: 2500 };
  let last = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (Date.now() - t0 > (opts.ms ?? 15000)) break;
    const rng = rngOf((brief.seed ?? 1) * 7919 + attempt * 104729);
    const roles = placeRoles(c, story, brief, rng); if (roles.fail) { last = roles; continue; }
    const P = planDig(c, roles, rng); if (!P) { last = { fail: 'dig' }; continue; }
    const plan = placePictures(c, roles, P, brief, rng); if (plan.fail) { last = plan; continue; }
    const down = placeDown(c, roles, plan, brief, rng);
    const obst = { ice: Object.fromEntries(Object.entries(roles.ice).map(([k, v]) => [+k, v])), locks: [...roles.locks], keys: roles.keys.slice() };
    const way = clockWay(c, roles, plan.faces, budget);
    if (!way) { last = { fail: 'clockWayUnresolved' }; continue; }
    const spare = brief.frame?.spare ?? 1;
    const design = { tiles: c.tiles.map(t => [t.x, t.y, t.z]), faces: plan.faces, down, gold: [], obst, clock: { i: roles.clock, n: way.k + spare }, solution: way.path };
    if (!strictValid(c, roles, design)) { last = { fail: 'invalidSolution' }; continue; }
    const al = new Uint8Array(c.n).fill(1); if (down.some(i => L.isFree(i, al, c.nb))) { last = { fail: 'downFree' }; continue; }
    const abl = ablate(c, roles, plan.faces, way.k, budget);
    const intents = [
      { name: 'solution valid (strict rules)', proven: true },
      { name: 'honest clock: fewest moves ' + way.k + ' + spare ' + spare, proven: true },
      ...abl.map(a => ({ name: a.name + ' matters', proven: a.matters, detail: a.k == null ? 'clock unreachable without it' : 'fewest moves without it: ' + a.k })),
    ];
    const card = {
      story: story.title, sentence: story.sentence, shape: brief.shape || null, tiles: c.n, stage: brief.stage || null,
      clock: { tile: roles.clock, depth: c.above[roles.clock].size, fewestMoves: way.k, spare, locked: roles.locks.has(roles.clock), ice: roles.ice[roles.clock] || 0 },
      keys: roles.keys.map(k => ({ tile: k, cover: c.above[k].size, ice: roles.ice[k] || 0, island: c.comp[k] !== c.comp[roles.clock] })),
      locks: [...roles.locks].length, iceTiles: Object.keys(roles.ice).length, dig: P.length, trayCap: plan.cap, faceDown: down.length, attempt,
    };
    return { design, card, intents, roles: { clock: roles.clock, locks: [...roles.locks], keys: roles.keys, ice: roles.ice }, ms: Date.now() - t0 };
  }
  return { ...(last || { fail: 'noAttempt' }), ms: Date.now() - t0 };
}
module.exports = { build, context, placeRoles, planDig, needSet, placePictures, LAYOUTS, STORIES };
