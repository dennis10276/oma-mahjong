/* Level lab (Dennis, 2026-10-23): "a small test env for you to put your level ideas in so I can play and
   judge them on cleverness of combining the different specials". Makes a handful of ideas: a new pile
   without towers (tiles at least 54 px), the game's designer for pictures and a way through, then the
   specials (ice, lock and keys, face-down tiles, the alarm clock) placed after one idea each, along the
   stored way through so the level can always be finished. Each idea is measured with the frozen observer
   (both personal players) and its clock / face-down tiles nudged towards the difficulty of a level near
   200. Writes tools/lab/lab-ideas.js (LAB_IDEAS) for the lab page (tools/lab/build_lab.js).

     node source/tools/lab/ideas.js [count=8]                                                       */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js'));
global.Layouts = L;
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'analysis', 'levels-before-variety.js'), 'utf8') + ';HARD_LEVELS');
global.RULES = { hard: { rounds: 4, deals: 4, steps: 4 } };
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const { pile, SHAPE_NAMES } = require(path.join(ROOT, 'tools', 'sim', 'variety', 'piles.js'));
const H2 = require(path.join(ROOT, 'tools', 'sim', 'honest', 'hard.js')), L2 = require(path.join(ROOT, 'tools', 'sim', 'honest', 'layouts.js'));
const profiles = require(path.join(ROOT, 'tools', 'sim', 'honest', 'players.json')).bots;
const PLAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis', 'variety-plan.json'), 'utf8'));
const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire'];

// ---------- measuring and checking ----------
const tilesOf = b => b.tiles.map(([x, y, z]) => ({ x, y, z }));
const obsGame = b => { const tiles = tilesOf(b), down = new Uint8Array(tiles.length); b.down.forEach(i => down[i] = 1); const o = b.obst;
  return { tiles, nb: L2.neighbors(tiles), down, faces: b.faces, rules: o ? { iceNb: L2.iceNeighbors(tiles), ice: o.ice || {}, locks: new Set(o.locks || []), keys: o.keys || [] } : null, clock: b.clock }; };
const measure = (b, runs, seed) => { const g = obsGame(b), out = {}; for (const n of NAMES) { const p = { ...H2.P, ...profiles[n].persona }; const r = H2.rateChain(g, runs, seed, p, p.memory, 4); out[n] = { first: r.first, two: r.within[1], four: r.within[3] }; } return out; };
const gameG = b => { const tiles = tilesOf(b), o = b.obst; const rules = o && (Object.keys(o.ice || {}).length || (o.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: o.ice || {}, locks: (o.keys || []).length ? new Set(o.locks) : null, keys: o.keys || [] } : null;
  return { tiles, nb: L.neighbors(tiles), faces: b.faces, rules, clock: b.clock }; };
const valid = b => { const g = gameG(b); if (!Hard.validSolution(g, b.solution)) return false; const al = new Uint8Array(b.tiles.length).fill(1); return b.down.every(i => !L.isFree(i, al, g.nb)); };
const ease = m => 0.5 * m.first + 0.25 * m.two + 0.25 * m.four;
const tilePx = tiles => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; for (const t of tiles) { const x = t.x / 2 - t.z * 0.14, y = t.y / 2 * 1.24 - t.z * 0.14; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + 1.24); } return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16)); };
const towers = t => { const k = new Set(t.map(p => p.x + ',' + p.y + ',' + p.z)); return t.some(p => p.z > 0 && k.has(p.x + ',' + p.y + ',' + (p.z - 1))); };
const clone = b => JSON.parse(JSON.stringify(b));

// a pile without towers, tiles at least 54 px, at most 75% of its spots like any played level (70-157)
const norm = t => { const mx = Math.min(...t.map(a => a[0])), my = Math.min(...t.map(a => a[1])); return t.map(([x, y, z]) => [x - mx, y - my, z]); };
const mir = t => { const w = Math.max(...t.map(a => a[0])); return t.map(([x, y, z]) => [w - x, y, z]); };
const spots = t => [new Set(norm(t).map(a => a.join())), new Set(norm(mir(t)).map(a => a.join()))];
const ov = (a, b) => { let c = 0; for (const k of a) if (b.has(k)) c++; return c / Math.max(a.size, b.size); };
const played = []; for (let lv = 70; lv < 158; lv++) played.push(spots(Hard.get(lv).tiles)[0]);
function newPile(shape, N, layers, seed) {
  let best = null;
  for (const ly of [layers, layers + 1, layers - 1]) for (const bf of [0.34, 0.42, 0.5]) for (const aspect of [1.6, 1.3, 2]) for (const brick of [false, true]) {
    const p = pile({ shape, seed: seed + ly * 7 + Math.round(bf * 100), target: N, layers: ly, aspect, baseFrac: bf, stack: 0, keep: [0.55, 0.8], twin: 0.35, brick });
    if (!p || p.tiles.length !== N || tilePx(p.tiles) < 54 || towers(p.tiles)) continue;
    const s = spots(p.tiles.map(t => [t.x, t.y, t.z]));
    const like = Math.max(...played.map(q => Math.max(ov(s[0], q), ov(s[1], q))));
    if (like > 0.75) continue;
    if (!best || like < best.like) best = { tiles: p.tiles, like };
  }
  return best;
}

// ---------- the way through and who blocks whom ----------
function ctxOf(b) {
  const tiles = tilesOf(b), nb = L.neighbors(tiles), inb = L.iceNeighbors(tiles), P = b.solution, n = tiles.length;
  const pos = new Array(n).fill(1e9); P.forEach((t, k) => pos[t] = k);
  // the pairs as the way through completes them: [a, b, index of the second]
  const tray = [], pairs = [];
  P.forEach((m, k) => { const q = tray.findIndex(t => b.faces[t] === b.faces[m]); if (q >= 0) { pairs.push([tray[q], m, k]); tray.splice(q, 1); } else tray.push(m); });
  const al = new Uint8Array(n).fill(1), free0 = tiles.map((t, i) => L.isFree(i, al, nb));
  const top = tiles.map((t, i) => !nb.above[i].length);
  return { tiles, nb, inb, P, n, pos, pairs, free0, top, midX: (Math.min(...tiles.map(t => t.x)) + Math.max(...tiles.map(t => t.x))) / 2 };
}
const special = (b, i) => (b.gold || []).includes(i) || (b.clock && b.clock.i === i) || (b.obst && ((b.obst.keys || []).includes(i) || (b.obst.locks || []).includes(i) || (b.obst.ice || {})[i]));
const noDown = (b, list) => { b.down = b.down.filter(i => !list.includes(i)); };
const rngOf = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
// ice that still works with the way through: each frozen tile has enough ice-neighbours gone before it
const iceOK = (c, i, h) => c.inb[i].filter(j => c.pos[j] < c.pos[i]).length >= h;

/* ---------- the ideas ----------
   Each takes the designer's board and its way through and places specials after one idea. They return
   null when the pile gives no place for it (another pile is tried). */

// the "room in the tray" ideas: the clock under 3-6 tiles; the partners of those tiles moved (picture swap
// with a buried tile, never onto its own twin) so they are buried elsewhere, and in the variants locked or
// frozen
function trayJuggleIdea(kind, title, idea) {
  return { title, idea, make(b, c) {
    const ok = i => !special(b, i);
    const cks = []; for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 3 && coverOf(c, i).size <= 6) cks.push(i);
    for (const ck of cks.slice(0, 12)) {
      const D = [...coverOf(c, ck)]; if (!D.every(ok)) continue;
      const x = clone(b), f = x.faces, buried = i => coverOf(c, i).size >= 2 && !D.includes(i) && i !== ck && ok(i);
      let fine = true; const partners = [];
      for (const t of D) {
        for (let j = 0; j < c.n; j++) {
          if (j === t || f[j] !== f[t]) continue;
          if (buried(j)) { partners.push(j); continue; }
          // move this partner: swap pictures with a buried tile of another picture
          const s2 = c.P.find(q => buried(q) && f[q] !== f[t] && !D.some(d => f[d] === f[q]) && !partners.includes(q) && !c.nb.above[q].some(a => f[a] === f[t]));
          if (s2 === undefined) { fine = false; break; }
          [f[j], f[s2]] = [f[s2], f[j]]; partners.push(s2);
        }
        if (!fine) break;
      }
      if (!fine || !partners.length) continue;
      x.obst = { ice: Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => ![ck, ...D, ...partners].includes(+i))), locks: [], keys: [] };
      if (kind === 'locked') {
        const byFace = {}; for (let i = 0; i < c.n; i++) if (buried(i) && !partners.includes(i)) (byFace[f[i]] = byFace[f[i]] || []).push(i);
        const kk = Object.values(byFace).find(g => g.length >= 2 && !D.some(d => f[d] === f[g[0]]));
        if (!kk) continue;
        x.obst.locks = partners.slice(0, 6); x.obst.keys = [kk[0], kk[1]];
      } else if (kind === 'frozen') {
        for (const p of partners) if (!c.inb[p].some(q => x.obst.ice[q])) x.obst.ice[p] = 2;
      }
      x.clock = { i: ck, n: 999 }; noDown(x, [ck, ...partners]);
      const y = fix(x); if (y) return y;
    }
    return null;
  } };
}

// move the partners of tile t under other tiles (a picture swap with a buried tile of another picture,
// never onto its own twin); returns the partners, or null
function buryMates(x, c, t, minCover, avoid = []) {
  const f = x.faces, out = [];
  for (let j = 0; j < c.n; j++) {
    if (j === t || f[j] !== f[t]) continue;
    if (coverOf(c, j).size >= minCover && !special(x, j) && !avoid.includes(j)) { out.push(j); continue; }
    const s2 = c.P.find(q => q !== t && f[q] !== f[t] && coverOf(c, q).size >= minCover && !special(x, q) && !avoid.includes(q) && !out.includes(q) && !c.nb.above[q].some(a => f[a] === f[t]));
    if (s2 === undefined) return null;
    [f[j], f[s2]] = [f[s2], f[j]]; out.push(s2);
  }
  return out;
}

const IDEAS = {
  lockedClock: {
    title: 'The clock is locked',
    idea: 'The alarm clock tile itself is locked. Find both keys early enough, or time runs out.',
    make(b, c, r) {
      const L0 = c.P.length, cands = c.P.filter(i => c.pos[i] > L0 * 0.25 && c.pos[i] < L0 * 0.45 && !special(b, i) && c.nb.above[i].length);
      for (const ck of cands) {
        const keys = c.pairs.filter(([a, b2, k]) => k < c.pos[ck] - 2 && k > c.pos[ck] * 0.45 && a !== ck && b2 !== ck && !special(b, a) && !special(b, b2)).pop();
        if (!keys) continue;
        const x = clone(b); const locksExtra = c.P.filter(i => c.pos[i] > keys[2] + 4 && c.top[i] && !special(x, i) && i !== ck && !keys.includes(i)).slice(0, 2);
        x.obst = { ice: Object.fromEntries(Object.entries(x.obst && x.obst.ice || {}).filter(([i]) => ![ck, keys[0], keys[1], ...locksExtra].includes(+i))), locks: [ck, ...locksExtra], keys: [keys[0], keys[1]] };
        x.clock = { i: ck, n: c.pos[ck] + 3 };
        noDown(x, [ck, keys[0], keys[1], ...locksExtra]);
        if (valid(x)) return x;
      }
      return null;
    },
  },
  frozenGuards: {
    title: 'Frozen guards',
    idea: 'The tiles lying on top of the alarm clock are frozen. Thaw them by clearing their neighbours first, in the right order.',
    make(b, c) {
      const L0 = c.P.length;
      for (const ck of c.P.filter(i => c.pos[i] > L0 * 0.3 && c.pos[i] < L0 * 0.55 && !special(b, i))) {
        const guards = c.nb.above[ck].filter(a => !special(b, a));
        if (guards.length < 2) continue;
        const x = clone(b); x.obst = x.obst || { ice: {}, locks: [], keys: [] };
        const ice = Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => !c.nb.above[ck].includes(+i) && +i !== ck));
        let n = 0; for (const g of guards) if (iceOK(c, g, 2) && !(x.obst.locks || []).includes(g) && !(x.obst.keys || []).includes(g)) { ice[g] = 2; n++; } else if (iceOK(c, g, 1)) { ice[g] = 1; n++; }
        if (n < 2) continue;
        x.obst.ice = ice; x.clock = { i: ck, n: c.pos[ck] + 3 };
        noDown(x, [ck, ...guards]);
        if (valid(x)) return x;
      }
      return null;
    },
  },
  keysAcross: {
    title: 'Keys on the far side',
    idea: 'Everything on the left is locked; both keys are on the right, under other tiles. Dig on one side while the tray fills up.',
    make(b, c) {
      const right = i => c.tiles[i].x > c.midX + 1, left = i => c.tiles[i].x < c.midX - 1;
      const keys = c.pairs.filter(([a, b2, k]) => right(a) && right(b2) && (!c.free0[a] || !c.free0[b2]) && k >= 4 && k < c.P.length * 0.3 && !special(b, a) && !special(b, b2))[0];
      if (!keys) return null;
      const locks = c.P.filter(i => left(i) && c.pos[i] > keys[2] && !special(b, i)).sort((p, q) => (c.top[q] - c.top[p]) || (c.pos[p] - c.pos[q])).slice(0, 6);
      if (locks.length < 4) return null;
      const x = clone(b);
      x.obst = { ice: Object.fromEntries(Object.entries(x.obst && x.obst.ice || {}).filter(([i]) => ![...locks, ...keys.slice(0, 2)].includes(+i))), locks, keys: [keys[0], keys[1]] };
      noDown(x, [...locks, keys[0], keys[1]]);
      return valid(x) ? x : null;
    },
  },
  iceChain: {
    title: 'Chain of ice',
    idea: 'A row of frozen tiles that thaw one after another, the last one guarding the alarm clock.',
    make(b, c) {
      for (const s of c.P.slice(4, c.P.length * 0.4)) {
        // a chain s -> t1 -> t2 -> t3, each a side neighbour of the one before, later on the way through
        const chain = [s]; let cur = s;
        for (let k = 0; k < 3; k++) { const nx = c.inb[cur].filter(j => c.tiles[j].z === c.tiles[cur].z && c.pos[j] > c.pos[cur] && !special(b, j) && !chain.includes(j)).sort((p, q) => c.pos[p] - c.pos[q])[0]; if (nx === undefined) break; chain.push(nx); cur = nx; }
        if (chain.length < 4) continue;
        const ck = c.P.find(i => c.pos[i] > c.pos[cur] && c.inb[cur].includes(i) && !special(b, i));
        if (ck === undefined) continue;
        const x = clone(b); x.obst = x.obst || { ice: {}, locks: [], keys: [] };
        const ice = Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => !chain.includes(+i) && +i !== ck));
        chain.slice(1).forEach(t => ice[t] = 1);
        x.obst.ice = ice; x.clock = { i: ck, n: c.pos[ck] + 4 };
        noDown(x, [...chain, ck]);
        if (valid(x)) return x;
      }
      return null;
    },
  },
  blindTwins: {
    title: 'Blind partners',
    idea: 'You can see every frozen tile, but its partners are face down. Remember what you uncover.',
    make(b, c) {
      const x = clone(b); const ice = Object.keys(x.obst && x.obst.ice || {}).map(Number);
      if (ice.length < 3) return null;
      const al = new Uint8Array(c.n).fill(1);
      for (const i of ice) for (let j = 0; j < c.n; j++) if (j !== i && x.faces[j] === x.faces[i] && !c.free0[j] && !special(x, j) && !x.down.includes(j)) x.down.push(j);
      return valid(x) ? x : null;
    },
  },
  deepKeys: {
    title: 'Locks in plain sight',
    idea: 'Tiles on top are locked from the start; both keys lie deep inside the pile under ordinary tiles. Dig down to the keys without filling the tray.',
    make(b, c) {
      // two keys of one picture, both under other tiles and low in the pile; the locks: tiles you can see
      // at the start, not on the way down to the keys. A new way through is searched with the locks on.
      const deep = i => c.nb.above[i].length && c.tiles[i].z <= 1 && !special(b, i);
      const byFace = {}; for (let i = 0; i < c.n; i++) if (deep(i)) (byFace[b.faces[i]] = byFace[b.faces[i]] || []).push(i);
      const pairs = Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]).sort((p, q) => Math.abs(c.tiles[q[0]].x - c.tiles[q[1]].x) - Math.abs(c.tiles[p[0]].x - c.tiles[p[1]].x));
      const coverOf = i => { const s2 = new Set(), st = [i]; while (st.length) { const j = st.pop(); for (const a of c.nb.above[j]) if (!s2.has(a)) { s2.add(a); st.push(a); } } return s2; };
      for (const kk of pairs.slice(0, 12)) {
        const way = new Set([...coverOf(kk[0]), ...coverOf(kk[1])]);
        const locks = c.P.filter(i => c.top[i] && !way.has(i) && !kk.includes(i) && !special(b, i)).slice(0, 6);
        if (locks.length < 5) continue;
        const x = clone(b);
        x.obst = { ice: Object.fromEntries(Object.entries(x.obst && x.obst.ice || {}).filter(([i]) => ![...locks, ...kk].includes(+i))), locks, keys: [kk[0], kk[1]] };
        noDown(x, [...locks, ...kk]);
        const y = fix(x);
        if (y) return y;
      }
      return null;
    },
  },
  // ---- round 3 (Dennis, 2026-10-23: "more clever combination ideas, also with high tray pressure";
  //      not tiles on their own twins: the tray fills because you have to dig) ----
  chainReaction: {
    title: 'Chain reaction',
    idea: 'Frozen tiles guard the keys, the keys open the lock on the alarm clock, and the clock is buried. Every step means digging while the tray fills.',
    make(b, c) {
      const ok = i => !special(b, i);
      const deep = []; for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 2) deep.push(i);
      const byFace = {}; for (const i of deep) (byFace[b.faces[i]] = byFace[b.faces[i]] || []).push(i);
      const keyPairs = Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]);
      for (const kk of keyPairs.slice(0, 10)) {
        const kdig = new Set([...coverOf(c, kk[0]), ...coverOf(c, kk[1])]);
        const clocks = deep.filter(i => !kk.includes(i) && !kdig.has(i) && coverOf(c, i).size >= 3 && ![...coverOf(c, i)].some(j => kk.includes(j))).sort((p, q) => coverOf(c, q).size - coverOf(c, p).size);
        for (const ck of clocks.slice(0, 4)) {
          const cdig = coverOf(c, ck);
          const x = clone(b);
          // ice on one tile over each key (double where it fits)
          const ice = {}; for (const k of kk) { const t = [...coverOf(c, k)].find(j => ok(j) && !Object.keys(ice).some(q => c.inb[j].includes(+q))); if (t !== undefined) ice[t] = 2; }
          const locks = [ck, ...c.P.filter(i => ok(i) && c.top[i] && !kdig.has(i) && !cdig.has(i) && !kk.includes(i) && i !== ck).slice(0, 3)];
          x.obst = { ice, locks, keys: [kk[0], kk[1]] };
          x.clock = { i: ck, n: 999 };
          noDown(x, [...kk, ck, ...Object.keys(ice).map(Number), ...locks]);
          const y = fix(x); if (y) return y;
        }
      }
      return null;
    },
  },
  lockedPartners: {
    title: 'Partners behind locks',
    idea: 'The keys are deep. Every tile you dig through on the way has its partner locked, so they wait in the tray until you reach the keys.',
    make(b, c) {
      const ok = i => !special(b, i);
      const byFace = {}; for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 2) (byFace[b.faces[i]] = byFace[b.faces[i]] || []).push(i);
      const pairs = Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]).sort((p, q) => (coverOf(c, q[0]).size + coverOf(c, q[1]).size) - (coverOf(c, p[0]).size + coverOf(c, p[1]).size));
      for (const kk of pairs.slice(0, 12)) {
        const dig = new Set([...coverOf(c, kk[0]), ...coverOf(c, kk[1])]);
        const locks = [];
        for (const t of dig) for (let j = 0; j < c.n; j++) if (j !== t && b.faces[j] === b.faces[t] && !dig.has(j) && !kk.includes(j) && ok(j) && !locks.includes(j)) { locks.push(j); break; }
        if (locks.length < 3) continue;
        const x = clone(b);
        x.obst = { ice: Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => ![...locks, ...kk, ...dig].includes(+i))), locks: locks.slice(0, 8), keys: [kk[0], kk[1]] };
        noDown(x, [...kk, ...locks]);
        const y = fix(x); if (y) return y;
      }
      return null;
    },
  },
  blindDig: {
    title: 'Blind dig',
    idea: 'The alarm clock is buried, the tiles on top of it are face down, and their partners are frozen. You dig without knowing what you take.',
    make(b, c) {
      const ok = i => !special(b, i);
      const clocks = []; for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 4 && coverOf(c, i).size <= 9) clocks.push(i);
      clocks.sort((p, q) => coverOf(c, q).size - coverOf(c, p).size);
      for (const ck of clocks.slice(0, 12)) {
        const dig = [...coverOf(c, ck)].filter(ok);
        const x = clone(b);
        const down = new Set(x.down.filter(i => i !== ck)); for (const t of dig) if (!c.free0[t]) down.add(t);
        const ice = Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => !dig.includes(+i) && +i !== ck));
        let n = 0;
        for (const t of dig) { const p = c.P.find(j => j !== t && b.faces[j] === b.faces[t] && !dig.includes(j) && ok(j) && !down.has(j) && !c.inb[j].some(q => ice[q])); if (p !== undefined) { ice[p] = 1; n++; } }
        if (n < 2) continue;
        x.down = [...down]; x.obst = { ...x.obst, ice }; x.clock = { i: ck, n: 999 };
        const y = fix(x); if (y) return y;
      }
      return null;
    },
  },
  // ---- round 4 (Dennis, 2026-10-23: "The clock doesn't always need the digging. Maybe the clock is locked
  //      on top and the keys need digging. Or even harder cause less clear: you need to do something else
  //      first cause of tray space or freeze or lock before you can take the obvious clock") ----
  clockOnTopLocked: {
    title: 'Clock in sight, keys out of reach',
    idea: 'The alarm clock lies on top, free, but locked. Both keys are buried. Dig them out before time runs out.',
    make(b, c) {
      const ok = i => !special(b, i);
      const tops = c.P.filter(i => ok(i) && c.free0[i]);
      const deep = []; for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 3) deep.push(i);
      const byFace = {}; for (const i of deep) (byFace[b.faces[i]] = byFace[b.faces[i]] || []).push(i);
      const keyPairs = Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]);
      for (const kk of keyPairs.slice(0, 10)) for (const ck of tops.slice(0, 6)) {
        if (b.faces[ck] === b.faces[kk[0]]) continue;
        const kdig = new Set([...coverOf(c, kk[0]), ...coverOf(c, kk[1])]); if (kdig.has(ck)) continue;
        const x = clone(b);
        x.obst = { ice: Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => ![ck, ...kk].includes(+i))), locks: [ck], keys: [kk[0], kk[1]] };
        x.clock = { i: ck, n: 999 }; noDown(x, [ck, ...kk]);
        const y = fix(x); if (y) return y;
      }
      return null;
    },
  },
  dontGrab: {
    title: "Don't grab the clock",
    idea: 'The alarm clock is free from the start, but its partner is buried. Take the clock too early and it blocks a tray slot while you dig; wait too long and the alarm goes off.',
    make(b, c) {
      const ok = i => !special(b, i);
      for (const ck of c.P.filter(i => ok(i) && c.free0[i]).slice(0, 15)) {
        const x = clone(b); const mates = buryMates(x, c, ck, 4); if (!mates || !mates.length) continue;
        const mate = mates.sort((p, q) => coverOf(c, p).size - coverOf(c, q).size)[0];
        x.clock = null; noDown(x, [ck]);
        // the quickest way to the partner; the clock goes off one move after that
        const g = gameG(x), route = clockRoute(g, mate); if (!route) continue;
        const k = route.indexOf(mate); if (k < 8) continue;   // a real dig, not three moves
        const path = route.filter(i => i !== ck);
        path.splice(k + (route.indexOf(ck) < k ? 0 : 1), 0, ck);
        const y = { ...x, solution: path, clock: { i: ck, n: path.indexOf(ck) + 2 }, clockMate: mate };
        if (valid(y)) return y;
      }
      return null;
    },
  },
  iceLockClock: {
    title: 'Ice, lock, then the clock',
    idea: 'The alarm clock lies on top but is frozen. The tiles next to it are locked, and the keys are buried. Keys first, then its neighbours, then the clock.',
    make(b, c) {
      const ok = i => !special(b, i);
      for (const ck of c.P.filter(i => ok(i) && c.top[i])) {
        const nbs = c.inb[ck].filter(j => ok(j) && c.tiles[j].z === c.tiles[ck].z);
        if (nbs.length < 2) continue;
        const deep = []; for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 2 && i !== ck && !nbs.includes(i)) deep.push(i);
        const byFace = {}; for (const i of deep) (byFace[b.faces[i]] = byFace[b.faces[i]] || []).push(i);
        for (const kk of Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]).slice(0, 6)) {
          const kdig = new Set([...coverOf(c, kk[0]), ...coverOf(c, kk[1])]);
          if (nbs.some(j => kdig.has(j)) || kdig.has(ck)) continue;
          const x = clone(b);
          const ice = Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => ![ck, ...nbs, ...kk].includes(+i) && !c.inb[ck].includes(+i)));
          ice[ck] = Math.min(2, nbs.length);
          x.obst = { ice, locks: nbs.slice(0, 3), keys: [kk[0], kk[1]] };
          x.clock = { i: ck, n: 999 }; noDown(x, [ck, ...nbs, ...kk]);
          const y = fix(x); if (y) return y;
        }
      }
      return null;
    },
  },
  // ---- round 4, Claude's own: tray space as the puzzle (Dennis liked it; with two variants) ----
  // the clock under a few tiles whose partners are elsewhere and buried: digging to the clock fills the
  // tray, and you have to plan which singles you can hold at the moment you take it
  trayJuggle: trayJuggleIdea('plain', 'Room in the tray', 'The alarm clock lies under a few tiles whose partners are buried elsewhere. Plan your tray: you have to hold those singles at the moment you take the clock.'),
  trayJuggleLocked: trayJuggleIdea('locked', 'Room in the tray: locked partners', 'Digging to the alarm clock puts singles in your tray, and their partners are locked. The keys are elsewhere: decide what to hold and when.'),
  trayJuggleFrozen: trayJuggleIdea('frozen', 'Room in the tray: frozen partners', 'Digging to the alarm clock puts singles in your tray, and their partners are frozen. Thaw them in the right order or the tray fills up.'),
  keyToEscape: {
    title: 'The key to the way out',
    idea: "The alarm clock is free, but its partner is buried under locked tiles. Find the keys, then dig to the partner, and only then take the clock.",
    make(b, c) {
      const ok = i => !special(b, i);
      for (const ck of c.P.filter(i => ok(i) && c.free0[i]).slice(0, 15)) {
        const b2 = clone(b), mates = buryMates(b2, c, ck, 2); if (!mates || !mates.length) continue;
        const m = mates[0], lockT = [...coverOf(c, m)].filter(ok);
        if (lockT.length < 2) continue;
        const deep = []; for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 2 && i !== ck && !mates.includes(i) && !lockT.includes(i)) deep.push(i);
        const byFace = {}; for (const i of deep) (byFace[b2.faces[i]] = byFace[b2.faces[i]] || []).push(i);
        for (const kk of Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]).slice(0, 6)) {
          const kdig = new Set([...coverOf(c, kk[0]), ...coverOf(c, kk[1])]); if (lockT.some(t => kdig.has(t)) || kdig.has(ck)) continue;
          const x = clone(b2);
          x.obst = { ice: Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => ![ck, m, ...lockT, ...kk].includes(+i))), locks: lockT, keys: [kk[0], kk[1]] };
          x.clock = { i: ck, n: 999 }; x.clockMate = m; noDown(x, [ck, ...lockT, ...kk]);
          const y = fix(x); if (y) return y;
        }
      }
      return null;
    },
  },
  frozenKey: {
    title: 'The frozen key',
    idea: 'The alarm clock lies on top, locked. One key is easy to reach; the other lies under double ice, and the tiles around that ice are face down.',
    make(b, c) {
      const ok = i => !special(b, i);
      const byFace = {}; for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 1 && !c.free0[i]) (byFace[b.faces[i]] = byFace[b.faces[i]] || []).push(i);
      for (const g of Object.values(byFace).filter(g => g.length >= 2)) for (const [k1, k2] of [[g[0], g[1]], [g[1], g[0]]]) {
        const u = [...coverOf(c, k2)].find(t => ok(t) && c.nb.above[t].length === 0);
        if (u === undefined) continue;
        const kdig = new Set([...coverOf(c, k1), ...coverOf(c, k2)]);
        for (const ck of c.P.filter(i => ok(i) && c.free0[i] && !kdig.has(i) && i !== k1 && i !== k2).slice(0, 4)) {
          const x = clone(b);
          const ice = Object.fromEntries(Object.entries(x.obst.ice || {}).filter(([i]) => ![ck, k1, k2, u].includes(+i) && !c.inb[u].includes(+i)));
          ice[u] = 2;
          const down = new Set(x.down.filter(i => ![ck, k1, k2, u].includes(i))); for (const j of c.inb[u]) if (!c.free0[j] && ok(j) && j !== k2) down.add(j);
          x.down = [...down]; x.obst = { ice, locks: [ck], keys: [k1, k2] }; x.clock = { i: ck, n: 999 };
          const y = fix(x); if (y) return y;
        }
      }
      return null;
    },
  },
};

// a change that breaks the stored way through: search a new one with the rules on (the clock keeps its
// spare moves on the new way)
function clockRoute(g, ci) {   // (hard.js clockRoute, searching deeper: a clock behind keys and ice is far down)
  const n = g.tiles.length, initial = new Uint8Array(n).fill(1);
  const remainingRules = alive => {
    if (!g.rules) return null;
    const ice = {};
    for (const k in g.rules.ice) {
      const gone = g.rules.iceNb[k].filter(i => !alive[i]).length;
      if (g.rules.ice[k] > gone) ice[k] = g.rules.ice[k] - gone;
    }
    return { ...g.rules, ice };
  };
  const blockers = alive => {
    const up = new Set(), todo = [ci];
    while (todo.length) for (const j of g.nb.above[todo.pop()]) if (alive[j] && !up.has(j)) { up.add(j); todo.push(j); }
    const side = name => { const set = new Set(up), todo = [ci], seen = new Set();
      while (todo.length) { const k = todo.pop(); if (seen.has(k)) continue; seen.add(k); for (const j of g.nb[name][k]) if (alive[j]) { set.add(j); todo.push(j); } }
      return set.size;
    };
    return Math.min(side('left'), side('right')) + 1;
  };
  let frontier = [{ alive: initial.slice(), tray: [], path: [] }], nodes = 0;
  const seen = new Set();
  for (let depth = 0; depth < Math.min(70, n * 0.85) && frontier.length && nodes < 60000; depth++) {
    const next = [];
    for (const state of frontier) {
      for (let i = 0; i < n; i++) {
        if (!(g.rules ? L.takeable(i, state.alive, g.nb, g.rules, initial) : L.isFree(i, state.alive, g.nb))) continue;
        const q = state.tray.findIndex(j => g.faces[j] === g.faces[i]);
        if (q < 0 && state.tray.length >= 3) continue;
        const alive = state.alive.slice(); alive[i] = 0;
        const tray = q < 0 ? state.tray.concat(i) : state.tray.filter((_, k) => k !== q), path = state.path.concat(i);
        const key = alive.join('') + '|' + tray.map(j => g.faces[j]).sort((a,b) => a-b).join(',');
        if (seen.has(key)) continue; seen.add(key); nodes++;
        if (i === ci) {
          const rest = L.solve(g.tiles, g.nb, g.faces, alive, tray, 12000, remainingRules(alive));
          if (rest) return path.concat(rest);
        } else next.push({ alive, tray, path, score: blockers(alive) + tray.length * 0.15 });
      }
    }
    next.sort((a,b) => a.score-b.score);
    frontier = next.slice(0, 48);
  }
  return null;
}

// EXACT: the clock counts from the true shortest way to it (tools/lab/exact.js), not the beam search
const { exactRoute } = require('./exact');
let EXACT = false;
function fix(y, spare) {
  const g = gameG(y);
  let path = null;
  if (y.clock && y.clockMate !== undefined) {   // "don't grab the clock": the quickest way to its buried partner, the clock right with it
    const ex = EXACT ? exactRoute(g, y.clockMate) : null, route = ex ? ex.path : clockRoute(g, y.clockMate); if (!route) return null;
    const ck = y.clock.i, k = route.indexOf(y.clockMate); path = route.filter(i => i !== ck); path.splice(k + (route.indexOf(ck) < k ? 0 : 1), 0, ck);
    const z = { ...y, solution: path, clock: { i: ck, n: path.indexOf(ck) + 1 + (spare ?? 1) } };
    return valid(z) ? z : null;
  }
  if (y.clock) { const ex = EXACT ? exactRoute(g, y.clock.i) : null; path = ex ? ex.path : EXACT ? null : clockRoute(g, y.clock.i); if (!path) return null; }   // the quickest way to the clock that finishes the level (none found: the clock would mean nothing)
  if (!path && valid(y)) path = y.solution;
  if (!path) { const al = new Uint8Array(y.tiles.length).fill(1); path = L.solve(g.tiles, g.nb, y.faces, al, [], 120000, g.rules); }
  if (!path || path.length !== y.tiles.length) return null;
  const z = { ...y, solution: path };
  // the clock: the moves that way needs to reach it, plus `spare` (never a number cut below that)
  if (y.clock) z.clock = { i: y.clock.i, n: path.indexOf(y.clock.i) + 1 + (spare ?? Math.max(0, y.clock.n - (y.solution.indexOf(y.clock.i) + 1))) };
  return valid(z) ? z : null;
}

// ---------- difficulty ----------
// the idea's own specials stay. Dennis (2026-10-23): fill the tray by making you dig ("clock digging,
// key digging, frozen tile digging"), not by putting tiles on their own twins; and tighten the clock by
// making it take more moves to reach, not by a smaller number. So, harder: the clock on a deeper tile
// (its number counts the moves the quickest found way needs, plus SPARE), the keys on a deeper pair,
// ice (also double) on the tiles you dig through, more locks, more face-down tiles.
const coverOf = (c, i) => { const s2 = new Set(), st = [i]; while (st.length) { const j = st.pop(); for (const a of c.nb.above[j]) if (!s2.has(a)) { s2.add(a); st.push(a); } } return s2; };
const clockOn = (y, ci, spare) => fix({ ...y, clock: { i: ci, n: 999 } }, spare);
function nudge(b, target, seed, keep, spare, kind, steps = +(process.env.STEPS || 30)) {
  const r = rngOf(seed);
  let m = measure(b, 160, seed), x = b;
  const off = mm => NAMES.reduce((s, n) => s + (mm[n].first - target[n].first), 0) / 2;
  for (let k = 0; k < steps && Math.abs(off(m)) > 0.02; k++) {
    const dir = off(m); let best = null;
    for (let q = 0; q < 5; q++) {
      let y = clone(x); const c = ctxOf(y), u = r();
      const pick = a => a[Math.floor(r() * a.length)];
      const dig = new Set([...(y.clock ? coverOf(c, y.clock.i) : []), ...(y.obst.keys || []).flatMap(kk => [...coverOf(c, kk)])]);
      if (dir > 0) {   // too easy
        if (u < 0.25) { const f = c.P.filter(i => !c.free0[i] && !special(y, i) && !y.down.includes(i)); if (!f.length) continue; for (let t = 0; t < 1 + Math.floor(dir * 20); t++) { const i = pick(f); if (!y.down.includes(i)) y.down.push(i); } }
        else if (u < 0.45) {   // clock digging: a tile with more on top of it (not where the idea put the clock)
          if (y.clock && keep.includes(y.clock.i)) continue;
          const cur = y.clock ? coverOf(c, y.clock.i).size : 0;
          const f = c.P.filter(i => !special(y, i) && coverOf(c, i).size > cur); if (!f.length) continue;
          const z = clockOn(y, pick(f), spare); if (!z) continue; y = z;
        } else if (u < 0.6) {  // key digging: a deeper pair of keys
          if (!(y.obst.keys || []).length || (kind !== 'deepKeys' && y.obst.keys.some(kk => keep.includes(kk)))) continue;
          const cur = Math.min(...y.obst.keys.map(kk => coverOf(c, kk).size)), byFace = {};
          for (let i = 0; i < c.n; i++) if (!special(y, i) && coverOf(c, i).size > cur) (byFace[y.faces[i]] = byFace[y.faces[i]] || []).push(i);
          const ps = Object.values(byFace).filter(g => g.length >= 2); if (!ps.length) continue;
          const g = pick(ps); y.obst = { ...y.obst, keys: [g[0], g[1]] };
        } else if (u < 0.8) {  // frozen tile digging: ice on a tile you have to dig through
          const f = [...dig].filter(i => !special(y, i) && !c.inb[i].some(j => (y.obst.ice || {})[j])); if (!f.length) continue;
          y.obst = { ...y.obst, ice: { ...(y.obst.ice || {}), [pick(f)]: r() < 0.5 ? 2 : 1 } };
        } else { if (!(y.obst.keys || []).length) continue; const f = c.P.filter(i => !special(y, i) && !dig.has(i) && !y.down.includes(i)); if (!f.length) continue; y.obst = { ...y.obst, locks: [...y.obst.locks, pick(f)] }; }
      } else {         // too hard
        if (u < 0.35) { const f = y.down.filter(i => !keep.includes(i)); if (!f.length) continue; y.down = y.down.filter(i => i !== pick(f)); }
        else if (u < 0.55 && y.clock && !keep.includes(y.clock.i)) {   // the clock on a tile with less on top
          const cur = coverOf(c, y.clock.i).size, f = c.P.filter(i => !special(y, i) && coverOf(c, i).size < cur && coverOf(c, i).size > 0); if (!f.length) continue;
          const z = clockOn(y, pick(f), spare); if (!z) continue; y = z;
        } else if (u < 0.8) { const f = Object.keys(y.obst.ice || {}).map(Number).filter(i => !keep.includes(i)); if (!f.length) continue; const i = pick(f); const ice = { ...y.obst.ice }; delete ice[i]; y.obst = { ...y.obst, ice }; }
        else { const f = (y.obst.locks || []).filter(i => !keep.includes(i)); if (!f.length) continue; y.obst = { ...y.obst, locks: y.obst.locks.filter(i => i !== pick(f)) }; }
      }
      y = fix(y, spare); if (!y) continue;
      const my = measure(y, 160, seed + k * 10 + q + 1);
      if (!best || Math.abs(off(my)) < Math.abs(off(best.m))) best = { y, m: my };
    }
    if (best && Math.abs(off(best.m)) < Math.abs(off(m))) { x = best.y; m = best.m; }
    if (process.env.VERBOSE) console.log(`  step ${k}: Dennis ${(m.Dennisisdebeste.first * 100).toFixed(0)}% Mrs D ${(m['Mrs. Doubtfire'].first * 100).toFixed(0)}%`);
  }
  return { board: x, m: measure(x, 400, seed + 99) };
}

// ---------- make them ----------
/* node ideas.js make <first id> <kind:tiles:level> ...   (level: hard | veryhard)
   node ideas.js merge                                    writes lab-ideas.js from tools/lab/ideas-out
   Dennis (2026-10-23) after the first round: "They need to be tuned way harder so that there is almost no
   room for error". hard: the test players win about 1 in 8 / 1 in 20 first tries; very hard: 1 in 20 / 1 in 50. */
// the clock: the moves the quickest found way needs to reach it, plus SPARE
// honest (round 5, 2026-10-24): no tuning towards the test players (they do not reason the way Dennis
// does); the clock = the true shortest way + 2 (Dennis on a clock with about that: "give the clock 1/2
// more turns"; the levels with the clock near the true shortest took him 5-11 tries)
const LEVELS = { hard: { Dennisisdebeste: 0.12, 'Mrs. Doubtfire': 0.05 }, veryhard: { Dennisisdebeste: 0.05, 'Mrs. Doubtfire': 0.02 }, brutal: { Dennisisdebeste: 0.02, 'Mrs. Doubtfire': 0.01 }, honest: null }, SPARE = { hard: 2, veryhard: 1, brutal: 1, honest: 2 };
const OUTD = path.join(__dirname, 'ideas-out');
const shapes = [...SHAPE_NAMES.filter(s => !['block', 'oval', 'octagon'].includes(s)), ...Array.from({ length: 80 }, (_, k) => 'blob' + (9001 + k * 37))];
module.exports = { IDEAS, ctxOf, fix, valid, clone, rngOf, measure, setExact: v => { EXACT = v; } };
if (require.main !== module) { /* used as a module by tools/factory/plan.js */ }
else if (process.argv[2] === 'merge') {
  const ideas = fs.readdirSync(OUTD).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(OUTD, f), 'utf8'))).filter(x => x.id >= +(process.argv[3] || 0)).sort((a, b) => a.id - b.id);
  fs.writeFileSync(path.join(__dirname, 'lab-ideas.js'), '/* made by tools/lab/ideas.js */\nconst LAB_IDEAS = ' + JSON.stringify({ made: new Date().toISOString(), levels: LEVELS, ideas }) + ';\n');
  console.log(`lab-ideas.js: ${ideas.length} ideas`);
} else if (process.argv[2] === 'make') {
  fs.mkdirSync(OUTD, { recursive: true });
  let id = +process.argv[3];
  for (const spec of process.argv.slice(4)) {
    const [kind, N0, lvl] = spec.split(':'), N = +N0, I = IDEAS[kind], tgt = LEVELS[lvl];
    const tfull = tgt ? { Dennisisdebeste: { first: tgt.Dennisisdebeste }, 'Mrs. Doubtfire': { first: tgt['Mrs. Doubtfire'] } } : null;
    EXACT = lvl === 'honest';
    let made = null, si = id * 7;
    for (let tries = 0; tries < 60 && !made; tries++) {
      const shape = shapes[(si++) % shapes.length];
      if (tries < 30 && fs.existsSync(OUTD) && fs.readdirSync(OUTD).some(f => { try { return JSON.parse(fs.readFileSync(path.join(OUTD, f), 'utf8')).shape === shape; } catch (e) { return false; } })) continue;
      const p = newPile(shape, N, 4, 1000 + si * 13); if (!p) continue;
      const d = Hard.makeNow(230, 1.6, 1, si, { tiles: p.tiles });
      if (!d.solution || !valid(d)) continue;
      const base = { tiles: d.tiles, faces: d.faces.slice(), down: d.down.slice(), gold: (d.gold || []).slice(), obst: d.obst ? clone(d.obst) : { ice: {}, locks: [], keys: [] }, clock: d.clock ? { ...d.clock } : null, solution: d.solution.slice() };
      const x = I.make(base, ctxOf(base), rngOf(si * 31 + 7));
      if (!x) continue;
      const keepT = [...(x.obst.locks || []), ...(x.obst.keys || []), ...(x.clock ? [x.clock.i] : []), ...Object.keys(x.obst.ice || {}).map(Number).filter(i => !(base.obst.ice || {})[i]), ...x.down.filter(i => !base.down.includes(i))];
      if ((x.obst.keys || []).length && !x.obst.keys.some(k => keepT.includes(k))) {
        const cx = ctxOf(x); if (x.obst.keys.some(k => cx.free0[k])) x.obst = { ...x.obst, keys: [], locks: [] };
      }
      const x2 = fix(x, SPARE[lvl]); if (!x2) continue;
      const t = lvl === 'honest' ? { board: x2, m: measure(x2, 400, 7099 + si) } : nudge(x2, tfull, 7001 + si, keepT, SPARE[lvl], kind);
      const ck = t.board.clock ? t.board.clock.n - (t.board.solution.indexOf(t.board.clock.i) + 1) : null;
      made = { id, kind, level: lvl, title: I.title + ({ veryhard: ' · very hard', brutal: ' · brutal', honest: ' · tight clock' }[lvl] || ' · hard') + (N < 80 ? ' · small board' : ''), idea: I.idea + (N < 80 ? ` Only ${N} tiles.` : ''), shape, like: +p.like.toFixed(2), tiles: N, board: t.board, m: t.m,
        specials: { down: t.board.down.length, ice: Object.keys(t.board.obst.ice || {}).length, locks: (t.board.obst.locks || []).length, clockSpare: ck } };
      console.log(`idea ${id} ${kind} ${lvl} on ${shape} (${N} tiles): Dennis ${(t.m.Dennisisdebeste.first * 100).toFixed(0)}% / Mrs D ${(t.m['Mrs. Doubtfire'].first * 100).toFixed(0)}% first try; ${JSON.stringify(made.specials)}`);
    }
    if (made) fs.writeFileSync(path.join(OUTD, id + '.json'), JSON.stringify(made)); else console.log(`no place for ${kind}`);
    id++;
  }
}
