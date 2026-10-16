/* Follow one real game move by move; after each move, the person's own test player plays on from that
   position (runs games). Shows where the chance jumps.   node follow_win.js <name> <level> [weights] [runs=40] [try] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { gamesOf } = require('./mimic_games.js');
const [name, lvS, wf = 'mimic/w-k20.json', runsS = '40', trS] = process.argv.slice(2);
const W = JSON.parse(fs.readFileSync(wf, 'utf8')), pl = W.players[name], runs = +runsS;
const x = gamesOf(name).filter(g => g.lv === +lvS && (!trS || g.at === +trS)).find(g => g.won) || gamesOf(name).find(g => g.lv === +lvS);
console.log(`${name} level ${lvS} try ${x.at}: ${x.won ? 'won' : 'lost'}, ${x.take.length} steps (negative = turned a tile over)`);
const p = { ...Hard.P, w: pl.w, allMoves: true, flips: true, kinds: pl.kinds, peek: 0, end: 12, plan: 10 };
let last = null; const out = [];
for (let s = 0; s <= x.take.length; s++) {
  const pre = x.take.slice(0, s);
  if (s && pre[s - 1] < 0) continue;                       // only after real moves
  const start = pre.filter(i => i >= 0);
  // the tiles turned over so far are known (peeked) when it plays on
  const g = { ...x.g, start, peekedAtStart: pre.filter(i => i < 0).map(i => -i - 1) };
  let w = 0; for (let k = 0; k < runs; k++) w += Hard.play(g, p, 31 + k * 977).win;
  const q = w / runs;
  if (last === null || Math.abs(q - last) >= 0.15 || s === x.take.length) out.push(`after ${start.length} tiles (step ${s}): ${(q * 100).toFixed(0)}%`);
  last = q;
}
console.log(out.join('\n'));
