#!/usr/bin/env node
'use strict';
/* relief_scan.js: can "the sun" happen on a board? (www/js/specials.js obRelief: when no tile can be taken but some uncovered
   tile is frozen or locked, and the tray is not full, ALL ice on the board melts - or, with no ice left, the gold locks open,
   then the silver ones - without a move.) The builder's engine and Hard.validSolution do not know this rule, so a position
   they call a dead end can go on in the real game. This plays the board many times with a sensible random player (never a losing 4th tile, often a match) (the game's rules, face-down
   pairs included) and counts the positions where the sun would shine, with the clock still on the board or after it.
     node source/tools/builder/bank/relief_scan.js <board.json ...> [--runs 20000] */
const fs = require('fs'), path = require('path'), E = require('../engine.js');
global.Layouts = global.Layouts || require('../../../www/layouts.js');
const L = global.Layouts;
function scan(board, runs, seed = 1) {
  const d = JSON.parse(JSON.stringify(board.design)), g = E.game({ ...d, clock: d.clock ? { i: d.clock.i, n: 999 } : null });
  if (!g.rules) return { runs, sun: 0, preClock: 0, examples: [] };
  let r = seed >>> 0 || 1; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  let sun = 0, preClock = 0; const examples = [];
  for (let k = 0; k < runs; k++) {
    let s = E.start(g);
    for (let step = 0; step < g.n; step++) {
      const acts = E.legal(g, s);
      if (!acts.length) {
        const free = [...Array(g.n).keys()].filter(i => L.isFree(i, s.alive, g.nb));
        if (free.length && s.tray.length < 4) { sun++; if (s.alive[g.clock ? g.clock.i : -1]) preClock++; if (examples.length < 3) examples.push({ moves: s.moves, free, clockOn: !!(g.clock && s.alive[g.clock.i]) }); }
        break;
      }
      // a sensible random player: never a losing 4th tile, a match when one is there (half the time), so games go deep
      const next = acts.map(a => { try { return [a, E.step(g, s, a)]; } catch (e) { return [a, null]; } }).filter(x => x[1]);
      if (!next.length) break;
      const match = next.filter(x => x[1].tray.length < s.tray.length || typeof x[0] === 'object'), pool = match.length && rnd() < .5 ? match : next;
      s = pool[Math.floor(rnd() * pool.length)][1];
    }
  }
  return { runs, sun, preClock, examples };
}
module.exports = { scan };
if (require.main === module) {
  const a = process.argv.slice(2), i = a.indexOf('--runs'), runs = i < 0 ? 20000 : +a[i + 1], files = a.filter((x, k) => !x.startsWith('--') && a[k - 1] !== '--runs');
  for (const f of files) {
    const b = JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')), res = scan(b, runs);
    console.log(path.basename(f).padEnd(22), `sun in ${res.sun} of ${res.runs} random games (${res.preClock} with the clock still on)`, res.examples.length ? JSON.stringify(res.examples[0]) : '');
  }
}
