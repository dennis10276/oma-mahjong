/* Choices per situation (tiles waiting, pair known, any face-down tile left to turn over), real vs bot,
   newest quarter of games.   node diag_sit.js <weights file> [beta=2] [names] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { PIDS, gamesOf } = require('./mimic_games.js');
const W = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), beta = +(process.argv[3] || 2);
const names = process.argv[4] ? process.argv[4].split(',') : Object.keys(PIDS);
const FIX = new Set(['stuckHard', 'clockDead', 'rang', 'overflow']);
const FILE = { Dennisisdebeste: 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', PUK: 'PUK', Gerda: 'Gerda' };
for (const name of names) {
  const pl = W.players[name], all = gamesOf(name), G = all.slice(-Math.ceil(all.length / 4)), keys = new Set(G.map(x => x.t));
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', FILE[name] + '.json'), 'utf8')), ix = Object.fromEntries(D.feat.map((f, i) => [f, i]));
  const real = {};
  let rtiles = 0; for (const x of G) rtiles += x.take.filter(i => i >= 0).length;
  for (const g of D.games) if (keys.has(g.t)) for (const dc of g.decisions) {
    if (dc.k < 0) continue; const F = dc.F, c = F[dc.k], t = Math.min(3, dc.tray);
    const mv = F.filter(f => !f[ix.flip]), canFlip = F.some(f => f[ix.flip]);
    const pair = mv.some(f => f[ix.isPair] && !f[ix.overflow]);
    const key = 't' + t + (pair ? 'p' : 'n') + (canFlip ? '' : '-');
    const r = real[key] || (real[key] = { flip: 0, pair: 0, single: 0, fatal: 0, n: 0 }); r.n++;
    r[c[ix.flip] ? 'flip' : c[ix.overflow] ? 'fatal' : c[ix.isPair] ? 'pair' : 'single']++;
  }
  const st = {}; const runs = 20; let tiles = 0;
  const p = { ...Hard.P, w: pl.w.map((x, i) => FIX.has(W.feat[i]) ? x : x * beta), allMoves: true, flips: true, ...(process.env.KINDS === '1' ? { kinds: pl.kinds } : { flipRate: pl.flipRate, blunder3: pl.blunder3 }), peek: 0, end: 12, plan: 10, stats: st };
  let wins = 0; for (const x of G) for (let k = 0; k < runs; k++) { const o = Hard.play(x.g, p, 77 + k * 13); tiles += x.g.tiles.length - o.left; wins += o.win; }
  console.log(`wins real ${G.filter(x => x.won).length}/${G.length} bot ${(wins / runs).toFixed(1)}; tiles taken per game real ${(rtiles / G.length).toFixed(0)} bot ${(tiles / runs / G.length).toFixed(0)}`);
  console.log(`${name}  (per 100 tiles taken: how often in this situation; then flip / pair / single / fatal shares)`);
  const ks = [...new Set([...Object.keys(real), ...Object.keys(st.sit || {})])].sort();
  for (const k of ks) {
    const a = real[k] || { n: 0 }, b = (st.sit || {})[k] || { n: 0 };
    const sh = o => o.n ? ['flip', 'pair', 'single', 'fatal'].map(q => ((o[q] || 0) / o.n).toFixed(2)).join(' ') : '   -   ';
    console.log(`  ${k.padEnd(5)} real ${(100 * a.n / rtiles).toFixed(1).padStart(5)}  ${sh(a)}   | bot ${(100 * b.n / tiles).toFixed(1).padStart(5)}  ${sh(b)}`);
  }
}
