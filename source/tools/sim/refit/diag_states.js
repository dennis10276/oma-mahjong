/* Where do a test player's decisions happen (how many tiles waiting), against the real person on the
   same boards (their recorded decisions)?   node diag_states.js <weights file> [beta=2] [part=recent] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { PIDS, gamesOf } = require('./mimic_games.js');
const W = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), beta = +(process.argv[3] || 2);
const FIX = new Set(['stuckHard', 'clockDead', 'rang', 'overflow']);
const FILE = { Dennisisdebeste: 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', PUK: 'PUK', Gerda: 'Gerda' };
for (const name of Object.keys(PIDS)) {
  const pl = W.players[name], G = gamesOf(name).slice(-Math.ceil(gamesOf(name).length / 4));
  const keys = new Set(G.map(x => x.t));
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', FILE[name] + '.json'), 'utf8'));
  const real = { dec: 0 };
  for (const g of D.games) if (keys.has(g.t)) for (const dc of g.decisions) { if (dc.k < 0 || dc.flip) continue; real.dec++; const k = 't' + Math.min(3, dc.tray); real[k] = (real[k] || 0) + 1; }
  const st = {};
  const p = { ...Hard.P, w: pl.w.map((x, i) => FIX.has(W.feat[i]) ? x : x * beta), allMoves: true, flips: true, flipRate: pl.flipRate, blunder3: pl.blunder3, peek: 0, end: 12, plan: 10, stats: st };
  let wins = 0; for (const x of G) for (let k = 0; k < 20; k++) wins += Hard.play(x.g, p, 77 + k * 13).win / 20;
  const sh = o => ['t0', 't1', 't2', 't3'].map(k => ((o[k] || 0) / o.dec).toFixed(2)).join(' ');
  console.log(`${name} (newest ${G.length} games): share of decisions at 0/1/2/3 waiting  real ${sh(real)}  bot ${sh(st)} | wins real ${G.filter(x => x.won).length} bot ${wins.toFixed(1)}`);
}
