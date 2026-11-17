#!/usr/bin/env node
'use strict';
/* escape_variant.js: an escape idea on top of a proven corridor board (a board where a face-down pair at a full tray is forced).
     node source/tools/builder/bank/escape_variant.js <base.board.json> <kind> <id> [--title ...]
   kind: ice    the escape F is frozen 1; its melter M (a free neighbour outside the dig) has its twin far away (a visible pair)
         silver the escape F is silver-locked; the silver keys are two free tiles far apart (a visible pair)
         gold   the escape F is gold-locked; the keys are a pair of the dig taken before the face-down pair
   Each extra pair needs a free slot for a moment, so it must happen before the tray fills: the route is re-searched (idea_search,
   pictures of the base kept), and the whole board is proven again. Writes analysis/builder/hand/<id>.board.json. */
const fs = require('fs'), path = require('path'), E = require('../engine.js'), H = require('./hand.js'), I = require('./idea_search.js');
const [base, kind, id] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(path.resolve(base), 'utf8')), s = j.spec, lay = s.layout;
const tiles = H.layouts()[lay].tiles.map(t => t.slice(0, 3));
const g = E.game({ tiles, faces: tiles.map(() => 0), down: [], obst: {}, clock: null, solution: [] }, { strict: true });
const free0 = new Set(E.legal(g, E.start(g)));
const pairStep = s.route.find(x => Array.isArray(x)), F = pairStep.find(i => s.downTiles.includes(i)), L = pairStep.find(i => i !== F);
const used = new Set([...s.route.flat(), ...Object.values(s.pairs).flat()]);
const dist = (a, b) => Math.abs(tiles[a][0] - tiles[b][0]) + Math.abs(tiles[a][1] - tiles[b][1]);
const fixed = {}; for (const [k, ids] of Object.entries(s.pairs)) for (const i of ids) fixed[i] = k;
const spare = [...free0].filter(i => !used.has(i) && i !== s.clock);
let extra = [], specials = {}, title, idea;
if (kind === 'ice') {
  const M = g.iceNb[F].find(i => free0.has(i) && !used.has(i)); const M2 = M != null && spare.find(i => i !== M && dist(i, M) >= 6);
  if (M == null || M2 == null) throw Error('no melter pair for the escape');
  fixed[M] = fixed[M2] = 'melt'; extra = [M, M2]; specials = { ice: { [F]: 1 } };
  title = 'Melt the escape first'; idea = 'At the full tray a face-down twin is the way on, but it is frozen, and melting it is a pair that needs a free slot. Melt it before the tray fills.';
} else if (kind === 'silver') {
  const S1 = spare.find(i => dist(i, F) >= 4), S2 = S1 != null && spare.find(i => i !== S1 && dist(i, S1) >= 6);
  if (S1 == null || S2 == null) throw Error('no silver key pair');
  fixed[S1] = fixed[S2] = 'silver'; extra = [S1, S2]; specials = { locks2: [F], keys2: [S1, S2] };
  title = 'Unlock the escape first'; idea = 'At the full tray a face-down twin is the way on, but it is silver-locked; the silver keys are a pair that needs a free slot. Open it before the tray fills.';
} else if (kind === 'gold') {
  const before = s.route.slice(0, s.route.indexOf(pairStep)).filter(x => typeof x === 'number');
  const kp = Object.values(s.pairs).find(ids => ids.length === 2 && ids.every(i => before.includes(i)));
  if (!kp) throw Error('no dig pair before the face-down pair');
  specials = { locks: [F], keys: kp };
  title = 'The escape is gold-locked'; idea = 'At the full tray a face-down twin is the way on, but it is gold-locked; its keys are two tiles of the dig - take them as a pair before the tray fills.';
} else if (kind === 'freeclock') {
  // the corridor's old clock tile becomes the twin T; a free tile far away is the new clock, with T's picture (fixed clock number)
  const T = s.clock, C = spare.find(i => dist(i, T) >= 6); if (C == null) throw Error('no free far tile for the clock');
  const lab = Object.keys(s.pairs).find(k => s.pairs[k].includes(T)); for (const i of s.pairs[lab]) delete fixed[i]; fixed[T] = fixed[C] = 'clockTwin';
  specials = { freeClock: C };
  title = "Don't take the clock: its twin needs the escape"; idea = 'The clock is free, but its twin lies at the bottom of a dig that fills the tray and needs a face-down escape. Taken first, the clock takes the slot that plan needs.';
} else if (kind === 'silvertail') {
  // a second chain after the clock: two tiles the clock releases (free only once the dig and the clock are gone) - S2 a silver key,
  // G silver-locked; the other silver key S1 lies free from the start. Taking S1 early makes it wait through the whole first chain.
  const gone = new Uint8Array(tiles.length).fill(1); for (const i of [...s.route.flat(), s.clock]) gone[i] = 0;
  const after = new Set(E.legal(g, { alive: gone, tray: [], moves: 0, clockTaken: true }).filter(x => typeof x === 'number'));
  const rel = [...after].filter(i => !free0.has(i) && !used.has(i)); const S1 = spare.find(i => !rel.includes(i));
  if (rel.length < 2 || S1 == null) throw Error('the clock releases fewer than two tiles');
  const [S2, G] = rel; fixed[S1] = fixed[S2] = 'silver'; extra = [S1, S2, G]; specials = { locks2: [G], keys2: [S1, S2], tailGoal: G };
  title = 'The silver key belongs to the second half'; idea = 'After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.';
} else throw Error('kind: ice | silver | gold | freeclock | silvertail');
const fc = specials.freeClock; delete specials.freeClock; const tg = specials.tailGoal; delete specials.tailGoal;
// keep the base board's own specials (ice, gold and silver locks) under the new ones
for (const k of ['ice', 'locks', 'keys', 'locks2', 'keys2']) if (s[k] && specials[k] == null) specials[k] = s[k];
const spec = { id, title, idea, layout: lay, block: [...new Set([...s.route.flat().filter(i => tg != null || i !== s.clock), ...extra])].filter(i => i !== tg), target: tg != null ? tg : s.clock,
  limit: s.route.flat().length + extra.length, fixed, free: [], down: s.downTiles, ...specials,
  tests: [{ name: 'dig', expect: 'win', peekForced: tg == null }, ...(tg != null ? [{ name: 'silverFirst', expect: 'none', gone: [extra[0]], tray0: ['silver'] }] : []), ...(fc != null ? [{ name: 'clockFirst', expect: 'none', gone: [fc], tray0: ['clockTwin'] }] : [])],
  hand: fc != null ? { clock: fc, clockN: s.route.flat().length + 2, peek: true, spare: 1, routeTest: 'dig', routeSuffix: [fc], downTiles: s.downTiles, baits: [{ at: 1, take: [fc], why: 'take the free clock first' }] }
    : { clock: s.clock, peek: true, peekNeeded: true, spare: 1, routeTest: 'dig', downTiles: s.downTiles, ...(tg != null ? { secondChain: true, baits: [{ at: 1, take: [extra[0]], why: 'take the free silver key now' }] } : { baits: [] }) } };
fs.writeFileSync(path.resolve(__dirname, '../../../analysis/builder/hand', id + '.js'), 'module.exports = ' + JSON.stringify(spec, null, 1) + ';\n');
const r = I.search(spec, { tries: 1, debug: true });
if (r.ok) { fs.writeFileSync(path.resolve(__dirname, '../../../analysis/builder/hand', id + '.board.json'), JSON.stringify({ spec: r.spec, design: r.design, offers: r.offers }, null, 1)); console.log('OK', id, JSON.stringify(specials), '|', r.report.split('\n').filter(l => /clock |without/.test(l)).join(' | ')); }
else console.log('NOT OK', id, JSON.stringify(r.why), r.lastReport ? r.lastReport.split('\n').filter(l => !/^\d+\./.test(l)).join(' | ').slice(0, 300) : '');
