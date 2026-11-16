#!/usr/bin/env node
'use strict';
/* shape_bench.js: Claude's workbench for reshaping a 250-300 level by hand (Dennis 2026-11-16: "Tackle it per pile per trap
   per shape", "Build tools for yourself to reshape levels easily").

   A bench holds the released board (tile ids as released, so every relation can be compared) and a list of edits:
     const B = bench(292)                  released board
     B.show()                              every layer, each tile as <role><id>: C clock, L lock, K key, I ice, B wrong move,
                                           R route to the clock, t thaws ice, c lies on a special, n beside a special, . finish;
                                           lower case x after the id = lies straight on one tile (a tower)
     B.ids(fn)                             ids whose [x,y,z] (and role) match fn(t, i, role)
     B.move(ids, dx, dy, dz)               rigid move;  B.at(id, [x,y,z]);  B.drop(ids) (pairs of one picture)
     B.swap(i, j)                          exchange two pictures;  B.centre()
     B.quick()                             geometry: valid, towers, stray, width x rows, tile px, clock minimum, route plays
     B.prove()                             full winning route + Codex's Task 20 certificate (MECH=1 NARROW_TRAP=core), with the
                                           wrong moves' cost before/after when one changed
     B.save(note)                          footprint60/bench/level-<n>.json (only when proved)
   CLI: MECH=1 NARROW_TRAP=core node shape_bench.js <level> [script.js]   (script gets B; without one: show + quick) */
const fs = require('fs'), path = require('path');
const D = require('./detower.js'), CF = D.CF;
const P = require(CF + 'narrow_proof'), Q = require(CF + 'finish_ten_proof'), G = require(CF + 'narrow_methods'), E = require(CF + '../engine'), F = require(CF + '../footprint'), SEP = require(CF + 'separate');
const OUT = path.resolve(__dirname, '../../../analysis/builder/footprint60/bench');
const clone = x => JSON.parse(JSON.stringify(x));

function bench(level) {
  const before = P.original(level), a = before.design, base = P.prepare(before), n = a.tiles.length, g = E.game(clone(a));
  const sp = [a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number)], bait = (before.card?.trap?.baits || []).flatMap(b => b.tiles);
  const route = a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1);
  const role = new Array(n).fill('.');
  for (const s of sp) { for (const u of g.nb.above[s] || []) role[u] = 'c'; for (const k of ['left', 'right']) for (const u of g.nb[k][s] || []) if (role[u] === '.') role[u] = 'n'; if (g.iceH && g.iceH[s]) for (const u of g.iceNb[s]) role[u] = 't'; }
  for (const r of route) if (role[r] === '.' || role[r] === 'n') role[r] = 'R';
  for (const b of bait) role[b] = 'B';
  for (const k of a.obst.keys) role[k] = 'K'; for (const l of a.obst.locks) role[l] = 'L'; for (const i of Object.keys(a.obst.ice).map(Number)) role[i] = 'I'; role[a.clock.i] = 'C';
  const st = { T: a.tiles.map(t => t.slice()), faces: a.faces.slice(), dropped: new Set(), log: [] };
  const live = () => st.T.map((t, i) => st.dropped.has(i) ? null : t);
  const B = {
    level, before, a, base, role, st,
    ids(fn) { return st.T.map((t, i) => (!st.dropped.has(i) && fn(t, i, role[i])) ? i : null).filter(i => i != null); },
    move(ids, dx = 0, dy = 0, dz = 0) { for (const i of [].concat(ids)) st.T[i] = [st.T[i][0] + dx, st.T[i][1] + dy, st.T[i][2] + dz]; st.log.push(['move', [].concat(ids), dx, dy, dz]); return B; },
    at(i, p) { st.T[i] = p.slice(); st.log.push(['at', i, p]); return B; },
    drop(ids) { for (const i of [].concat(ids)) st.dropped.add(i); st.log.push(['drop', [].concat(ids)]); return B; },
    undrop(ids) { for (const i of [].concat(ids)) st.dropped.delete(i); return B; },
    swap(i, j) { [st.faces[i], st.faces[j]] = [st.faces[j], st.faces[i]]; st.log.push(['swap', i, j]); return B; },
    centre() { const L = live().filter(Boolean), x0 = Math.min(...L.map(t => t[0])), y0 = Math.min(...L.map(t => t[1])); st.T = st.T.map(t => [t[0] - x0, t[1] - y0, t[2]]); return B; },
    design() {
      const keep = st.T.map((_, i) => i).filter(i => !st.dropped.has(i)), idn = new Map(keep.map((id, k) => [id, k])), mp = i => idn.get(i);
      const d = { ...clone(a), tiles: keep.map(i => st.T[i]), faces: keep.map(i => st.faces[i]), down: a.down.filter(i => idn.has(i)).map(mp),
        clock: { i: mp(a.clock.i), n: a.clock.n }, obst: { ice: Object.fromEntries(Object.entries(a.obst.ice).map(([i, h]) => [mp(+i), h])), locks: a.obst.locks.map(mp), keys: a.obst.keys.map(mp) },
        solution: a.solution.filter(i => idn.has(i)).map(mp) };
      return { d, keep };
    },
    show(o = {}) {
      const L = live(), K = new Set(L.filter(Boolean).map(t => t.join(','))), xs = L.filter(Boolean).map(t => t[0]), ys = L.filter(Boolean).map(t => t[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), Z = Math.max(...L.filter(Boolean).map(t => t[2])), out = [];
      for (let z = 0; z <= Z; z++) { out.push('layer ' + z + '   x ' + x0 + '..' + (x1 + 2) + ' (' + (x1 + 2 - x0) / 2 + ' wide)');
        for (let y = y0; y <= y1; y++) { let row = ''; let any = false;
          for (let x = x0; x <= x1; x++) { const i = L.findIndex(t => t && t[0] === x && t[1] === y && t[2] === z); if (i < 0) { row += '    '; continue; } any = true;
            const tw = z > 0 && K.has([x, y, z - 1].join(',')); row += (role[i] + String(i).padStart(2, '0') + (tw ? 'x' : ' ')); }
          if (any || o.all) out.push(String(y).padStart(3) + ' ' + row.replace(/\s+$/, '')); } }
      const s = this.quick({ cheap: true }); out.push(JSON.stringify(s));
      const text = out.join('\n'); if (!o.silent) console.log(text); return text;
    },
    quick(o = {}) {
      const { d } = B.design(), T = d.tiles, sh = D.shape(T), fp = F.measure(d, { minimum: 58 });
      const xs = T.map(t => t[0]), ys = T.map(t => t[1]);
      const r = { tiles: T.length, valid: G.valid(T), towers: sh.straight, stray: sh.stray, edge: sh.edge, mirror: sh.mirror, wide: (Math.max(...xs) + 2 - Math.min(...xs)) / 2, rows: (Math.max(...ys) + 2 - Math.min(...ys)) / 2, px: +fp.tilePx.toFixed(1), fits: fp.ok && Math.max(...xs) + 2 - Math.min(...xs) <= 13 };
      if (o.cheap || !r.valid) return r;
      const cs = E.clockShortest(E.game(clone(d)), { nodes: 1000000, ms: 15000 }); r.clockMin = cs ? (cs.unsure ? '?' : cs.k) : 'none'; r.clockMinReleased = base.k; r.clockN = a.clock.n;
      r.twins = SEP.closeTwins(d).visible + ' (released ' + base.twins + ')';
      return r;
    },
    prove() {
      const { d, keep } = B.design(); if (!G.valid(d.tiles)) return { ok: false, why: 'geometry: overlap or unsupported' };
      if (SEP.closeTwins(d).visible > base.twins) { const u = D.untwin(d, base.twins, new Set(keep.map((id, k) => role[id] !== '.' ? k : null).filter(x => x != null))); d.faces = u.d.faces; }
      const sol = D.route(d); if (!sol) return { ok: false, why: 'no full winning route (clock route or finish)', quick: B.quick() };
      d.solution = sol;
      const cert = Q.certify(before, d, keep, base);
      const r = { ok: cert.ok && D.shape(d.tiles).straight === 0, errors: cert.errors, towers: D.shape(d.tiles).straight, px: cert.footprint && +cert.footprint.tilePx.toFixed(1), k: cert.k };
      if (cert.prices) r.wrongMoves = cert.prices.map(p => ({ tiles: p.tiles, before: p.before && { result: p.before.result, cost: p.before.cost }, after: p.after && { result: p.after.result, cost: p.after.cost } }));
      B.last = { d, keep, cert, r };
      return r;
    },
    save(note) {
      if (!B.last || !B.last.r.ok) throw Error('prove first');
      fs.mkdirSync(OUT, { recursive: true });
      const { d, keep, cert } = B.last;
      fs.writeFileSync(path.join(OUT, `level-${level}.json`), JSON.stringify({ level, ok: true, method: 'reshaped by hand on the bench', note, edits: st.log, design: d, keep, shape: D.strip(D.shape(d.tiles)), px: cert.footprint && +cert.footprint.tilePx.toFixed(1), certificate: cert }, null, 1));
      return path.join(OUT, `level-${level}.json`);
    }
  };
  return B;
}
module.exports = { bench };
// every legal spot for one tile (supported, no overlap, nothing above, no tower, inside the current outline, not sticking out
// of the leaning outline), best guesses first; each is proved; returns the passing spots (the bench keeps the first one).
module.exports.spots = (B, id, o = {}) => {
  const L = () => B.st.T.map((t, i) => (B.st.dropped.has(i) || i === id) ? null : t).filter(Boolean);
  const cur = L(), xs = cur.map(t => t[0]), ys = cur.map(t => t[1]), out = [], home = B.st.T[id];
  const lx = t => t[0] / 2 - t[2] * 0.14, ly = t => t[1] / 2 * 1.24 - t[2] * 0.14, mx = Math.min(...cur.map(lx)), my = Math.min(...cur.map(ly));
  const W0 = o.x0 ?? Math.min(...xs), W1 = o.x1 ?? Math.max(...xs) + 2, Y0 = Math.min(...ys), Y1 = Math.max(...ys) + 2, ZM = o.zmax ?? Math.max(...B.a.tiles.map(t => t[2]));
  const cands = [];
  for (let z = 0; z <= ZM; z++) for (let y = Y0; y + 2 <= Y1; y++) for (let x = W0; x + 2 <= W1; x++) { const p = [x, y, z]; if (!D.brickSpot(cur, p) || lx(p) < mx - 1e-9 || ly(p) < my - 1e-9) continue; cands.push({ p, d: Math.abs(x - home[0]) + Math.abs(y - home[1]) + 2 * Math.abs(z - home[2]) }); }
  cands.sort((p, q) => p.d - q.d);
  for (const c of cands.slice(0, o.max || 40)) { B.st.T[id] = c.p; const r = B.prove(); out.push({ p: c.p, ok: r.ok, errors: r.errors || [r.why] }); if (r.ok && !o.all) break; }
  const good = out.find(r => r.ok); B.st.T[id] = good ? good.p : home; return { good: good && good.p, tried: out.length, out };
};
// load the band method's closest attempt (fewest proof errors) onto the bench: same tile ids, so every edit is relative to it
module.exports.fromBands = (B, o = {}) => {
  process.env.DEBUG = '1'; const r = D.bandRun(B.level, { relaxed: true, tries: o.tries || 6 });
  const c = r.tried.filter(t => t.design && t.errors).sort((p, q) => p.errors.length - q.errors.length)[0];
  if (!c) return null; c.design.tiles.forEach((p, i) => { B.st.T[i] = p.slice(); }); B.st.faces = c.design.faces.slice();
  return { errors: c.errors, W: c.W, parity: c.parity, footprint: c.footprint };
};
// "Same spare" certificate (an option for Dennis, 2026-11-16): the trap's own geometry may make the shortest route to the
// clock a move longer or shorter; the clock number then moves with it so the spare (clock number - shortest route) stays.
// Everything else as Codex's certificate: geometry, footprint, strict win, badges, twins, special prerequisites; each lock
// and ice changes the route by the same number of moves when removed; every wrong move still bites (loses, or costs more
// than the spare); the board's own proof is run with the new route length.
module.exports.spareCertify = (B, d, keep) => {
  const { before, a, base } = B, Q = require(CF + 'finish_ten_proof'), I = require(CF + '../preserve_intent'), V = require(CF + '../verify_trap_mixes');
  const k0 = base.k, spare = a.clock.n - k0, ids = new Map(keep.map((id, i) => [id, i])), mp = i => ids.get(i);
  const k1 = P.kOf(d); if (k1 == null) return { ok: false, errors: ['clock route unproven'] };
  const d1 = { ...d, clock: { ...d.clock, n: k1 + spare } };
  const geo = Q.certify({ ...before, design: { ...a, clock: { ...a.clock, n: k1 + spare } } }, d1, keep, base);
  const errors = (geo.errors || []).filter(e => !/^(clockMinimum|specialEffects|specialPrerequisites|wrongMove|authoredProof|clock$)/.test(e));
  const abl1 = P.ablations(d1).map(([kind, i, kk]) => [kind, i, kk == null ? null : kk - k1]), abl0 = base.abl.map(([kind, i, kk]) => [kind, mp(i), kk == null ? null : kk - k0]);
  if (JSON.stringify(abl1) !== JSON.stringify(abl0) || abl1.some(x => x[2] == null)) errors.push('specialEffects (relative)');
  const norm = x => x.map(([i, r]) => [i, r.slice().sort((p, q) => p - q)]).sort((p, q) => p[0] - q[0]);
  if (JSON.stringify(norm(I.prepare({ design: d1 }).roleDependencies)) !== JSON.stringify(norm(base.prep.roleDependencies.map(([i, r]) => [mp(i), r.map(mp)])))) errors.push('specialPrerequisites');
  const bites = q => q.exact && (q.result === 'lose' || (q.result === 'win' && q.cost > spare)), prices = [];
  for (const b of before.card?.trap?.baits || []) { const o = V.reprice(a, k0, b.tiles, { nodes: 2000000, callMs: 20000 }), n = V.reprice(d1, k1, b.tiles.map(mp), { nodes: 2000000, callMs: 20000 }); prices.push({ tiles: b.tiles, before: { result: o.result, cost: o.cost }, after: { result: n.result, cost: n.cost } }); if (!o.exact || !n.exact || bites(o) !== bites(n)) errors.push('wrongMove:' + b.tiles.join(',')); }
  const own = Q.ownProof({ ...before, design: { ...a, clock: { ...a.clock, n: k1 + spare } } }, d1, keep, k1, { ...base, k: k1 }); if (!own.ok) errors.push('authoredProof:' + own.why);
  return { ok: !errors.length, errors, k0, k1, clockN: [a.clock.n, k1 + spare], spare, wrongMoves: prices, design: d1 };
};
// ---------- understanding the trap first (Dennis 2026-11-16: "understand the exact clock route and its dependencies") ----------
// What holds a tile on a board (ids are the board's own): tiles on it, the two side groups (one side must be empty), the
// thaw neighbours and how many must go (ice), the keys (lock).
function holds(d) {
  const g = E.game(clone(d)), ice = d.obst.ice || {}, keys = d.obst.keys || [], locks = new Set(d.obst.locks || []);
  return d.tiles.map((_, i) => ({ on: (g.nb.above[i] || []).slice().sort((p, q) => p - q), left: (g.nb.left[i] || []).slice().sort((p, q) => p - q), right: (g.nb.right[i] || []).slice().sort((p, q) => p - q),
    ice: ice[i] ? { need: ice[i], of: (g.iceNb[i] || []).slice().sort((p, q) => p - q) } : null, keys: locks.has(i) ? keys.slice() : null }));
}
// The shortest route to the clock, move by move: what each move opens, and the tray after it.
function explainRoute(d, prefix) {
  const g = E.game(clone(d), { strict: true }), H = holds(d), F = d.faces; let s = E.start(g);
  if (!prefix) { const cs = E.clockShortest(E.game(clone(d), { strict: true }), { nodes: 1500000, ms: 20000 }); if (!cs || cs.unsure) return { k: null, lines: ['clock route unproven'] }; const f = E.flatten(cs.path); prefix = f.slice(0, f.indexOf(d.clock.i) + 1); }
  const lines = []; let free0 = new Set(E.legal(g, s));
  let dead = false;
  prefix.forEach((t, n) => {
    if (dead) return;
    if (!E.legal(g, s).includes(t)) { lines.push(`${n + 1}. ${t} NOT TAKEABLE`); dead = true; return; }
    const before = s; s = E.step(g, s, t); if (!s) { lines.push(`${n + 1}. take ${t} [f${F[t]}] LOSES: clock ran out or a 4th tile (tray was ${before.tray.map(i => 'f' + F[i]).join(',')})`); dead = true; return; }
    const free1 = new Set(E.legal(g, s)), opened = [...free1].filter(i => !free0.has(i) && i !== t);
    const why = opened.map(i => { const h = H[i], r = []; if (h.on.includes(t)) r.push('uncovered'); if (h.left.includes(t) || h.right.includes(t)) r.push('side opened'); if (h.ice && h.ice.of.includes(t)) r.push('thawed'); if (h.keys && h.keys.includes(t)) r.push('unlocked'); return i + (r.length ? '(' + r.join(',') + ')' : ''); });
    const iceProgress = Object.keys(d.obst.ice || {}).map(Number).filter(i => H[i].ice.of.includes(t)).map(i => `ice ${i} ${H[i].ice.of.filter(j => !s.alive[j]).length}/${H[i].ice.need}`);
    lines.push(`${n + 1}. take ${t} [f${F[t]}]` + (t === d.clock.i ? ' = CLOCK' : '') + (why.length ? ' -> frees ' + why.join(' ') : '') + (iceProgress.length ? ' | ' + iceProgress.join(' ') : '') + ' | tray ' + s.tray.map(i => 'f' + F[i]).join(','));
    free0 = free1;
  });
  return { k: prefix.length, prefix, lines };
}
// The clock's dependency tree: what must go before each tile on the way can be taken (depth-limited).
function depTree(d, root, depth = 4) {
  const H = holds(d), out = [], seen = new Set();
  const walk = (i, lvl, label) => {
    const h = H[i], parts = [];
    if (h.on.length) parts.push('under ' + h.on.join(','));
    if (h.left.length && h.right.length) parts.push('sides L' + h.left.join(',') + ' R' + h.right.join(','));
    if (h.ice) parts.push(`ice: ${h.ice.need} of ${h.ice.of.join(',')}`);
    if (h.keys) parts.push('keys ' + h.keys.join(','));
    out.push('  '.repeat(lvl) + (label || '') + i + (parts.length ? ': ' + parts.join(' | ') : ': free'));
    if (lvl >= depth || seen.has(i)) return; seen.add(i);
    for (const j of h.on) walk(j, lvl + 1, 'on ');
    if (h.left.length && h.right.length) for (const j of [...h.left, ...h.right]) walk(j, lvl + 1, 'side ');
    if (h.keys) for (const j of h.keys) walk(j, lvl + 1, 'key ');
  };
  walk(root, 0, 'CLOCK '); return out;
}
module.exports.explainRoute = explainRoute; module.exports.holds = holds; module.exports.depTree = depTree;
module.exports.explain = (B, o = {}) => {
  const { d } = B.design(), a = B.a, out = [];
  out.push('== clock route (' + (o.released ? 'released board' : 'this board') + ') ==');
  const r = explainRoute(o.released ? a : d); out.push(...r.lines);
  out.push('== what holds the clock ==', ...depTree(o.released ? a : d, (o.released ? a : d).clock.i, o.depth || 3));
  const dd = o.released ? a : d, F = dd.faces;
  for (const b of B.before.card?.trap?.baits || []) {
    const ids = b.tiles; out.push(`== wrong move ${ids.join('+')} (${b.name || ''}, released: ${b.result}${b.cost != null ? ' cost ' + b.cost : ''}) ==`);
    for (const t of ids) { const twins = F.map((f, i) => f === F[t] && i !== t ? i : null).filter(x => x != null); out.push(`  ${t} [f${F[t]}] twins ${twins.join(',')}`); for (const w of twins) out.push(...depTree(dd, w, 2).map(l => '    ' + l.replace('CLOCK ', 'twin '))); }
  }
  const text = out.join('\n'); if (!o.silent) console.log(text); return text;
};
// What the edits changed in the trap: per special, wrong move and route tile of the released board, its holds before/after.
module.exports.diffDeps = (B, o = {}) => {
  const { d, keep } = B.design(), a = B.a, idn = new Map(keep.map((id, k) => [id, k])), back = k => keep[k];
  const H0 = holds(a), H1 = holds(d), route = a.solution.slice(0, a.solution.indexOf(a.clock.i) + 1);
  const watch = o.all ? a.tiles.map((_, i) => i) : [...new Set([a.clock.i, ...a.obst.keys, ...a.obst.locks, ...Object.keys(a.obst.ice).map(Number), ...(B.before.card?.trap?.baits || []).flatMap(b => b.tiles), ...route])];
  const norm = h => h && JSON.stringify({ on: h.on, l: h.left, r: h.right, ice: h.ice, keys: h.keys });
  const map1 = h => h && ({ on: h.on.map(back).sort((p, q) => p - q), left: h.left.map(back).sort((p, q) => p - q), right: h.right.map(back).sort((p, q) => p - q), ice: h.ice ? { need: h.ice.need, of: h.ice.of.map(back).sort((p, q) => p - q) } : null, keys: h.keys ? h.keys.map(back) : null });
  const out = [];
  for (const i of watch) { if (!idn.has(i)) { out.push(`${i} (${B.role[i]}) DROPPED`); continue; } const h0 = H0[i], h1 = map1(H1[idn.get(i)]); if (norm(h0) !== norm(h1)) out.push(`${i} (${B.role[i]}): ${norm(h0)}  ->  ${norm(h1)}`); }
  if (!o.silent) console.log(out.length ? out.join('\n') : 'no trap dependency changed'); return out;
};
// a spot for one tile that changes nothing in the trap: brick spot, inside the given rows/columns, no trap dependency changed
// (diffDeps empty) and the released route to the clock still plays move by move; best by mirror, low, central
module.exports.safeSpot = (B, id, o = {}) => {
  const home = B.st.T[id], cur = B.st.T.filter((t, i) => i !== id && !B.st.dropped.has(i)), xs = cur.map(t => t[0]), ys = cur.map(t => t[1]);
  const X0 = o.x0 ?? Math.min(...xs), X1 = o.x1 ?? Math.max(...xs) + 2, Y0 = o.y0 ?? Math.min(...ys), Y1 = o.y1 ?? Math.max(...ys) + 2, m = X0 + X1 - 2;
  const lx = t => t[0] / 2 - t[2] * 0.14, ly = t => t[1] / 2 * 1.24 - t[2] * 0.14, mx = Math.min(...cur.map(lx)), my = Math.min(...cur.map(ly));
  const pre = B.a.solution.slice(0, B.a.solution.indexOf(B.a.clock.i) + 1), cands = [];
  for (let z = 0; z <= (o.zmax ?? 2); z++) for (let y = Y0; y + 2 <= Y1; y++) for (let x = X0; x + 2 <= X1; x++) {
    const p = [x, y, z]; if (!D.brickSpot(cur, p) || lx(p) < mx - 1e-9 || ly(p) < my - 1e-9) continue;
    const mir = cur.some(q => q[0] === m - x && q[1] === y && q[2] === z) || m - x === x;
    cands.push({ p, sc: z * 10 - (mir ? 20 : 0) + Math.abs(x + 1 - (X0 + X1) / 2) * 0.5 });
  }
  cands.sort((p, q) => p.sc - q.sc);
  for (const c of cands) {
    B.st.T[id] = c.p; if (module.exports.problems(B).length) continue;
    if (module.exports.diffDeps(B, { silent: true }).length) continue;
    const { d, keep } = B.design(), idn = new Map(keep.map((x, k) => [x, k])), r = explainRoute(d, pre.map(i => idn.get(i)));
    if (r.lines.some(l => /NOT TAKEABLE|LOSES/.test(l))) continue;
    return c.p;
  }
  B.st.T[id] = home; return null;
};
// try sliding single rows (all layers of that row) by small steps: keep the first that passes the full proof; cheap checks first
// (valid, at most 6.5 wide, no trap dependency changed, released route plays, twins not above the released count)
module.exports.nudgeRows = (B, o = {}) => {
  const SEP = require(CF + 'separate'), pre = B.a.solution.slice(0, B.a.solution.indexOf(B.a.clock.i) + 1), ys = [...new Set(B.st.T.map(t => t[1]))].sort((p, q) => p - q), tried = [];
  const cheap = () => { if (module.exports.problems(B).length || B.quick({ cheap: true }).wide > 6.5 || module.exports.diffDeps(B, { silent: true }).length) return false;
    const { d, keep } = B.design(), idn = new Map(keep.map((x, k) => [x, k])); if (SEP.closeTwins(d).visible > B.base.twins) return false;
    return !explainRoute(d, pre.map(i => idn.get(i))).lines.some(l => /NOT TAKEABLE|LOSES/.test(l)); };
  for (const y of o.rows || ys) for (const dx of o.steps || [-1, 1, -2, 2]) {
    const ids = B.ids(t => t[1] === y); B.move(ids, dx, 0, 0);
    if (cheap()) { const keepT = B.st.T.map(t => t.slice()); B.centre(); const r = B.prove(); tried.push({ y, dx, ok: r.ok, errors: r.errors }); if (r.ok) return { y, dx, tried }; B.st.T = keepT; }
    B.move(ids, -dx, 0, 0);
  }
  return { tried };
};
// a wrong move, played out: take it first, then the engine's winning line with clock number n (null: none within budget);
// each move with the tray after it, and where the clock is taken
module.exports.explainBait = (d, take, n, o = {}) => {
  const dd = { ...d, clock: { ...d.clock, n } }, g = E.game(clone(dd)); let s = E.start(g); const F = d.faces, lines = [];
  for (const t of take) { s = E.step(g, s, t); lines.push('take ' + t + ' [f' + F[t] + '] (the wrong move) | tray ' + (s ? s.tray.map(i => 'f' + F[i]).join(',') : 'LOST')); if (!s) return lines; }
  const w = E.winnable(g, s, { nodes: o.nodes || 2000000, ms: o.ms || 20000 }); if (w.result !== 'win') { lines.push('no win with clock ' + n + ': ' + w.result); return lines; }
  const flat = E.flatten(w.path); let k = take.length;
  for (const t of flat.slice(0, o.max || 16)) { const st = E.step(g, s, t); k++; s = st; lines.push(k + '. ' + t + ' [f' + F[t] + ']' + (t === d.clock.i ? ' = CLOCK' : '') + ' | tray ' + (s ? s.tray.map(i => 'f' + F[i]).join(',') : 'LOST')); if (!s) break; }
  return lines;
};
// what makes a board invalid: overlapping pairs and unsupported tiles (by released id)
module.exports.problems = B => {
  const L = B.st.T.map((t, i) => B.st.dropped.has(i) ? null : t), out = [];
  for (let i = 0; i < L.length; i++) { if (!L[i]) continue; for (let j = 0; j < i; j++) if (L[j] && L[i][2] === L[j][2] && Math.abs(L[i][0] - L[j][0]) < 2 && Math.abs(L[i][1] - L[j][1]) < 2) out.push('overlap ' + j + '/' + i);
    if (L[i][2] && !D.supportedAt(L.filter((q, k) => q && k !== i), L[i], -1)) out.push('unsupported ' + i + ' at ' + L[i]); }
  return out;
};
if (require.main === module) {
  const B = bench(+process.argv[2]);
  if (process.argv[3]) { require(path.resolve(process.argv[3]))(B, module.exports); }
  else { B.show(); console.log(JSON.stringify(B.quick())); }
}
