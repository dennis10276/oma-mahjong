#!/usr/bin/env node
'use strict';
/* slot_search.js: repair a compact draft of a released board by exchanging which tile sits in which place.
   (Dennis 2026-11-15: about 60 px tiles for 250-300 "without changing the levels too much especially the traps cant be changed".)
   The pile shape of the draft stays exactly as it is (so its tile size stays); only tiles trade places. The search looks for an
   arrangement where the released board's stored winning route still plays move for move, every special tile (clock, lock, key, ice)
   has the same special tiles above/below/thawing it, and needs the same special tiles gone first (preserve_intent.js roleLink /
   roleCausality). A candidate with no such difference is then put through the full certificate (preserve_intent.verify) and the
   footprint check; only a certified board is written.
     node source/tools/builder/loop/heavy.js --label slots --cores 1 -- node source/tools/builder/bank/slot_search.js --level 296 --draft <draft.json> --out <dir> [--ms 600000] [--seed 1] [--floor 58]
   Reads the released board from source/analysis/builder/footprint60/range-250-300.json. */
const fs = require('fs'), path = require('path');
const E = require('../engine.js'), I = require('../preserve_intent.js'), F = require('../footprint.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const clone = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function search(before, slots, opts = {}) {
  const t0 = Date.now(), wall = opts.ms ?? 600000, a = before.design, n = a.tiles.length, prep = I.prepare(before), roles = prep.roles;
  let seed = (opts.seed ?? 1) >>> 0; const rnd = m => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * m); };
  const ga = prep.g, rel = (g, i, j) => [g.nb.above[i].includes(j), g.nb.above[j].includes(i), !!g.iceH[i] && g.iceNb[i].includes(j), !!g.iceH[j] && g.iceNb[j].includes(i)];
  const pairs = []; for (const i of roles) for (const j of roles) if (i < j) pairs.push([i, j, rel(ga, i, j)]);
  const wantDeps = prep.roleDependencies;
  const legalA = prep.states.map(st => new Set(E.legal(ga, st).filter(x => typeof x === 'number')));
  // how far a candidate is from the released board, and which tiles are involved
  const score = tiles => {
    const d = { ...a, tiles }, g = E.game(clone(d), { strict: true }), bad = new Set(); let J = 0;
    // 1. the stored route, move for move
    let s = E.start(g), step = 0, timing = 0;
    for (; step < a.solution.length; step++) {
      const t = a.solution[step], lb = E.legal(g, s);
      // every special tile can be taken at exactly the moments of the route at which it could in the released board
      const la = legalA[step]; for (const r of roles) if (la.has(r) !== lb.includes(r)) { timing++; bad.add(r); if (!la.has(r)) for (const u of g.nb.above[r]) bad.add(u); }
      if (!lb.includes(t)) break; s = E.step(g, s, t); if (!s) break;
    }
    J += Math.min(6, timing * 0.25);
    if (step < a.solution.length) { J += 3 + (a.solution.length - step) / 4; bad.add(a.solution[step]); for (const u of g.nb.above[a.solution[step]]) bad.add(u); }
    // 2. direct relations between special tiles
    for (const [i, j, w] of pairs) if (!same(rel(g, i, j), w)) { J += 1; bad.add(i); bad.add(j); }
    // 3. which special tiles have to go before which
    const closure = pin => { const st = E.start(g); for (let ch = true; ch;) { ch = false; for (const i of E.legal(g, st)) if (i !== pin && typeof i === 'number') { st.alive[i] = 0; ch = true; } } return st.alive; };
    const memo = new Map(), cl = pin => { if (!memo.has(pin)) memo.set(pin, closure(pin)); return memo.get(pin); };
    for (const [goal, want] of wantDeps) {
      const got = roles.filter(pin => pin !== goal && cl(pin)[goal]).sort((x, y) => x - y);
      if (!same(got, want)) { J += 1; bad.add(goal); for (const p of got) if (!want.includes(p)) bad.add(p); for (const u of g.nb.above[goal]) bad.add(u); }
    }
    return { J, bad: [...bad] };
  };
  let cur = slots.map(t => t.slice()), cs = score(cur), best = { tiles: cur, ...cs }, tried = 0, verified = 0; const fails = {};
  const all = [...Array(n).keys()];
  while (Date.now() - t0 < wall) {
    if (cs.J === 0) {
      verified++;
      const d = { ...clone(a), tiles: cur.map(t => t.slice()) }, v = I.verify(before, { design: d }), fp = F.measure(d, { minimum: opts.floor ?? 58 });
      if (v.ok && fp.ok) return { ok: true, design: d, footprint: fp, tried, verified, ms: Date.now() - t0 };
      for (const e of (v.errors || ['footprint'])) fails[String(e).split(':')[0]] = (fails[String(e).split(':')[0]] || 0) + 1;
      // leave this arrangement: a few random exchanges
      for (let k = 0; k < 4; k++) { const x = rnd(n), y = rnd(n); [cur[x], cur[y]] = [cur[y], cur[x]]; }
      cs = score(cur); continue;
    }
    tried++;
    // exchange a tile involved in a difference with any other tile; accept when not worse (sometimes when slightly worse)
    const x = cs.bad.length && rnd(5) ? cs.bad[rnd(cs.bad.length)] : all[rnd(n)], y = all[rnd(n)]; if (x === y) continue;
    [cur[x], cur[y]] = [cur[y], cur[x]];
    const ns = score(cur);
    if (ns.J <= cs.J || rnd(40) === 0 && ns.J <= cs.J + 1.5) { cs = ns; if (cs.J < best.J) best = { tiles: cur.map(t => t.slice()), ...cs }; }
    else [cur[x], cur[y]] = [cur[y], cur[x]];
    if (tried % 4000 === 0 && cs.J > best.J + 3) { cur = best.tiles.map(t => t.slice()); cs = score(cur); }
  }
  return { ok: false, best: best.J, tried, verified, fails, ms: Date.now() - t0 };
}

if (require.main === module) {
  const ROOT = path.resolve(__dirname, '../../../..'), R = JSON.parse(fs.readFileSync(path.join(ROOT, 'source/analysis/builder/footprint60/range-250-300.json'), 'utf8'));
  const level = +arg('level'), before = R.rows.find(r => r.level === level).before, dj = JSON.parse(fs.readFileSync(path.resolve(arg('draft')), 'utf8')), slots = (dj.design || dj).tiles || dj;
  const out = path.resolve(arg('out', path.join(ROOT, 'source/build/footprint60-250-300/slot-drafts'))); fs.mkdirSync(out, { recursive: true });
  const res = search(before, slots, { ms: +arg('ms', 600000), seed: +arg('seed', 1), floor: +arg('floor', 58) });
  if (res.ok) fs.writeFileSync(path.join(out, `level-${level}.json`), JSON.stringify({ level, design: res.design, footprint: res.footprint, from: 'slot_search', seed: +arg('seed', 1) }));
  console.log(level, res.ok ? `CERTIFIED ${res.footprint.tilePx.toFixed(2)} px, ${res.footprint.rows} rows, after ${res.tried} exchanges` : `no: best distance ${res.best}, ${res.tried} exchanges, ${res.verified} full checks, ${JSON.stringify(res.fails)}`);
}
module.exports = { search };
