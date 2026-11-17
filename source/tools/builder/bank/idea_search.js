#!/usr/bin/env node
'use strict';
/* idea_search.js: one trap idea, written by hand as roles + tests, searched and proven (the loop behind the 50 ideas, IDEAS.md).
     node source/tools/builder/bank/idea_search.js <idea.js> [--tries 20000] [--seed 1]
   idea.js exports {
     id, title, idea, layout,
     block: [tile ids that take part (the dig, the trap tiles)], target: tile the tests must reach (the clock, or the clock's twin),
     limit: moves allowed in the tests,
     fixed: { tileId: 'label' }      tiles whose pictures are set by hand (same label = twins; a label used once = waits for a twin
                                     outside the block),
     free: [ids] (default: block minus fixed) tiles whose pictures are searched: pairs among them, the rest wait,
     inside: [min, max] pairs among the free tiles,
     ice, locks, keys, locks2, keys2, down: specials and face-down tiles (orders.js / hand.js meaning),
     tests: [{ name, expect: 'win' | 'none', tray0: ['label'...], peek: bool, tiles: [ids] (default block), firsts: max,
                                     trayMax: n (a win leaves at most n waiting after the clock) }],
     hand: { clock, clockN, spare, peek, peekNeeded, routeTest: test name, routeSuffix: [...], baits: [...], downTiles } }
   A picture set passes when every test gets its expected result. Then each block tile whose twin is outside the block gets a deep
   twin (a tile outside the block that lies under 2+ tiles), the route is a winning order of `routeTest` (+ suffix), and hand.js
   proves the whole board (exact clock, stored solution, the baits). Writes analysis/builder/hand/<id>.board.json. */
const fs = require('fs'), path = require('path'), E = require('../engine.js'), H = require('./hand.js'), O = require('./orders.js');
const DIR = path.resolve(__dirname, '../../../analysis/builder/hand');
function search(idea, o = {}) {
  const tiles = H.layouts()[idea.layout].tiles.map(t => t.slice(0, 3)), n = tiles.length;
  const g = E.game({ tiles, faces: tiles.map(() => 0), down: [], obst: {}, clock: null, solution: [] }, { strict: true });
  const depth = i => { const s = new Set(), st = [i]; while (st.length) for (const j of g.nb.above[st.pop()]) if (!s.has(j)) { s.add(j); st.push(j); } return s.size; };
  const block = new Set(idea.block), fixed = idea.fixed || {}, free = idea.free || idea.block.filter(i => fixed[i] == null);
  const labels = [...new Set(Object.values(fixed))], code = {}; labels.forEach((l, k) => code[l] = 500 + k);
  let r = (o.seed ?? 1) >>> 0 || 1; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const why = {}, W = k => why[k] = (why[k] || 0) + 1;
  for (let t = 0; t < (o.tries ?? 20000); t++) {
    const faces = {}; for (const [i, l] of Object.entries(fixed)) faces[i] = code[l];
    const ids = free.slice().sort(() => rnd() - .5), [lo, hi] = idea.inside || [1, Math.floor(free.length / 2)];
    const inside = lo + Math.floor(rnd() * (hi - lo + 1));
    for (let k = 0; k < inside && 2 * k + 1 < ids.length; k++) faces[ids[2 * k]] = faces[ids[2 * k + 1]] = k;
    for (let k = 2 * inside; k < ids.length; k++) faces[ids[k]] = 100 + k;
    let ok = true, results = {};
    for (const ts of idea.tests) {
      const q = { layout: idea.layout, clock: ts.target ?? idea.target, limit: ts.limit ?? idea.limit, tiles: ts.tiles || idea.block, faces,
        down: ts.down ?? idea.down ?? [], ice: idea.ice, locks: idea.locks, keys: idea.keys, locks2: idea.locks2, keys2: idea.keys2,
        tray0: ts.goneFaces ? (() => { const tr = []; for (const i of ts.gone) { const f = faces[i], q = tr.indexOf(f); if (q >= 0) tr.splice(q, 1); else tr.push(f); } return tr; })() : (ts.tray0 || []).map(l => code[l]),   // goneFaces: the tray holds whatever pictures the gone tiles have in this candidate
        gone: ts.gone, max: 20, peek: ts.peek !== false, trayMax: ts.trayMax };
      const res = O.orders(q); results[ts.name] = res;
      const got = res.wins.length ? 'win' : 'none';
      if (got !== ts.expect) { ok = false; W(ts.name + ':' + got); break; }
      if (ts.firsts != null && Object.keys(res.firstMoves).length > ts.firsts) { ok = false; W(ts.name + ':wide'); break; }
      if (ts.peekForced && res.strictWins) { ok = false; W(ts.name + ':notForced'); break; }
    }
    if (!ok) continue;
    W('passed');
    // the whole board: twins outside the block go deep; labels for every block tile
    const groups = {}; for (const [i, f] of Object.entries(faces)) (groups[f] = groups[f] || []).push(+i);
    // deep twins: under 2+ tiles, none of them in the block (the dig must never uncover a twin and release a waiting tile)
    const over = i => { const s2 = new Set(), st = [i]; while (st.length) for (const j of g.nb.above[st.pop()]) if (!s2.has(j)) { s2.add(j); st.push(j); } return s2; };
    const deep = [...Array(n).keys()].filter(i => !block.has(i) && depth(i) >= 2 && fixed[i] == null && i !== idea.hand.clock && !(idea.hand.downTiles || []).includes(i) && ![...over(i)].some(j => block.has(j) || j === idea.target)).sort(() => rnd() - .5);
    const pairs = {}; let d = 0, short = false;
    for (const [f, ids] of Object.entries(groups)) {
      if (ids.length % 2) { if (d >= deep.length) { short = true; break; } ids.push(deep[d++]); }
      pairs['g' + f] = ids;
    }
    if (short) { W('noDeepTwins'); continue; }
    const res = results[idea.hand.routeTest];
    let route = [...res.wins[0].map(x => typeof x === 'string' ? x.slice(1, -1).split('+').map(Number) : x), ...(idea.hand.routeSuffix || [])], tail;
    // a second chain: the winning order runs past the clock (target after it): the route ends at the clock, the rest is the fixed tail
    const ck = route.findIndex(x => x === idea.hand.clock || (Array.isArray(x) && x.includes(idea.hand.clock)));
    if (idea.hand.secondChain && ck >= 0) { tail = route.slice(ck + 1); route = route.slice(0, ck + 1); }
    const spec = { ...idea.hand, title: idea.title, idea: idea.idea, layout: idea.layout, exact: true, route, ...(tail ? { tail } : {}), pairs,
      ice: idea.ice, locks: idea.locks, keys: idea.keys, locks2: idea.locks2, keys2: idea.keys2, digPairs: .3, pressure: idea.hand.pressure ?? 1.6 };
    const p = H.prove(spec, { seed: o.seed, offersMs: 20000 });
    W(p.ok ? 'proved' : 'proveFail:' + (p.fail || p.errors[0]).replace(/\d+/g, '#').slice(0, 50));
    if (p.ok) return { ok: true, spec, design: p.design, offers: p.offers, report: p.report, why, tries: t + 1 };
    if (o.debug && p.report) { o.lastReport = p.report; o.lastSpec = spec; }
  }
  return { ok: false, why, lastReport: o.lastReport, lastSpec: o.lastSpec };
}
// the minimal dig to tile c on a layout (the solver's fewest moves with every picture equal), and the free tiles far from c
function dig(layout, c, far = 6) {
  const tiles = H.layouts()[layout].tiles.map(t => t.slice(0, 3));
  const g = E.game({ tiles, faces: tiles.map(() => 0), down: [], obst: {}, clock: { i: c, n: 99 }, solution: [] }, { strict: true });
  const cs = E.clockShortest(g, { nodes: 4e5, ms: 8000 }), fl = E.flatten(cs.path), d = fl.slice(0, fl.indexOf(c));
  const free0 = E.legal(g, E.start(g)).filter(i => typeof i === 'number');
  return { dig: d, far: free0.filter(i => !d.includes(i) && i !== c && Math.abs(tiles[i][0] - tiles[c][0]) + Math.abs(tiles[i][1] - tiles[c][1]) >= far) };
}
module.exports = { search, dig };
if (require.main === module) {
  const a = process.argv.slice(2), arg = (k, v) => { const i = a.indexOf('--' + k); return i < 0 ? v : a[i + 1]; };
  const idea = require(path.resolve(a[0])), r = search(idea, { tries: +arg('tries', 20000), seed: +arg('seed', 1), debug: a.includes('--debug') });
  console.log(JSON.stringify(r.why));
  if (r.ok) {
    console.log(r.report.split('\n').filter(l => !/^\d+\. take/.test(l)).join('\n'));
    fs.writeFileSync(path.join(DIR, idea.id + '.board.json'), JSON.stringify({ spec: r.spec, design: r.design, offers: r.offers }, null, 1));
    console.log('OK ->', idea.id + '.board.json after', r.tries, 'picture sets');
  } else { console.log('NOT FOUND'); if (r.lastReport) console.log('last failed proof:', r.lastReport.split(String.fromCharCode(10)).filter(l => !/^d+. take/.test(l)).join(' | '), 'route', JSON.stringify(r.lastSpec.route)); }
}
