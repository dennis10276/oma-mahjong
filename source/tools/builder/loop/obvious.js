/* obvious.js: which moves a player who reads the board would call "going for the goal" (gate A4, A6).
   Process design section 4, table A (analysis/builder/process-design-synthesis.md). Claude, 2026-11-07.

   A move is obvious at a state when one of these holds, using only what the player can see
   (human_board_visibility.tileVisibility, the same rule the bots use):
     clock    - the clock tile itself;
     blocker  - a tile within `horizon` (default 3) blocker steps of the clock: what lies on it, the cheaper side
                row when it is boxed in, the ice-neighbours it still needs (the "attraction" idea of research/cone.js,
                reimplemented here; cone.js is not touched). When a visible lock sits on that cone, the cone also
                grows from the visible keys;
     key      - a key whose key overlay is in sight (keys still on the board);
     lock     - a lock whose lock overlay is in sight;
     match    - a tile whose picture matches a tile waiting in the tray (a free face-down tile counts: it can be
                turned over at no cost).
   A peek pair {pair:[i,j]} is obvious when either tile is.

     const O = require('./obvious.js');
     O.obviousMoves(g, state, { horizon })   -> Map(tile -> [reason, ...]) for every alive tile that is obvious
     O.isObvious(g, state, move, { horizon }) -> { obvious: bool, reasons: [...] }
     O.visibleRoles(g, state)                 -> role per tile as the player sees it (null hidden; 'none'|'ice'|'ice2'|'lock'|'key')
     O.keysInSight(g, state)                  -> { keys: [..], shown: number of keys whose overlay shows (or already gone) }
   g is an engine game (E.game(design)); state an engine state. Engine only, no bots. */
'use strict';
const L = global.Layouts || (global.Layouts = require('../../../www/layouts.js'));
const { tileVisibility } = require('../../sim/refit/human_board_visibility.js');

function aboveTransOf(g) {
  if (g._aboveTrans) return g._aboveTrans;
  const out = g.tiles.map((_, i) => { const s = new Set(), st = [i]; while (st.length) for (const j of g.nb.above[st.pop()]) if (!s.has(j)) { s.add(j); st.push(j); } return s; });
  return (g._aboveTrans = out);
}
function visibility(g, s) {
  return tileVisibility(g.tiles, { alive: s.alive, down: g.down, openPeek: -1 }, g.clock).tiles;
}
function visibleRoles(g, s, vis = visibility(g, s)) {
  const d = g.design, o = d.obst || {}, ice = o.ice || {}, keys = (o.keys || []), locks = new Set(o.locks || []);
  const keysLeft = keys.length > 0 && locks.size > 0 && keys.some(k => s.alive[k]);
  return vis.map((v, i) => {
    if (!v || !v.role) return null;
    const h = ice[i] || 0;
    if (h > 0) { let gone = 0; for (const j of g.iceNb[i]) if (!s.alive[j]) gone++; const rem = Math.max(0, h - gone); if (rem > 0) return rem > 1 ? 'ice2' : 'ice'; }
    if (keysLeft && locks.has(i)) return 'lock';
    if (keysLeft && keys.includes(i)) return 'key';
    return 'none';
  });
}
function keysInSight(g, s, vis = visibility(g, s)) {
  const o = g.design.obst || {}, keys = (o.locks || []).length ? (o.keys || []) : [];
  const roles = visibleRoles(g, s, vis);
  return { keys, shown: keys.filter(k => !s.alive[k] || roles[k] === 'key').length };
}
// the blocker cone around the clock (and around visible keys when a visible lock sits on it)
function cone(g, s, roles, horizon) {
  const alive = s.alive, nb = g.nb, above = aboveTransOf(g), depth = new Map();
  const sideChain = (i, left) => { const ch = [], seen = new Set([i]); let fr = (left ? nb.left[i] : nb.right[i]).filter(j => alive[j]);
    while (fr.length) { const nx = []; for (const u of fr) { if (seen.has(u)) continue; seen.add(u); ch.push(u); for (const v of (left ? nb.left[u] : nb.right[u])) if (alive[v] && !seen.has(v)) nx.push(v); } fr = nx; } return ch; };
  const chainCost = (i, ch) => { const own = above[i], extra = new Set(); let pen = 0;
    for (const u of ch) { for (const a of above[u]) if (alive[a] && !own.has(a)) extra.add(a); pen += roles[u] === 'lock' ? 2 : roles[u] === 'ice' ? 1 : roles[u] === 'ice2' ? 2 : 0; }
    return ch.length + extra.size + pen; };
  const blockers = i => {
    const top = nb.above[i].filter(j => alive[j]), l = nb.left[i].filter(j => alive[j]), r = nb.right[i].filter(j => alive[j]);
    let side = []; if (l.length && r.length) side = chainCost(i, sideChain(i, true)) <= chainCost(i, sideChain(i, false)) ? l : r;
    const h = roles[i] === 'ice2' ? 2 : roles[i] === 'ice' ? 1 : 0;
    const ice = h ? g.iceNb[i].filter(j => alive[j] && !above[j].has(i)).slice(0, h + 1) : [];
    return [...new Set([...top, ...side, ...ice])];
  };
  const spread = src => { const q = [[src, 0]]; if (!depth.has(src) || depth.get(src) > 0) depth.set(src, 0);
    while (q.length) { const [u, d] = q.shift(); if (d >= horizon) continue; for (const b of blockers(u)) if (!depth.has(b) || depth.get(b) > d + 1) { depth.set(b, d + 1); q.push([b, d + 1]); } } };
  const ck = g.clock && alive[g.clock.i] ? g.clock.i : -1;
  if (ck < 0) return depth;
  spread(ck);
  const lockNear = [...depth.keys()].some(i => roles[i] === 'lock') || [nb.left[ck], nb.right[ck], nb.above[ck]].some(a => a.some(j => alive[j] && roles[j] === 'lock'));
  if (lockNear) for (let k = 0; k < g.n; k++) if (alive[k] && roles[k] === 'key') spread(k);
  return depth;
}
function obviousMoves(g, s, o = {}) {
  const horizon = o.horizon ?? 3, vis = visibility(g, s), roles = visibleRoles(g, s, vis), out = new Map();
  const add = (i, why) => { if (!out.has(i)) out.set(i, []); if (!out.get(i).includes(why)) out.get(i).push(why); };
  const clockOn = g.clock && s.alive[g.clock.i];
  if (clockOn) {
    add(g.clock.i, 'clock');
    for (const [i, d] of cone(g, s, roles, horizon)) if (i !== g.clock.i && d <= horizon) add(i, 'blocker');
  }
  const waiting = new Set(s.tray.map(t => g.faces[t]));
  for (let i = 0; i < g.n; i++) {
    if (!s.alive[i]) continue;
    if (roles[i] === 'key') add(i, 'key');
    if (roles[i] === 'lock') add(i, 'lock');
    // a tray match is visible when the picture shows, or the tile is free (a free face-down tile turns over for free)
    if (waiting.has(g.faces[i]) && (vis[i].picture || L.isFree(i, s.alive, g.nb))) add(i, 'match');
  }
  return out;
}
function isObvious(g, s, move, o = {}) {
  const set = o.set || obviousMoves(g, s, o), tiles = move && typeof move === 'object' ? move.pair : [move];
  const reasons = [...new Set(tiles.flatMap(i => set.get(i) || []))];
  return { obvious: reasons.length > 0, reasons };
}
module.exports = { obviousMoves, isObvious, visibleRoles, keysInSight, visibility, cone };
