#!/usr/bin/env node
'use strict';
/* hand.js: a workbench for hand-designed trap boards (Dennis 2026-11-16: "Seems like you should handdesign some more to automate
   it after when you can see a pattern"). The designer writes the trap; the bench fills the rest and proves it.
     node source/tools/builder/bank/hand.js show <layout>                 the layout by layer, tile ids on their spots
     node source/tools/builder/bank/hand.js prove <spec.js> [--seed n]    fill, prove, explain; writes <spec>.board.json
   spec (module.exports = {...}):
     layout       layout id (builder catalogue, six-wide catalogues at 1000+/2000+)
     clock        tile id; spare (default 1): the clock number is the proven minimum + spare
     ice {id: hits}, locks [..], keys [a, b], locks2 [..], keys2 [a, b]   (gold and silver sets)
     route        the intended way to the clock, tile by tile, the clock last
     pairs        { label: [ids] }: tiles with the same picture (2 or 4 ids); every route tile needs a label
     baits        [{ at, take, why }]: the wrong moves meant to bite, priced from the position before route step `at`
     down         face-down share of the other tiles (default 0.24); pressure: tiles waiting while the rest is filled (default 1.4)
   Proof: the stored route replays strictly; the clock minimum is exact (engine.clockShortest) and equals the route; the whole
   board is won by the stored solution; each bait and every tempting move on the way is priced (trap_offers). */
const fs = require('fs'), path = require('path');
const E = require('../engine.js'), D = require('../loop/detour.js'), B = require('../builder.js'), SB = require('./shape_bench.js');
const DATA = path.resolve(__dirname, '../../../analysis/builder/data');
const clone = x => JSON.parse(JSON.stringify(x));
function layouts() {
  const L = B.LAYOUTS;
  for (const [f, o] of [['layouts-6wide.json', 1000], ['layouts-6wide-extra-72plus.json', 2000]]) {
    const j = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); (Array.isArray(j) ? j : j.layouts).forEach((l, i) => { L[o + i] = l; });
  }
  // hand-made layouts for single traps (Dennis 2026-11-17: "You may change the layouts to the needs of the trap"): ids 3000+
  const cust = path.resolve(__dirname, '../../../analysis/builder/hand/layouts-custom.json');
  if (fs.existsSync(cust)) for (const [id, l] of Object.entries(JSON.parse(fs.readFileSync(cust, 'utf8')))) L[id] = l;
  return L;
}
function show(tiles, mark = {}) {
  const zs = [...new Set(tiles.map(t => t[2]))].sort((a, b) => a - b), X = Math.max(...tiles.map(t => t[0])) + 2, Y = Math.max(...tiles.map(t => t[1])) + 2, out = [];
  for (const z of zs) {
    const g = Array.from({ length: Y }, () => Array(X * 3).fill(' '));
    tiles.forEach(([x, y, zz], i) => { if (zz !== z) return; const s = (mark[i] || '') + i; for (let k = 0; k < s.length && x * 3 + k < X * 3; k++) g[y][x * 3 + k] = s[k]; });
    out.push('layer ' + z + ':', ...g.map(r => r.join('').replace(/\s+$/, '')).filter((r, k, a) => r || (a[k + 1] || '')));
  }
  return out.join('\n');
}
// fill the pictures and a full stored solution around the designer's route and pairs
function fill(spec, tiles, seed = 1) {
  let r = (seed >>> 0) || 1; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296), pick = a => a[Math.floor(rnd() * a.length)];
  const n = tiles.length, label = new Array(n).fill(null);
  for (const [k, ids] of Object.entries(spec.pairs || {})) for (const i of ids) { if (label[i] != null) throw Error('tile ' + i + ' in two pairs'); label[i] = k; }
  const single = new Set(Object.values(spec.pairs || {}).filter(ids => ids.length === 1).flat());   // twin chosen by the fill
  const obst = obstOf(spec);
  const special = new Set([...Object.keys(obst.ice).map(Number), ...obst.locks, ...obst.keys, ...(obst.locks2 || []), ...(obst.keys2 || []), spec.clock]);
  for (let attempt = 0; attempt < 3000; attempt++) {
    // pictures: labels first (distinct pictures), the rest pair up as they come; 36 pictures, later pairs reuse non-label pictures
    const labels = Object.keys(spec.pairs || {}), pics = [...Array(36).keys()].sort(() => rnd() - .5), faceOf = {};
    labels.forEach((k, j) => faceOf[k] = pics[j]);
    const free = pics.slice(labels.length), faces = label.map(k => k == null ? -1 : faceOf[k]);
    let nextPic = 0; const newPic = () => free[nextPic++ % free.length];
    const g = E.game({ tiles, faces: faces.map(f => f < 0 ? 999 : f), down: [], obst, clock: { i: spec.clock, n: 999 }, solution: [] }, { strict: true });
    const gP = E.game({ tiles, faces: faces.map(f => f < 0 ? 999 : f), down: spec.downTiles || [], obst, clock: { i: spec.clock, n: 999 }, solution: [] });   // the game's rules: face-down pairs
    let s = E.start(g); const sol = [], open = [];    // open: tray tiles whose twin is not chosen yet
    const want = spec.pressure ?? 1.4;
    // an unlabelled tile gets its picture when taken: the twin of an open tray tile, or a new picture (it waits)
    const assign = (i, pairBias) => {
      if (faces[i] >= 0) return true;
      const near = (a, b) => Math.abs(tiles[a][0] - tiles[b][0]) <= 2 && Math.abs(tiles[a][1] - tiles[b][1]) <= 2;   // twins apart from the start
      const inTray = open.filter(t => s.tray.includes(t)), far = inTray.filter(t => !near(t, i));
      const close = far.length ? far : s.tray.length >= 3 || rnd() < .35 ? inTray : [];   // touching twins rarely; separate.js moves them after
      if (close.length && (s.tray.length >= 3 || s.tray.length > want || rnd() < pairBias)) { const t = pick(close); faces[i] = faces[t]; open.splice(open.indexOf(t), 1); return true; }
      if (s.tray.length < 3) { faces[i] = newPic(); open.push(i); return true; }
      return false;
    };
    const take = i => { const was = s.tray.includes(i); s = E.step({ ...g, faces }, s, i); sol.push(i); if (s && single.has(i) && s.tray.includes(i) && !was) open.push(i); };
    let ok = true;
    for (const i of [...spec.route, ...(spec.tail || [])]) {   // tail: a fixed order after the clock (a second chain)
      if (Array.isArray(i)) {   // a face-down pair: both tiles go together, no tray slot
        const [a, b] = i; if (!E.legal(g, s).includes(a) || !E.legal(g, s).includes(b)) { ok = false; break; }
        if (faces[a] < 0 && faces[b] < 0) faces[a] = faces[b] = newPic(); else if (faces[a] < 0) faces[a] = faces[b]; else if (faces[b] < 0) faces[b] = faces[a];
        if (faces[a] !== faces[b] || s.tray.some(t => faces[t] === faces[a])) { ok = false; break; }
        s = E.step({ ...gP, faces }, s, { pair: [a, b] }); sol.push(a, b); if (!s) { ok = false; break; } continue;
      }
      if (!E.legal(g, s).includes(i) || !assign(i, spec.digPairs ?? .7)) { ok = false; break; }
      take(i); if (!s) { ok = false; break; }
    }
    if (!ok) continue;
    while (s && s.alive.some(Boolean)) {
      const legal = E.legal(g, s); if (!legal.length) { ok = false; break; }
      const waiting = new Set(s.tray.map(t => faces[t]));
      const match = legal.filter(i => faces[i] >= 0 && waiting.has(faces[i]));
      let i;
      if (match.length && rnd() < .85) i = pick(match);
      else {
        const opts = legal.filter(i => !(faces[i] >= 0 && !waiting.has(faces[i]) && s.tray.length >= 3));
        if (!opts.length) { ok = false; break; }
        i = pick(opts);
        if (!assign(i, .55)) { ok = false; break; }
      }
      take(i); if (!s) { ok = false; break; }
    }
    if (!ok || !s || s.tray.length || open.length) continue;
    // face-down tiles among the filled ones (never a special, a labelled tile, or a tile free at the start)
    const g0 = E.game({ tiles, faces, down: [], obst, clock: { i: spec.clock, n: 999 }, solution: sol }, { strict: true }), start = new Set(E.legal(g0, E.start(g0)));
    const chosen = new Set(spec.downTiles || []), routeSet = new Set(spec.route.flat());
    // peek designs: no extra face-down tile may be free before the clock (it would be a second escape); only tiles that open later
    let early = new Set();
    if (spec.peek) { const gE = E.game({ tiles, faces, down: [], obst, clock: { i: spec.clock, n: 999 }, solution: sol }, { strict: true }); let st = E.start(gE);
      const ck = sol.indexOf(spec.clock); for (let t = 0; t <= ck && st; t++) { E.legal(gE, st).forEach(x => typeof x === 'number' && early.add(x)); st = E.step(gE, st, sol[t]); } }
    const cand = [...Array(n).keys()].filter(i => label[i] == null && !special.has(i) && !start.has(i) && !chosen.has(i) && !early.has(i) && !(spec.downTiles && routeSet.has(i))).sort(() => rnd() - .5);
    const down = [...chosen, ...cand.slice(0, Math.max(0, Math.round(n * (spec.down ?? 0.24)) - chosen.size))].sort((a, b) => a - b);
    return { design: { tiles, faces, down, gold: [], obst, clock: { i: spec.clock, n: 999 }, solution: sol }, label, attempt };
  }
  return { fail: 'no fill found (route tray too tight?)' };
}
const obstOf = spec => ({ ice: spec.ice || {}, locks: spec.locks || [], keys: spec.keys || [], ...(spec.keys2 ? { locks2: spec.locks2 || [], keys2: spec.keys2 } : {}) });
// the goals of spec.route with the dig in front of each: what lies on a goal goes first, then the cheaper side; trap tiles
// (labelled or special, not goals themselves) are never dug away. Returns { route, goalAt } or { fail }.
function expand(spec, tiles) {
  const g = E.game({ tiles, faces: tiles.map(() => 0), down: [], obst: obstOf(spec), clock: null, solution: [] }, { strict: true });
  const keep = new Set([...Object.values(spec.pairs || {}).flat(), ...Object.keys(spec.ice || {}).map(Number), ...(spec.locks || []), ...(spec.keys || []), ...(spec.locks2 || []), ...(spec.keys2 || [])]);
  const goals = new Set(spec.route); let s = E.start(g); const route = [], goalAt = [];
  const can = i => E.legal(g, s).includes(i);
  const dig = (t, depth) => {
    if (depth > 12) return false;
    if (can(t)) return true;
    for (const a of g.nb.above[t]) if (s.alive[a]) { if (keep.has(a) && !goals.has(a)) return false; if (!dig(a, depth + 1)) return false; route.push(a); s = E.step(g, s, a); }
    if (can(t)) return true;
    const L = g.nb.left[t].filter(j => s.alive[j]), R = g.nb.right[t].filter(j => s.alive[j]);
    const cost = side => side.some(j => keep.has(j) && !goals.has(j)) ? 99 : side.length + side.reduce((m, j) => m + g.nb.above[j].filter(a => s.alive[a]).length, 0);
    const side = cost(L) <= cost(R) ? L : R; if (cost(side) >= 99) return false;
    for (const j of side) { if (!dig(j, depth + 1)) return false; route.push(j); s = E.step(g, s, j); }
    return can(t);
  };
  for (const t of spec.route) { goalAt.push(route.length); if (!s.alive[t]) return { fail: 'goal ' + t + ' was dug away' }; if (!dig(t, 0)) return { fail: 'cannot reach ' + t }; route.push(t); s = E.step(g, s, t); }
  return { route, goalAt };
}
function prove(spec, o = {}) {
  const L = layouts(), lay = L[spec.layout]; if (!lay) throw Error('unknown layout ' + spec.layout);
  const tiles = lay.tiles.map(t => t.slice(0, 3)), ex = spec.exact ? { route: spec.route, goalAt: spec.route.map((_, k) => k) } : expand(spec, tiles);
  if (ex.fail) return { ok: false, fail: ex.fail };
  const goals = spec.route; spec = { ...spec, route: ex.route, goals, goalAt: ex.goalAt };
  // fill along the route; when the solver finds a shorter way to the clock, refill along that way (the trap stays the designer's)
  let f, cs, k;
  for (let round = 0; round < 4; round++) {
    f = fill(spec, tiles, o.seed ?? spec.seed ?? 1);
    if (f.fail) return { ok: false, fail: f.fail };
    cs = E.clockShortest(E.game(clone(f.design), spec.peek ? {} : { strict: true }), { nodes: 3e6, ms: 60000 });
    k = cs && !cs.unsure ? E.flatten(cs.path).indexOf(f.design.clock.i) + 1 : null;
    if (k == null || k >= spec.route.flat().length || spec.exact) break;
    spec = { ...spec, route: E.flatten(cs.path).slice(0, k), goalAt: spec.goalAt.map(() => 0), refilled: (spec.refilled || 0) + 1 };
  }
  let d = f.design; const out = [], errors = [];
  if (!spec.thickIce && Object.values(spec.ice || {}).some(v => v > 2)) errors.push('ice above 2 shows as 2 in the game (MECHANICS.md)');
  if (spec.refilled) out.push('refilled ' + spec.refilled + 'x along a shorter way');
  if (k == null && !spec.clockN) errors.push('clock minimum unproven');
  // the clock inside the last face-down pair: the solver counts the clock's move, the game's validator both tiles (validSolution:
  // the pair's second tile must come before the deadline), so the clock number counts both
  const last = spec.route[spec.route.length - 1], clockPair = Array.isArray(last) && last.includes(spec.clock), routeK = spec.route.flat().length;
  if (spec.clockN) out.push(`clock number set by design: ${spec.clockN} (shortest way ${k})`);   // a loose clock on purpose ("don't take the clock yet")
  else if (k != null && k !== routeK && !(clockPair && k === routeK - 1)) errors.push(`clock minimum ${k} but the route has ${routeK} (shortest: ${JSON.stringify(cs.path.slice(0, 30))})`);
  d.clock.n = spec.clockN || ((k == null ? routeK : clockPair ? Math.max(k, routeK) : k) + (spec.spare ?? 1));
  if (spec.parkTile != null && k != null) {   // "park the twin": with that tile's picture made unmatchable, the clock is out of reach
    const dn = clone(d); dn.faces[spec.parkTile] = 977; dn.clock.n = 99;
    const st = E.clockShortest(E.game(dn, { strict: true }), { nodes: 3e6, ms: 60000 }), kn = st && !st.unsure ? E.flatten(st.path).indexOf(d.clock.i) + 1 : null;
    out.push('without parking ' + spec.parkTile + ': ' + (kn == null ? 'no way to the clock' : kn + ' moves'));
    if (kn != null && kn <= d.clock.n) errors.push('the clock is reachable without parking ' + spec.parkTile);
  }
  if (spec.peek) {   // is a face-down pair needed? the strict rules (no peeking) must not reach the clock in time
    const st = E.clockShortest(E.game(clone(d), { strict: true }), { nodes: 3e6, ms: 60000 }), ks = st && !st.unsure ? E.flatten(st.path).indexOf(d.clock.i) + 1 : null;
    out.push('without face-down pairs: ' + (ks == null ? 'no way to the clock' : ks + ' moves'));
    if (spec.peekNeeded && ks != null && ks <= d.clock.n) errors.push('the clock is reachable without a face-down pair');
  }
  // twins apart (Dennis 2026-11-13: "Pairs are too much together. Too obvious."): the trap's own pairs are frozen; the stored
  // solution must still replay and the clock minimum stay k (separate.js default validation)
  if (k != null && spec.separate !== false && !spec.peek) {
    const frozen = Object.values(spec.pairs || {}).flat();
    try { const sp = require('./separate.js').separate(d, { seed: o.seed ?? 1, wallMs: o.separateMs ?? 40000, freeze: frozen, k }); d = sp.design; const a = sp.after || {};
      out.push(`twins apart: close ${sp.before?.close?.length ?? '?'} -> ${a.close?.length ?? '?'}, visible at the start ${sp.before?.closeVisible?.length ?? '?'} -> ${a.closeVisible?.length ?? '?'}`);
      const fz = new Set(frozen), stray = (a.closeVisible || []).filter(([u, v]) => !fz.has(u) || !fz.has(v));   // a designed bait pair may sit together
      if (stray.length > 1) errors.push('visible close twins at the start: ' + stray.length);   // one is allowed (the route may need it)
    } catch (e) { out.push('twins apart failed: ' + e.message); }
  }
  if (spec.peek) { global.Layouts = global.Layouts || require('../../../www/layouts.js'); if (!require('../../../www/hard.js').validSolution(E.game(clone(d)), d.solution)) errors.push('stored solution fails (game rules)'); }
  else { const gS = E.game(clone(d), { strict: true }); let s = E.start(gS);
  for (const a of d.solution) { s = E.step(gS, s, a); if (!s) { errors.push('stored solution fails'); break; } }
  if (s && !E.won(gS, s)) errors.push('stored solution does not win'); }
  out.push('clock ' + d.clock.i + ' in ' + d.clock.n + ' (minimum ' + k + ', spare ' + (spec.spare ?? 1) + ')');
  if (spec.peek) { const gP = E.game(clone(d)); let t = E.start(gP); spec.route.forEach((a, n) => { const act = Array.isArray(a) ? { pair: a } : a; try { t = E.step(gP, t, act); } catch (e) { t = null; } out.push(`${n + 1}. ${Array.isArray(a) ? 'face-down pair ' + a.join('+') : 'take ' + a}${a === d.clock.i ? ' = CLOCK' : ''} | tray ${t ? t.tray.join(',') : 'LOST'}`); }); }
  else out.push(...SB.explainRoute(d, spec.route).lines);
  // the designer's wrong moves
  const C = D.clockGames(d), states = []; let t = E.start(C.free); for (const a of spec.route) { states.push(t); t = E.step(C.free, t, Array.isArray(a) ? { pair: a } : a); }
  const w = D.work(2e7, 300000);
  for (const b of spec.baits || []) {
    // at: a goal number (the position before that goal's dig), or 'auto': the first moment on the route all its tiles are free
    const freeAt = t => states[t] && b.take.every(i => E.legal(C.free, states[t]).includes(i));
    // 'full': the first moment on the route with two or more tiles waiting (the cautious player clears the tray there)
    const at = b.at === 'auto' ? states.findIndex((_, t) => freeAt(t)) : b.at === 'full' ? states.findIndex((st, t) => st && st.tray.length >= 2 && freeAt(t)) : spec.goalAt[b.at - 1];
    if (at < 0 || !freeAt(at)) { errors.push('bait ' + b.take.join('+') + ' never free'); out.push('bait ' + b.take.join('+') + ': not free then'); continue; }
    const st = states[at], p = D.priceMove(C, st, { take: b.take }, { nShipMax: d.clock.n + 6, nodes: 1500000, w });
    const bites = p.result === 'lose' || (p.need != null && p.need > d.clock.n);
    out.push(`bait at route move ${at + 1} take ${b.take.join('+')}: ${p.result}${p.need != null ? ' needs ' + p.need : ''} -> ${bites ? 'BITES' : 'harmless'} (${b.why || ''})`);
    if (!bites) errors.push('bait ' + b.take.join('+') + (p.result === 'unknown' ? ' unproven (search budget)' : ' does not bite'));
  }
  let offers = null;
  try { offers = require('./trap_offers.js').offers(d, { wallMs: o.offersMs ?? 90000 }); out.push(`tempting moves on the way: ${offers.tempting}, biting ${offers.biting}, trap moments ${offers.trapMoments}`); } catch (e) { out.push('offers: ' + e.message); }
  return { ok: !errors.length, errors, design: d, report: out.join('\n'), offers, attempt: f.attempt, route: ex.route };
}
/* motifs: the trap as relations between named tiles; place() finds tile ids on a layout that satisfy them.
   spec.vars ['C','L',...]; spec.rel [[kind, a, b?]]: on (a lies on b), iceNb (a melts b), side (a beside b, same layer), top (nothing on a),
   free (free at the start), notFree, layer (a, z), far (a not touching b). route/pairs/ice/locks/keys/baits may name variables. */
function relOk(c, kind, a, b) {
  switch (kind) {
    case 'on': return c.nb.above[b].includes(a);
    case 'onlyOn': return c.nb.above[b].length === 1 && c.nb.above[b][0] === a;
    case 'iceNb': return c.iceNb[b].includes(a);
    case 'side': return c.nb.left[b].includes(a) || c.nb.right[b].includes(a);
    case 'top': return !c.nb.above[a].length;
    case 'notOn': return !c.nb.above[b].includes(a);
    case 'minLayer': return c.tiles[a][2] >= b;
    case 'deep': { const seen = new Set(), st = [a]; while (st.length) for (const j of c.nb.above[st.pop()]) if (!seen.has(j)) { seen.add(j); st.push(j); } return seen.size >= b; }   // at least b tiles lie on a, all the way up
    case 'sideFree': return !c.nb.left[a].length || !c.nb.right[a].length;   // one side empty from the start
    case 'onlySide': return (c.nb.left[b].length === 1 && c.nb.left[b][0] === a) || (c.nb.right[b].length === 1 && c.nb.right[b][0] === a);   // a is all that blocks one side of b
    case 'free': return c.free0.has(a);
    case 'notFree': return !c.free0.has(a);
    case 'layer': return c.tiles[a][2] === b;
    case 'far': return !c.iceNb[b].includes(a) && !c.nb.above[b].includes(a) && !c.nb.above[a].includes(b);
    default: throw Error('unknown relation ' + kind);
  }
}
function place(spec, tiles, o = {}) {
  const g = E.game({ tiles, faces: tiles.map((_, i) => i), down: [], obst: {}, clock: null, solution: [] }, { strict: true });
  const c = { tiles, nb: g.nb, iceNb: g.iceNb, free0: new Set(E.legal(g, E.start(g))) };
  const vars = spec.vars, rel = spec.rel || [], out = [], n = tiles.length;
  let r = ((o.seed ?? 1) >>> 0) || 1; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const unary = vars.map(v => rel.filter(x => x[1] === v && (x.length === 2 || typeof x[2] === 'number')));
  const dom = vars.map((v, k) => [...Array(n).keys()].filter(i => unary[k].every(([kind, , b]) => relOk(c, kind, i, b))).sort(() => rnd() - .5));
  const asg = {}, used = new Set(); let nodes = 0;
  const check = () => rel.every(([kind, a, b]) => typeof b !== 'string' || asg[a] == null || asg[b] == null || relOk(c, kind, asg[a], asg[b]));
  const go = k => {
    if (out.length >= (o.max ?? 20) || ++nodes > (o.nodes ?? 2e5)) return;
    if (k === vars.length) { out.push({ ...asg }); return; }
    for (const i of dom[k]) { if (used.has(i)) continue; asg[vars[k]] = i; used.add(i); if (check()) go(k + 1); used.delete(i); delete asg[vars[k]]; }
  };
  go(0); return out;
}
// a spec written with variable names, made concrete for one placement
function bind(spec, a) {
  const m = x => typeof x === 'string' && a[x] != null ? a[x] : x, mm = l => (l || []).map(m);
  const ice = {}; for (const [k, h] of Object.entries(spec.ice || {})) ice[m(k)] = h;
  const pairs = {}; for (const [k, ids] of Object.entries(spec.pairs || {})) pairs[k] = mm(ids);
  return { ...spec, clock: m(spec.clock), ice, locks: mm(spec.locks), keys: spec.keys && mm(spec.keys), locks2: mm(spec.locks2), keys2: spec.keys2 && mm(spec.keys2),
    route: mm(spec.route), pairs, baits: (spec.baits || []).map(b => ({ ...b, take: mm(b.take) })), placement: a };
}
// try placements until one proves (route legal, exact minimum = route, every bait bites)
function design(spec, o = {}) {
  const L = layouts(), lays = [].concat(spec.layout), tried = [];
  for (const lay of lays) {
    const tiles = L[lay].tiles.map(t => t.slice(0, 3));
    for (const a of place(spec, tiles, { seed: o.seed, max: o.max ?? 30 })) {
      const sp = bind({ ...spec, layout: lay }, a);
      const g = E.game({ tiles, faces: tiles.map(() => 0), down: [], obst: { ice: sp.ice, locks: sp.locks, keys: sp.keys || [], ...(sp.keys2 ? { locks2: sp.locks2, keys2: sp.keys2 } : {}) }, clock: null, solution: [] }, { strict: true });
      const ex = expand(sp, tiles); if (ex.fail) { tried.push('route: ' + ex.fail.replace(/\d+/g, '#')); continue; }
      let p; for (let k = 0; k < (o.seeds ?? spec.seeds ?? 3); k++) { p = prove(sp, { seed: (o.seed ?? 1) + 101 * k, offersMs: o.offersMs ?? 30000 }); if (p.ok || p.fail === ex.fail) break; }
      tried.push(p.ok ? 'ok' : (p.fail || p.errors[0]).replace(/d+/g, '#').slice(0, 60));
      if (p.ok) return { ...p, spec: sp, tried };
    }
  }
  return { ok: false, tried };
}
module.exports = { layouts, show, fill, prove, place, bind, design, expand };
if (require.main === module) {
  const [cmd, a] = process.argv.slice(2), seed = +(process.argv[process.argv.indexOf('--seed') + 1] || 0) || undefined;
  if (cmd === 'info') {   // every tile: position, what lies on it, its side neighbours, its ice neighbours (layout id or board.json)
    const d = /.json$/.test(a) ? JSON.parse(fs.readFileSync(a, 'utf8')).design : { tiles: layouts()[+a].tiles.map(t => t.slice(0, 3)) };
    const g = E.game({ tiles: d.tiles, faces: d.tiles.map(() => 0), down: [], obst: {}, clock: null, solution: [] }, { strict: true }), free = new Set(E.legal(g, E.start(g)));
    d.tiles.forEach((t, i) => console.log(`${i} xyz ${t.join(',')}${free.has(i) ? ' FREE' : ''} | on: ${g.nb.above[i].join(' ') || '-'} | L: ${g.nb.left[i].join(' ') || '-'} R: ${g.nb.right[i].join(' ') || '-'} | ice: ${g.iceNb[i].join(' ')}${d.faces ? ' | p' + d.faces[i] : ''}`));
  }
  else if (cmd === 'show') { const l = layouts()[+a]; console.log(l.shape || l.base || '', l.tiles.length, 'tiles'); console.log(show(l.tiles)); }
  else if (cmd === 'design') {
    const spec = require(path.resolve(a)), r = design(spec, { seed });
    console.log(r.report || ''); console.log(r.ok ? 'OK ' + JSON.stringify(r.spec.placement) : 'NOT OK'); console.log('tried:', JSON.stringify(r.tried.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {})));
    if (r.ok) fs.writeFileSync(path.resolve(a).replace(/.js$/, '.board.json'), JSON.stringify({ spec: r.spec, design: r.design, offers: r.offers }, null, 1));
  }
  else if (cmd === 'prove') {
    const spec = require(path.resolve(a)), r = prove(spec, { seed });
    console.log(r.report || ''); console.log(r.ok ? 'OK' : 'NOT OK: ' + (r.fail || r.errors.join('; ')));
    if (r.design) fs.writeFileSync(path.resolve(a).replace(/\.js$/, '.board.json'), JSON.stringify({ spec, design: r.design, ok: r.ok, errors: r.errors, offers: r.offers }, null, 1));
  }
}
