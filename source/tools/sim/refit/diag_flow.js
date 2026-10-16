/* Per tile taken: how often a person (recorded) and their test player go from 2 to 3 waiting, take a
   single tile without knowing its twin, and how a game at 3 waiting ends. Newest quarter of games.
     node diag_flow.js <weights file> [beta=2] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { PIDS, gamesOf } = require('./mimic_games.js');
const W = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), beta = +(process.argv[3] || 2);
const FIX = new Set(['stuckHard', 'clockDead', 'rang', 'overflow']);
const FILE = { Dennisisdebeste: 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', PUK: 'PUK', Gerda: 'Gerda' };
for (const name of Object.keys(PIDS)) {
  const pl = W.players[name], all = gamesOf(name), G = all.slice(-Math.ceil(all.length / 4)), keys = new Set(G.map(x => x.t));
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', FILE[name] + '.json'), 'utf8')), ix = Object.fromEntries(D.feat.map((f, i) => [f, i]));
  const R = { tiles: 0, enter3: 0, blind: 0, singles: 0, pairs: 0, games: 0, lost: 0 };
  for (const g of D.games) if (keys.has(g.t)) {
    R.games++; if (g.end !== 'win') R.lost++;
    for (const dc of g.decisions) { if (dc.k < 0 || dc.flip) continue; const c = dc.F[dc.k]; if (c[ix.isPair]) R.pairs++; else { R.singles++; if (c[ix.unknownMates] > 0 || c[ix.blindDown]) R.blind++; } if (dc.tray < 3 && c[ix.tray3]) R.enter3++; }
  }
  for (const x of G) R.tiles += x.take.filter(i => i >= 0).length;
  const st = {}; let tiles = 0, wins = 0; const runs = 20;
  const p = { ...Hard.P, w: pl.w.map((x, i) => FIX.has(W.feat[i]) ? x : x * beta), allMoves: true, flips: true, flipRate: pl.flipRate, blunder3: pl.blunder3, peek: 0, end: 12, plan: 10, stats: st };
  for (const x of G) for (let k = 0; k < runs; k++) { const o = Hard.play(x.g, p, 77 + k * 13); tiles += x.g.tiles.length - o.left; wins += o.win; }
  const per = (v, t) => (100 * v / t).toFixed(1);
  console.log(`${name}: per 100 tiles taken  | to 3 waiting: real ${per(R.enter3, R.tiles)} bot ${per(st.enter3 || 0, tiles)} | single tile, twin unknown: real ${per(R.blind, R.tiles)} bot ${per(st.blindSingle || 0, tiles)} | pairs: real ${per(R.pairs, R.tiles)} bot ${per(st.pair || 0, tiles)}`);
  console.log(`   wins real ${G.filter(x => x.won).length}/${G.length} bot ${(wins / runs).toFixed(1)} | bot deaths per game: fatal-4th habit ${((st.dieB3 || 0) / runs / G.length).toFixed(2)}, chose a 4th ${((st.dieSoft || 0) / runs / G.length).toFixed(2)}, nothing left ${((st.dieNone || 0) / runs / G.length).toFixed(2)}`);
}
