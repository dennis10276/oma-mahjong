/* Which measure of a board tells apart the first tries a person won from the ones they lost?
   AUC (0.5 = no better than a coin, 1 = perfect) per person, first tries only.
     node disc.js [names] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { triesOf } = require('./pdata.js');
const { kindsAt } = require('./kinds.js');
const names = process.argv[2] ? process.argv[2].split(',') : ['Gerda', 'PUK', 'Dennisisdebeste', 'Mrs. Doubtfire'];
const auc = (xs, ys) => { const P = xs.filter((_, i) => ys[i]), N = xs.filter((_, i) => !ys[i]); let s = 0; for (const p of P) for (const q of N) s += p > q ? 1 : p === q ? 0.5 : 0; return P.length && N.length ? +(s / P.length / N.length).toFixed(2) : null; };
const pool = {};
for (const name of names) {
  const T = triesOf(name).filter(x => x.at === 1), y = T.map(x => x.won);
  const M = {
    'level number (lower = easier)': T.map(x => -x.lv),
    'tiles (fewer = easier)': T.map(x => -x.g.tiles.length),
    'face-down tiles (fewer)': T.map(x => -x.g.down.reduce((a, b) => a + b, 0)),
    'ice/locks (none = easier)': T.map(x => x.g.rules ? 0 : 1),
    'strong test player': T.map(x => Hard.rate(x.g, 40, 5, Hard.persona('strong')).rate),
    'average test player': T.map(x => Hard.rate(x.g, 40, 5, Hard.persona('average')).rate),
    'own habits, care 2': T.map(x => Hard.rate(x.g, 40, 5, { ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 })), allMoves: true, flips: true, kinds: kindsAt(name, x.t), peek: 0, end: 12, plan: 10 }).rate),
    'own habits, care 6': T.map(x => Hard.rate(x.g, 40, 5, { ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp: 6 })), allMoves: true, flips: true, kinds: kindsAt(name, x.t), peek: 0, end: 12, plan: 10 }).rate),
  };
  console.log(`${name}: ${T.length} first tries, ${y.filter(Boolean).length} won`);
  for (const [k, v] of Object.entries(M)) { console.log(`  ${k.padEnd(30)} AUC ${auc(v, y)}`); (pool[k] || (pool[k] = [])).push({ v, y }); }
}
