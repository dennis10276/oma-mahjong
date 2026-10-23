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
    idea: 'Six tiles on top are locked from the start; the keys lie deep in the middle of the pile.',
    make(b, c) {
      // keys under other tiles, completed as late as still leaves visible tiles to lock
      const keys = c.pairs.filter(([a, b2, k]) => k >= 6 && c.nb.above[a].length && c.nb.above[b2].length && !special(b, a) && !special(b, b2))
        .map(p => ({ p, vis: c.P.filter(i => c.pos[i] > p[2] && c.top[i] && !special(b, i)).length })).filter(o => o.vis >= 5).sort((u, v) => v.p[2] - u.p[2])[0];
      if (!keys) return null;
      const kk = keys.p, locks = c.P.filter(i => c.pos[i] > kk[2] && c.top[i] && !special(b, i) && i !== kk[0] && i !== kk[1]).slice(0, 6);
      const keysArr = kk; keysArr.length = 3;
      return (x => { x.obst = { ice: Object.fromEntries(Object.entries(x.obst && x.obst.ice || {}).filter(([i]) => ![...locks, kk[0], kk[1]].includes(+i))), locks, keys: [kk[0], kk[1]] }; noDown(x, [...locks, kk[0], kk[1]]); return valid(x) ? x : null; })(clone(b));
      const x = clone(b);
      x.obst = { ice: Object.fromEntries(Object.entries(x.obst && x.obst.ice || {}).filter(([i]) => ![...locks, keys[0], keys[1]].includes(+i))), locks, keys: [keys[0], keys[1]] };
      noDown(x, [...locks, keys[0], keys[1]]);
      return valid(x) ? x : null;
    },
  },
};

// ---------- difficulty: towards a level near 200 ----------
// the idea's own specials stay; around them: face-down tiles, extra ice, the clock, pictures
function nudge(b, target, seed, keep) {
  const r = rngOf(seed);
  let m = measure(b, 120, seed), x = b;
  const off = mm => NAMES.reduce((s, n) => s + (mm[n].first - target[n].first) + (ease(mm[n]) - ease(target[n])), 0) / 4;
  for (let k = 0; k < 16 && Math.abs(off(m)) > 0.025; k++) {
    const dir = off(m); let best = null;
    for (let q = 0; q < 4; q++) {
      const y = clone(x), c = ctxOf(y), u = r();
      const pick = a => a[Math.floor(r() * a.length)];
      if (dir > 0) {   // too easy
        if (u < 0.35) { const f = c.P.filter(i => !c.free0[i] && !special(y, i) && !y.down.includes(i)); if (!f.length) continue; for (let t = 0; t < 1 + Math.floor(Math.abs(dir) * 20); t++) { const i = pick(f); if (!y.down.includes(i)) y.down.push(i); } }
        else if (u < 0.6 && y.clock) { const base = c.pos[y.clock.i] + 1; if (y.clock.n <= base + 1) continue; y.clock.n--; }
        else if (u < 0.85) { const f = c.P.filter(i => !special(y, i) && !y.down.includes(i) && iceOK(c, i, 1) && !c.inb[i].some(j => (y.obst.ice || {})[j])); if (!f.length) continue; y.obst.ice = { ...(y.obst.ice || {}), [pick(f)]: 1 }; }
        else { const ks = y.obst.keys || []; if (!ks.length) continue; const kpos = Math.max(c.pos[ks[0]], c.pos[ks[1]]); const f = c.P.filter(i => c.pos[i] > kpos + 1 && !special(y, i) && !y.down.includes(i)); if (!f.length) continue; y.obst.locks = [...y.obst.locks, pick(f)]; }
      } else {         // too hard
        if (u < 0.45) { const f = y.down.filter(i => !keep.includes(i)); if (!f.length) continue; y.down = y.down.filter(i => i !== pick(f)); }
        else if (u < 0.7 && y.clock) { const base = c.pos[y.clock.i] + 1; if (y.clock.n >= base + 6) continue; y.clock.n++; }
        else { const f = Object.keys(y.obst.ice || {}).map(Number).filter(i => !keep.includes(i)); if (!f.length) continue; const i = pick(f); const ice = { ...y.obst.ice }; delete ice[i]; y.obst.ice = ice; }
      }
      if (!valid(y)) continue;
      const my = measure(y, 120, seed + k * 10 + q + 1);
      if (!best || Math.abs(off(my)) < Math.abs(off(best.m))) best = { y, m: my };
    }
    if (best && Math.abs(off(best.m)) < Math.abs(off(m))) { x = best.y; m = best.m; }
  }
  return { board: x, m: measure(x, 300, seed + 99) };
}

// ---------- make them ----------
const COUNT = +(process.argv[2] || 8);
const plan = [
  ['lockedClock', 86], ['frozenGuards', 86], ['keysAcross', 88], ['iceChain', 84],
  ['blindTwins', 86], ['deepKeys', 88], ['lockedClock', 70], ['iceChain', 70],
].slice(0, COUNT);
const target = PLAN.levels.find(l => l.lv === 201).target;
const shapes = [...SHAPE_NAMES.filter(s => !['block', 'oval', 'octagon'].includes(s)), ...Array.from({ length: 60 }, (_, k) => 'blob' + (9001 + k * 37))];
const out = [], usedShapes = new Set();
let si = 0;
for (const [kind, N] of plan) {
  const I = IDEAS[kind]; let made = null;
  for (let tries = 0; tries < 40 && !made; tries++) {
    const shape = shapes[(si++) % shapes.length]; if (usedShapes.has(shape)) continue;
    const p = newPile(shape, N, 4, 1000 + si * 13); if (!p) continue;
    const d = Hard.makeNow(201, 1.6, 1, si, { tiles: p.tiles });
    if (!d.solution || !valid(d)) continue;
    const base = { tiles: d.tiles, faces: d.faces.slice(), down: d.down.slice(), gold: (d.gold || []).slice(), obst: d.obst ? clone(d.obst) : { ice: {}, locks: [], keys: [] }, clock: d.clock ? { ...d.clock } : null, solution: d.solution.slice() };
    const x = I.make(base, ctxOf(base), rngOf(si * 31 + 7));
    if (!x) continue;
    // the idea's specials (what differs from the designer's board) are kept while nudging
    const keepT = [...(x.obst.locks || []), ...(x.obst.keys || []), ...(x.clock ? [x.clock.i] : []), ...Object.keys(x.obst.ice || {}).map(Number).filter(i => !(base.obst.ice || {})[i]), ...x.down.filter(i => !base.down.includes(i))];
    const t = nudge(x, target, 7001 + si, keepT);
    made = { id: out.length + 1, kind, title: I.title + (N < 80 ? ' (small board)' : ''), idea: I.idea + (N < 80 ? ` Only ${N} tiles.` : ''), shape, like: +p.like.toFixed(2), tiles: N, board: t.board, m: t.m };
    usedShapes.add(shape);
    console.log(`idea ${made.id} ${kind} on ${shape} (${N} tiles, ${Math.round(p.like * 100)}% like a played level): Dennis ${(t.m.Dennisisdebeste.first * 100).toFixed(0)}% / Mrs D ${(t.m['Mrs. Doubtfire'].first * 100).toFixed(0)}% first try (level 201: ${(target.Dennisisdebeste.first * 100).toFixed(0)}% / ${(target['Mrs. Doubtfire'].first * 100).toFixed(0)}%)`);
  }
  if (made) out.push(made); else console.log(`no place for ${kind}`);
}
fs.writeFileSync(path.join(__dirname, 'lab-ideas.js'), '/* made by tools/lab/ideas.js */\nconst LAB_IDEAS = ' + JSON.stringify({ made: new Date().toISOString(), target: { level: 201, ...target }, ideas: out }) + ';\n');
console.log(`wrote ${out.length} ideas`);
