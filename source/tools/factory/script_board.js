/* Level factory: a whole board designed from a tray script instead of a random deal (Claude, 2026-11-03).
   Dennis: "Can the whole board get designed first instead of being a random deal?" - "Yes".
   1. The way through is planned first: an order of taking the tiles, each free when it is taken (top tiles first, with
      some randomness so boards differ).
   2. The pictures are placed along that way after a tray script: in a calm stretch a tile's twin comes right after it
      (the tray stays at 0-1), under pressure twins are kept apart (the tray builds to 2-3, never a 4th), in a relief
      stretch the waiting tiles get their twins (the tray empties). The way is a real way through by construction.
   3. Face-down tiles only at planned digs: a covered tile that the way uncovers during a pressure stretch (a luck
      moment), each pressure stretch followed by relief, so relief moments >= luck moments - 2 holds by design.
   The specials (clock, locks, ice) are then placed by the trap concepts on this way (design_traps.js), and the bots
   check and steer as for any board.
     const { scriptedDeal } = require('./script_board.js'); scriptedDeal(d0, script, rng) -> board or null
   script: [{kind: 'calm'|'pressure'|'relief', share: 0..1}, ...] (shares of the way, in order); default: calm 20%,
   pressure 15%, relief 10%, calm 15%, pressure 15%, relief 10%, calm 15%.                                              */
'use strict';
const L = global.Layouts || require('../../www/layouts.js');
const DEFAULT = [['calm', 0.2], ['pressure', 0.15], ['relief', 0.1], ['calm', 0.15], ['pressure', 0.15], ['relief', 0.1], ['calm', 0.15]].map(([kind, share]) => ({ kind, share }));
const LUCK_PER_PRESSURE = 2;

// d0: a deal of the same pile (Hard.makeNow) - its picture set, gold and amount of face-down tiles are kept
function scriptedDeal(d0, script = DEFAULT, rng = Math.random) {
  const tiles = d0.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t), n = tiles.length;
  if (n % 2) return null;
  const nb = L.neighbors(tiles);
  // 1. the way through: free tiles, higher ones first, a little randomness
  const alive = new Uint8Array(n).fill(1), order = [], uncoverAt = new Array(n).fill(-1);
  for (let k = 0; k < n; k++) {
    const free = []; for (let i = 0; i < n; i++) if (alive[i] && L.isFree(i, alive, nb)) free.push(i);
    if (!free.length) return null;
    for (const i of free) if (uncoverAt[i] < 0) uncoverAt[i] = k;          // the step at which tile i became free
    free.sort((a, b) => (tiles[b].z - tiles[a].z) + (rng() - 0.5) * 1.5);
    const i = free[0]; alive[i] = 0; order.push(i);
  }
  // the script per step
  const kindAt = []; let k = 0;
  for (const s of script) { const m = Math.round(s.share * n); for (let j = 0; j < m && k < n; j++, k++) kindAt.push(s.kind); }
  while (kindAt.length < n) kindAt.push('calm');
  // 2. pictures along the way: open (a new picture waits) or close (the oldest waiting gets its twin); the pairs come
  // from the deal's own picture set, never a picture that is already waiting
  const cnt = new Map(); for (const f of d0.faces) cnt.set(f, (cnt.get(f) || 0) + 1);
  const pairs = []; for (const [f, c] of cnt) for (let j = 0; j < c / 2; j++) pairs.push(f);
  for (let j = pairs.length - 1; j > 0; j--) { const r = Math.floor(rng() * (j + 1)); [pairs[j], pairs[r]] = [pairs[r], pairs[j]]; }
  const faces = new Array(n).fill(-1), open = [], trayAt = [];
  const want = kind => kind === 'calm' ? (rng() < 0.3 ? 2 : 1) : kind === 'pressure' ? 3 : 0;
  // under pressure a waiting tile's twin is a tile that was still covered when it was taken (no pair in sight); in a
  // calm stretch the twin was already free (an easy pair)
  const openAt = new Array(n).fill(-1);
  for (let s = 0; s < n; s++) {
    const left = n - s, i = order[s];
    const mustClose = open.length && (open.length >= left || open.length >= 3);
    const hidden = open.filter(o => openAt[o] < uncoverAt[i]), seen = open.filter(o => openAt[o] >= uncoverAt[i]);
    const fit = kindAt[s] === 'pressure' ? hidden : kindAt[s] === 'calm' ? (seen.length ? seen : open) : open;
    const close = open.length && (mustClose || (open.length >= want(kindAt[s]) && fit.length) || (kindAt[s] !== 'pressure' && open.length >= want(kindAt[s])));
    if (close) { const o = (fit.length ? fit : open)[0]; open.splice(open.indexOf(o), 1); faces[i] = faces[o]; }
    else {
      const q = pairs.findIndex(f => !open.some(o => faces[o] === f)); if (q < 0) return null;
      faces[i] = pairs.splice(q, 1)[0]; open.push(i); openAt[i] = s;
    }
    trayAt.push(open.length);
  }
  if (open.length) return null;
  // 3. face-down tiles: covered at the start, and uncovered by the way when the tray is calm - a player turns them
  // over when they come free; under pressure only the planned digs (luck moments, 2 per pressure stretch)
  const down = [], want0 = (d0.down || []).length, dig = [];
  let luckLeft = 0;
  for (let s = 0; s < n; s++) {
    if (kindAt[s] === 'pressure' && (s === 0 || kindAt[s - 1] !== 'pressure')) luckLeft = LUCK_PER_PRESSURE;
    const now = order.filter(j => uncoverAt[j] === s + 1);               // tiles this take uncovers
    for (const j of now) {
      if (kindAt[s] === 'pressure' && trayAt[s] >= 2) { if (luckLeft > 0) { dig.push(j); luckLeft--; } }
      else if (trayAt[s] <= 1) down.push(j);
    }
  }
  for (let j = down.length - 1; j > 0; j--) { const r = Math.floor(rng() * (j + 1)); [down[j], down[r]] = [down[r], down[j]]; }
  const downAll = [...dig, ...down.slice(0, Math.max(0, want0 - dig.length))];
  return { v: d0.v, level: d0.level, aspect: d0.aspect, scale: d0.scale, tiles: d0.tiles, faces, down: downAll, gold: (d0.gold || []).slice(), obst: { ice: {}, locks: [], keys: [] }, clock: null, solution: order,
    info: { ...(d0.info || {}), scripted: kindAt.map(x => x[0]).join(''), trayAt: trayAt.join(''), digs: dig } };
}
/* rescript(z, opt, rng): the pictures of a board WITH its traps placed again after a script along its own way through
   (z.solution, which already respects the clock, ice and locks). A bare scripted board is still easy (family bot
   about 1 try on 4 piles, the same as a random deal): with ~10 free tiles a player is never bound to one way. The
   clock binds: the way to it is the pressure stretch (its twins still covered when you must take it), relief right
   after; opt.mid adds a second pressure stretch (with its relief) in the middle. The pictures of keys, locks and ice
   tiles (all copies) stay as they are, so the traps keep working. opt.press: how many may wait under pressure (2-3),
   a knob for the steering. Returns a board (clock.n to be set again by I.fix) or null.                              */
function rescript(z, opt = {}, rng = Math.random) {
  const press = opt.press || 3, mid = opt.mid || 0, n = z.tiles.length, order = z.solution;
  const tiles = z.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t), nb = L.neighbors(tiles);
  const o = z.obst || {}, keep = new Set([...(o.keys || []), ...(o.locks || []), ...Object.keys(o.ice || {}).map(Number)].map(i => z.faces[i]));
  const fixed = i => keep.has(z.faces[i]);
  // when each tile comes free along the way (shape only)
  const alive = new Uint8Array(n).fill(1), uncoverAt = new Array(n).fill(-1);
  for (let s = 0; s < n; s++) { for (let i = 0; i < n; i++) if (uncoverAt[i] < 0 && L.isFree(i, alive, nb)) uncoverAt[i] = s; alive[order[s]] = 0; }
  // the script: the way to the clock under pressure, relief after it, calm; opt.mid: a second pressure stretch
  const route = z.clock ? order.indexOf(z.clock.i) + 1 : 0, kindAt = new Array(n).fill('calm');
  for (let s = 0; s < route; s++) kindAt[s] = 'pressure';
  for (let s = route; s < Math.min(n, route + 6); s++) kindAt[s] = 'relief';
  if (mid) { const a = Math.max(route + 12, Math.floor(n * 0.45)), b = Math.min(n - 8, a + mid); for (let s = a; s < b; s++) kindAt[s] = 'pressure'; for (let s = b; s < Math.min(n, b + 6); s++) kindAt[s] = 'relief'; }
  // the fixed pictures' own tray along the way, and how many free steps follow
  const fixedOpen = new Array(n).fill(0), fo = new Map();
  for (let s = 0; s < n; s++) { const i = order[s]; if (fixed(i)) { const f = z.faces[i]; fo.set(f, (fo.get(f) || 0) ^ 1); } fixedOpen[s] = [...fo.values()].reduce((a, b) => a + b, 0); }
  const freeLeft = new Array(n + 1).fill(0); for (let s = n - 1; s >= 0; s--) freeLeft[s] = freeLeft[s + 1] + (fixed(order[s]) ? 0 : 1);
  // cap[s]: most free pictures that may wait after step s so the tray never reaches 4 later (each free step can close one)
  const cap = new Array(n).fill(3);
  for (let s = n - 1; s >= 0; s--) cap[s] = Math.min(3 - fixedOpen[s], s + 1 < n ? cap[s + 1] + (fixed(order[s + 1]) ? 0 : 1) : 0);
  const cnt = new Map(); for (let s = 0; s < n; s++) if (!fixed(order[s])) { const f = z.faces[order[s]]; cnt.set(f, (cnt.get(f) || 0) + 1); }
  const pairs = []; for (const [f, c] of cnt) for (let j = 0; j < c / 2; j++) pairs.push(f);
  for (let j = pairs.length - 1; j > 0; j--) { const r = Math.floor(rng() * (j + 1)); [pairs[j], pairs[r]] = [pairs[r], pairs[j]]; }
  const faces = z.faces.slice(), open = [], openAt = new Array(n).fill(-1);
  const want = kind => kind === 'calm' ? (rng() < 0.3 ? 2 : 1) : kind === 'pressure' ? press : 0;
  for (let s = 0; s < n; s++) {
    const i = order[s]; if (fixed(i)) continue;
    const room = Math.min(cap[s], freeLeft[s + 1]);                 // free pictures that may still wait after this step
    const hidden = open.filter(q => openAt[q] < uncoverAt[i]), seen = open.filter(q => openAt[q] >= uncoverAt[i]);
    const fit = kindAt[s] === 'pressure' ? hidden : kindAt[s] === 'calm' ? (seen.length ? seen : open) : open;
    const mustClose = open.length && open.length + 1 > room;
    const close = open.length && (mustClose || (open.length + Math.max(0, fixedOpen[s]) >= want(kindAt[s]) && (fit.length || kindAt[s] !== 'pressure')));
    if (close) { const q = (fit.length ? fit : open)[0]; open.splice(open.indexOf(q), 1); faces[i] = faces[q]; }
    else {
      if (open.length + 1 > room) return null;
      const k = pairs.findIndex(f => !open.some(q => faces[q] === f) && !(fo0(f))); if (k < 0) return null;
      faces[i] = pairs.splice(k, 1)[0]; open.push(i); openAt[i] = s;
    }
  }
  function fo0(f) { return keep.has(f); }
  if (open.length) return null;
  return { ...z, faces, info: { ...(z.info || {}), rescript: { press, mid, script: kindAt.map(x => x[0]).join('') } } };
}
/* squeeze(z, opt, rng): rescript() made 175 EASIER (family 7.05 -> 3.4-3.8): under pressure a player matches
   elsewhere on the board, and the calm stretches had put easy pairs there. So the pressure is set on the WHOLE board:
   while the way goes to the clock, as few pairs as possible are free anywhere (the tiles free at each of those steps);
   right after the clock (opt.relief steps) as many as possible. The rest stays the random deal. Pictures are swapped
   between tiles (never keys, locks or ice pictures); a swap is kept only if the way through still never holds 4.
   opt.strength 0..1: the share of the possible squeeze used (a knob for the steering).                               */
function squeeze(z, opt = {}, rng = Math.random) {
  const strength = opt.strength == null ? 1 : opt.strength, reliefN = opt.relief == null ? 6 : opt.relief, n = z.tiles.length, order = z.solution;
  if (!z.clock) return null;
  const tiles = z.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t), nb = L.neighbors(tiles);
  const o = z.obst || {}, keepF = new Set([...(o.keys || []), ...(o.locks || []), ...Object.keys(o.ice || {}).map(Number)].map(i => z.faces[i]));
  const route = order.indexOf(z.clock.i) + 1;
  // the free tiles before each step of the way to the clock (pressure) and of the relief after it
  const alive = new Uint8Array(n).fill(1), freeAt = [];
  for (let s = 0; s < Math.min(n, route + reliefN); s++) { const f = []; for (let i = 0; i < n; i++) if (L.isFree(i, alive, nb)) f.push(i); freeAt.push(f); alive[order[s]] = 0; }
  const score = faces => {
    let p = 0;
    for (let s = 0; s < freeAt.length; s++) {
      const c = new Map(); for (const i of freeAt[s]) c.set(faces[i], (c.get(faces[i]) || 0) + 1);
      let pairs = 0; for (const v of c.values()) pairs += v >> 1;
      p += s < route ? pairs : -pairs;
    }
    return p;
  };
  const trayOk = faces => { const t = []; for (const i of order) { const q = t.indexOf(faces[i]); if (q >= 0) t.splice(q, 1); else { t.push(faces[i]); if (t.length >= 4) return false; } } return t.length === 0; };
  const movable = []; for (let i = 0; i < n; i++) if (!keepF.has(z.faces[i])) movable.push(i);
  let faces = z.faces.slice(), cur = score(faces); const s0 = cur;
  for (let it = 0; it < (opt.iters || 4000); it++) {
    const a = movable[Math.floor(rng() * movable.length)], b = movable[Math.floor(rng() * movable.length)];
    if (faces[a] === faces[b]) continue;
    const f2 = faces.slice(); [f2[a], f2[b]] = [f2[b], f2[a]];
    const sc = score(f2); if (sc >= cur || !trayOk(f2)) continue;
    faces = f2; cur = sc;
  }
  // strength < 1: walk back toward the deal until the squeeze is that share of the way
  if (strength < 1) {
    const goal = s0 - (s0 - cur) * strength;
    const diff = movable.filter(i => faces[i] !== z.faces[i]);
    for (let it = 0; it < 4000 && cur < goal; it++) {
      const a = diff[Math.floor(rng() * diff.length)], b = movable[Math.floor(rng() * movable.length)];
      if (faces[a] === faces[b]) continue;
      const f2 = faces.slice(); [f2[a], f2[b]] = [f2[b], f2[a]]; const sc = score(f2);
      if (sc <= cur || sc > goal + 1 || !trayOk(f2)) continue; faces = f2; cur = sc;
    }
  }
  return { ...z, faces, info: { ...(z.info || {}), squeeze: { strength, from: s0, to: cur } } };
}
module.exports = { scriptedDeal, rescript, squeeze, DEFAULT };
