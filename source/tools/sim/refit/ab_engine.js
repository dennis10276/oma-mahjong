/* Outcomes on a person's newest games for: their kinds + engine within the kind, at care levels and
   stuck aversions.   node ab_engine.js <name> [runs=20] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { gamesOf } = require('./mimic_games.js');
const [name, runsS = '20'] = process.argv.slice(2), runs = +runsS;
const W = JSON.parse(fs.readFileSync('mimic/w-k20.json', 'utf8')), pl = W.players[name], F = W.feat, ix = Object.fromEntries(F.map((f, i) => [f, i]));
const all = gamesOf(name), G = all.slice(-Math.ceil(all.length / 4)).filter(x => !(name === 'Gerda' && x.lv === 51));
const ew = (shape, temp, stuck) => { const w = Array.from(Hard.weightsOf({ ...Hard.persona(shape), temp: 1 })); if (stuck < 1000) { w[ix.stuckHard] = -stuck; w[ix.clockDead] = -stuck; w[ix.rang] = -stuck; w[ix.stuckSoft] = Math.max(w[ix.stuckSoft], -stuck); } return w.map(x => x / temp); };
console.log(`${name}: ${G.length} newest games, real wins ${G.filter(x => x.won).length}`);
for (const shape of ['strong']) for (const temp of [1.5, 4, 13]) for (const stuck of [3, 20, 1000]) {
  const p = { ...Hard.P, w: ew(shape, temp, stuck), allMoves: true, flips: true, kinds: pl.kinds, peek: 0, end: 12, plan: 10 };
  let w = 0; for (const x of G) for (let r = 0; r < runs; r++) w += Hard.play(x.g, p, 5 + r * 7919).win / runs;
  console.log(`  temp ${String(temp).padEnd(4)} stuck ${String(stuck).padEnd(5)} -> ${w.toFixed(1)}`);
}
