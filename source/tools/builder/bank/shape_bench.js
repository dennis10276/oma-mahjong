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
      if (SEP.closeTwins(d).visible > base.twins) { const u = D.untwin(d, base.twins, new Set(keep.map((id, k) => (role[id] !== '.' && role[id] !== 'n' && role[id] !== 'R' && role[id] !== 'c' && role[id] !== 't') ? k : null).filter(x => x != null))); d.faces = u.d.faces; }
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
