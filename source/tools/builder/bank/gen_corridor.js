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
    // tiles the clock releases: free once the dig and the clock are gone, not before (the clock variant's holders find their twins there)
    const gone = new Uint8Array(n).fill(1); for (const i of [...dig, c]) gone[i] = 0;
    const freeAfter = new Set(E.legal(g, { alive: gone, tray: [], moves: 0, clockTaken: true }).filter(x => typeof x === 'number'));
    const released = [...freeAfter].filter(i => !free0.has(i));
    // buried twins for holders: outside the dig, not free at the start, not near the clock
    const buried = [...Array(n).keys()].filter(i => !dig.includes(i) && i !== c && !free0.has(i) && depth(i) >= 2 && !g.iceNb[c].includes(i));
    const matchings = function* (ids) {                        // every pairing; with an odd count one tile is a holder (buried twin)
      if (!ids.length) { yield []; return; }
      if (ids.length % 2) { for (let k = 0; k < ids.length; k++) for (const m of matchings(ids.filter((_, j) => j !== k))) yield [[ids[k]], ...m]; return; }
      const [a, ...r2] = ids; for (let k = 0; k < r2.length; k++) for (const m of matchings(r2.filter((_, j) => j !== k))) yield [[a, r2[k]], ...m];
    };
    const jobs = [];
    // o.clockPeek: the late tile is the clock itself ("the clock goes to the tray too": at the full tray its face-down twin is the way)
    for (const L of o.clockPeek ? [c] : dig) for (const F of far.slice().sort(() => rnd() - .5).slice(0, o.farTries ?? 2)) jobs.push([L, F]);
    for (const [L, F] of jobs) {
      if (out.length >= (o.per ?? 2)) break;
      let count = 0;
      // clockPeek: the clock's last blockers (the dig's last 2-3 tiles) are holders with buried twins, so the tray is full when the
      // clock frees in every order; the rest of the dig pairs up
      const tailHold = o.clockPeek ? dig.slice(-3) : [];
      for (const m0 of matchings(dig.filter(i => i !== L && !tailHold.includes(i)))) {
      const m = [...m0, ...tailHold.map(i => [i])];
      if (out.length >= (o.per ?? 2) || ++count > (o.perLF ?? 4000)) break;
      const faces = {}; let pic = 0;
      faces[c] = 99; faces[L] = faces[F] = 60;
      const twinOf = {}, bur = (o.clockPeek ? [...released.sort(() => rnd() - .5), ...buried.filter(i => !released.includes(i)).sort(() => rnd() - .5)] : buried.slice().sort(() => rnd() - .5)); let hk = 0;
      for (const p of (o.clockPeek ? m : m)) { if (p.length === 2) faces[p[0]] = faces[p[1]] = pic++; else { faces[p[0]] = 100 + hk; twinOf[p[0]] = bur[hk++]; } }
      if (Object.values(twinOf).some(x => x == null)) { W('noBuried'); continue; }
      const res = O.orders({ layout, clock: c, limit: dig.length + 2, tiles: [...dig, F], faces, down: [F], max: 30 });
      if (!res.wins.length) { W('noWin'); continue; } if (res.strictWins) { W('notForced'); continue; }
      const firsts = Object.keys(res.firstMoves).map(Number);
      if (!o.clockPeek && (firsts.length > (o.firsts ?? 2) || firsts.some(i => near.includes(i)))) { W('wideStart'); continue; }   // the clock variant's trap is at the end
      // the board: labels from the faces, the route = a winning order, then fill + exact proof on the whole board
      const pairs = {}; for (const [i, f] of Object.entries(faces)) (pairs['p' + f] = pairs['p' + f] || []).push(+i);
      for (const [h, tw] of Object.entries(twinOf)) pairs['p' + faces[h]].push(tw);
      const win = res.wins[0].map(x => typeof x === 'string' ? x.slice(1, -1).split('+').map(Number) : x);
      const spec = { layout, exact: true, peek: true, peekNeeded: true, spare: 1, clock: c, route: win, downTiles: [F], pairs,
        baits: [...near, F].map(i => ({ at: 1, take: [i], why: i === F ? 'take the face-down twin early' : 'start beside the clock' })).filter(b => free0.has(b.take[0])),
        title: L === c ? 'The clock goes to the tray too' : 'Face-down twin at a full tray',
        idea: L === c ? `The clock lies deep; the dig leaves the tray full, so the clock itself would be the 4th tile. Its twin is a face-down tile far away: take them together.` : `The clock lies deep (${dig.length + 2} moves); the dig fills the tray, and a face-down tile far away is the twin you need.`,
        digPairs: 0.3, pressure: 1.8, pattern: 'corridor', gen: { L, F, near, firsts } };
      const p = H.prove(spec, { seed: o.seed, offersMs: 20000 });
      W(p.ok ? 'proved' : 'proveFail:' + (p.fail || p.errors[0]).replace(/d+/g, '#').slice(0, 40));
      if (!p.ok) continue;
      // chain variation: a lock on the late tile, the keys an inside pair of the dig taken before it (gold, or silver when asked)
      let chosen = { spec, design: p.design, offers: p.offers, report: p.report };
      if (o.lock) {
        const before = new Set(res.wins[0].slice(0, res.wins[0].findIndex(x => typeof x === 'string')).filter(x => typeof x === 'number'));
        const keyPairs = Object.values(pairs).filter(ids => ids.length === 2 && ids.every(i => before.has(i)));
        for (const kp of keyPairs.sort(() => rnd() - .5)) {
          const silver = o.lock === 'silver' || (o.lock === 'mix' && rnd() < .5);
          const lk = silver ? { locks2: [L], keys2: kp } : { locks: [L], keys: kp };
          const r2 = O.orders({ layout, clock: c, limit: dig.length + 2, tiles: [...dig, F], faces, down: [F], max: 30, ...lk });
          const f2 = Object.keys(r2.firstMoves).map(Number);
          if (!r2.wins.length || r2.strictWins || f2.length > (o.firsts ?? 2) || f2.some(i => near.includes(i))) { W('lockVariantFails'); continue; }
          const spec2 = { ...spec, ...lk, route: r2.wins[0].map(x => typeof x === 'string' ? x.slice(1, -1).split('+').map(Number) : x),
            title: (silver ? 'Silver' : 'Gold') + ' lock: the face-down pair opens the way', idea: spec.idea + ' The tile that needs the face-down twin is ' + (silver ? 'silver' : 'gold') + '-locked; its keys are part of the dig.', gen: { ...spec.gen, keys: kp, silver } };
          const p2 = H.prove(spec2, { seed: o.seed, offersMs: 20000 });
          W(p2.ok ? 'lockVariant' : 'lockProveFail');
          if (p2.ok) { chosen = { spec: spec2, design: p2.design, offers: p2.offers, report: p2.report }; break; }
        }
      }
      out.push(chosen);
      }
    }
  }
  return out;
}
module.exports = { corridor };
if (require.main === module) {
  const dir = path.resolve(arg('out', 'corridor-out')); fs.mkdirSync(dir, { recursive: true });
  for (const lay of arg('layouts', '1006').split(',').map(Number)) {
    const why = {}, res = corridor(lay, { per: +arg('per', 2), tries: +arg('tries', 300), seed: +arg('seed', 1), why, lock: arg('lock', null), clockPeek: process.argv.includes('--clock-peek') });
    for (const b of res) { const f = path.join(dir, `${lay}-c${b.spec.clock}-L${b.spec.gen.L}-s${arg("seed", 1)}.board.json`); fs.writeFileSync(f, JSON.stringify(b, null, 1)); console.log('wrote', f, '| firsts', b.spec.gen.firsts.join(','), '| route', b.spec.route.flat().length); }
    if (!res.length) console.log('layout', lay, ': none');
    console.log(JSON.stringify(why));
  }
}
