#!/usr/bin/env node
'use strict';
/* gen_corridor.js: levels in the pattern of hand board H1 ("The corner holds the twin", Dennis 2026-11-16: "Cool you need the face
   down skill to finish it ... using facedown while having 3 in tray should be used more"), spat out per layout (Dennis: "In the
   end we want to spit out levels not just per 50").
   Pattern (analysis/builder/hand/NOTES.md, slot accounting): the clock deep; the dig's pictures make holders that leave one slot;
   when a late dig tile frees, the tray is full in every order and its twin is a face-down tile far away (a face-down pair is the
   only way on). Kept only when: the face-down pair is forced, at most `firsts` winning first moves, and no free dig tile beside the
   clock starts a win (the natural, goal-directed start loses).
     node source/tools/builder/bank/gen_corridor.js --layouts 1006,1000 --out <dir> [--per 2] [--tries 400] [--seed 1]
   Writes <dir>/<layout>-c<clock>-s<seed>.board.json (hand.js format: spec + design + offers) for every proven board. */
const fs = require('fs'), path = require('path'), E = require('../engine.js'), H = require('./hand.js'), O = require('./orders.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };

function corridor(layout, o = {}) {
  const tiles = H.layouts()[layout].tiles.map(t => t.slice(0, 3)), n = tiles.length;
  const g = E.game({ tiles, faces: tiles.map(() => 0), down: [], obst: {}, clock: null, solution: [] }, { strict: true });
  const free0 = new Set(E.legal(g, E.start(g)));
  const depth = i => { const s = new Set(), st = [i]; while (st.length) for (const j of g.nb.above[st.pop()]) if (!s.has(j)) { s.add(j); st.push(j); } return s.size; };
  let r = (o.seed >>> 0) || 1; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = [], why = o.why || {}, W = k => why[k] = (why[k] || 0) + 1;
  const clocks = [...Array(n).keys()].filter(i => depth(i) >= (o.minDepth ?? 4)).sort(() => rnd() - .5);
  for (const c of clocks) {
    if (out.length >= (o.per ?? 2)) break;
    // the minimal dig: the solver's fewest moves to the clock with every picture the same (the tray never matters then)
    const cs = E.clockShortest(E.game({ tiles, faces: tiles.map(() => 0), down: [], obst: {}, clock: { i: c, n: 99 }, solution: [] }, { strict: true }), { nodes: 4e5, ms: 8000 });
    if (!cs || cs.unsure) { W('expand'); continue; }
    const fl = E.flatten(cs.path), dig = fl.slice(0, fl.indexOf(c)); if (dig.length < (o.minDig ?? 7) || dig.length > 16) { W('digSize'); continue; }
    const near = dig.filter(i => free0.has(i) && (g.iceNb[c].includes(i) || g.nb.above[c].includes(i) || Math.abs(tiles[i][0] - tiles[c][0]) <= 2));
    // the face-down twin: a tile free at the start, outside the dig, far from the clock
    const far = [...free0].filter(i => !dig.includes(i) && i !== c && Math.abs(tiles[i][0] - tiles[c][0]) + Math.abs(tiles[i][1] - tiles[c][1]) >= 6);
    if (!far.length) { W('noFar'); continue; }
    W('clockTried');
    // late tiles: the dig's last half
    const late = dig.slice(-3), early = dig.slice(0, Math.ceil(dig.length / 2));
    // buried twins for holders: outside the dig, not free at the start, not near the clock
    const buried = [...Array(n).keys()].filter(i => !dig.includes(i) && i !== c && !free0.has(i) && depth(i) >= 2 && !g.iceNb[c].includes(i));
    for (let t = 0; t < (o.tries ?? 300) && out.length < (o.per ?? 2); t++) {
      const L = late[Math.floor(rnd() * late.length)], F = far[Math.floor(rnd() * far.length)], faces = {}; let pic = 0;
      faces[L] = faces[F] = 60; faces[c] = 99;
      // holders: two early dig tiles whose twins are buried elsewhere (they hold a slot all the way); the rest pair up inside
      const hold = early.filter(i => i !== L).sort(() => rnd() - .5).slice(0, 1 + (rnd() < .25 ? 1 : 0)), twinOf = {};
      const bur = buried.slice().sort(() => rnd() - .5); if (bur.length < hold.length) { W('noBuried'); continue; }
      hold.forEach((h, k) => { faces[h] = 100 + k; twinOf[h] = bur[k]; });
      const rest = dig.filter(i => i !== L && !hold.includes(i)).sort(() => rnd() - .5);
      for (let k = 0; k + 1 < rest.length; k += 2) faces[rest[k]] = faces[rest[k + 1]] = pic++;
      if (rest.length % 2) { const x = rest[rest.length - 1]; faces[x] = 120; twinOf[x] = bur[hold.length]; if (twinOf[x] == null) { W('noBuried'); continue; } }
      const res = O.orders({ layout, clock: c, limit: dig.length + 2, tiles: [...dig, F], faces, down: [F], max: 30 });
      if (!res.wins.length) { W('noWin'); continue; } if (res.strictWins) { W('notForced'); continue; }
      const firsts = Object.keys(res.firstMoves).map(Number);
      if (firsts.length > (o.firsts ?? 2) || firsts.some(i => near.includes(i))) { W('wideStart'); continue; }
      // the board: labels from the faces, the route = a winning order, then fill + exact proof on the whole board
      const pairs = {}; for (const [i, f] of Object.entries(faces)) (pairs['p' + f] = pairs['p' + f] || []).push(+i);
      for (const [h, tw] of Object.entries(twinOf)) pairs['p' + faces[h]].push(tw);
      const win = res.wins[0].map(x => typeof x === 'string' ? x.slice(1, -1).split('+').map(Number) : x);
      const spec = { layout, exact: true, peek: true, peekNeeded: true, spare: 1, clock: c, route: win, downTiles: [F], pairs,
        baits: [...near, F].map(i => ({ at: 1, take: [i], why: i === F ? 'take the face-down twin early' : 'start beside the clock' })).filter(b => free0.has(b.take[0])),
        title: 'Face-down twin at a full tray', idea: `The clock lies deep (${dig.length + 2} moves); the dig fills the tray, and a face-down tile far away is the twin you need.`,
        digPairs: 0.3, pressure: 1.8, pattern: 'corridor', gen: { L, F, near, firsts } };
      const p = H.prove(spec, { seed: o.seed, offersMs: 20000 });
      W(p.ok ? 'proved' : 'proveFail:' + (p.fail || p.errors[0]).replace(/d+/g, '#').slice(0, 40));
      if (p.ok) out.push({ spec, design: p.design, offers: p.offers, report: p.report });
    }
  }
  return out;
}
module.exports = { corridor };
if (require.main === module) {
  const dir = path.resolve(arg('out', 'corridor-out')); fs.mkdirSync(dir, { recursive: true });
  for (const lay of arg('layouts', '1006').split(',').map(Number)) {
    const why = {}, res = corridor(lay, { per: +arg('per', 2), tries: +arg('tries', 300), seed: +arg('seed', 1), why });
    for (const b of res) { const f = path.join(dir, `${lay}-c${b.spec.clock}-s${arg('seed', 1)}.board.json`); fs.writeFileSync(f, JSON.stringify(b, null, 1)); console.log('wrote', f, '| firsts', b.spec.gen.firsts.join(','), '| route', b.spec.route.flat().length); }
    if (!res.length) console.log('layout', lay, ': none');
    console.log(JSON.stringify(why));
  }
}
