/* What the chosen moves look like (average parts of the chosen pair / single), real vs bot, newest
   quarter of games.   KINDS=1 node diag_pick.js <weights file> [names] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { PIDS, gamesOf } = require('./mimic_games.js');
const W = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const names = process.argv[3] ? process.argv[3].split(',') : Object.keys(PIDS);
const FILE = { Dennisisdebeste: 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', PUK: 'PUK', Gerda: 'Gerda' };
const SHOW = ['tray1', 'tray2', 'tray3', 'depthKnown', 'unknownMates', 'unknownTerm', 'free', 'pairs', 'stuckSoft', 'reveal', 'height', 'blindDown'];
for (const name of names) {
  const pl = W.players[name], all = gamesOf(name), G = all.slice(-Math.ceil(all.length / 4)), keys = new Set(G.map(x => x.t));
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', FILE[name] + '.json'), 'utf8')), ix = Object.fromEntries(D.feat.map((f, i) => [f, i]));
  const real = {};
  for (const g of D.games) if (keys.has(g.t)) for (const dc of g.decisions) {
    if (dc.k < 0) continue; const c = dc.F[dc.k]; if (c[ix.flip] || c[ix.overflow]) continue;
    const kd = c[ix.isPair] ? 'pair' : 'single'; const a = real[kd] || (real[kd] = { n: 0, sum: new Array(D.feat.length).fill(0), opts: 0 });
    a.n++; a.opts += dc.F.filter(f => !f[ix.flip] && !f[ix.overflow] && !!f[ix.isPair] === (kd === 'pair')).length; c.forEach((v, q) => a.sum[q] += Math.min(50, v));
  }
  const st = { feat: {} };
  const p = { ...Hard.P, w: pl.w, allMoves: true, flips: true, kinds: pl.kinds, peek: 0, end: 12, plan: 10, stats: st };
  for (const x of G) for (let k = 0; k < 20; k++) Hard.play(x.g, p, 77 + k * 13);
  console.log(name);
  for (const kd of ['pair', 'single']) {
    const a = real[kd], b = st.feat[kd]; if (!a || !b) continue;
    console.log(`  ${kd}: options of that kind real ${(a.opts / a.n).toFixed(1)} bot ${(b.opts / b.n).toFixed(1)}`);
    console.log('    ' + SHOW.map(f => `${f} ${(a.sum[ix[f]] / a.n).toFixed(2)}/${(b.sum[ix[f]] / b.n).toFixed(2)}`).join('  '));
  }
}
