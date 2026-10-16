/* How do the move-trained test players lose, compared with the real person on the same boards?
     node diag_losses.js [runs=40] */
'use strict';
const path = require('path');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { PIDS, gamesOf } = require('./mimic_games.js');
const W = require('./mimic/weights.json');
const runs = +(process.argv[2] || 40);
for (const name of Object.keys(PIDS)) {
  const G = gamesOf(name), pl = W.players[name];
  const p = { ...Hard.P, w: pl.w, allMoves: true, flips: true, flipRate: pl.flipRate, peek: 0, end: 12, plan: 10 };
  const real = {}, sim = {}; let simW = 0, moves = 0, realMoves = 0;
  for (const x of G) {
    real[x.why] = (real[x.why] || 0) + 1; realMoves += x.take.filter(i => i >= 0).length / x.g.tiles.length;
    for (let k = 0; k < runs; k++) { const r = Hard.play(x.g, p, 1000 + k * 7919); sim[r.why] = (sim[r.why] || 0) + 1 / runs; if (r.win) simW += 1 / runs; moves += r.moves / x.g.tiles.length / runs; }
  }
  const f = o => Object.entries(o).map(([k, v]) => k + ' ' + (+v.toFixed(1))).join(', ');
  console.log(`${name}: ${G.length} games | real: ${f(real)} | bot: ${f(sim)} | share of tiles taken: real ${(realMoves / G.length).toFixed(2)}, bot ${(moves / G.length).toFixed(2)}`);
}
