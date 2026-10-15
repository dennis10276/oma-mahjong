/* Retries: how often real players win the next try after losing one, against the test player with
   memory of the lost try (each picture it saw remembered with chance memP).
     node retry_fit.js <player name> <persona> <memPs comma> [runs=100] */
'use strict';
const path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [name, persona, mps] = process.argv.slice(2, 5);
const runs = +(process.argv[5] || 100);
const A = require('./attempts.json').filter(a => a.name === name);
const build = a => a.board.kind === 'classic' ? B.classic(a.board.lv, a.board.aspect) : B.designed(a.board.v, a.board.lv);
// tries that come right after a lost try on the same board
const byKey = {}; for (const a of A) (byKey[a.key] = byKey[a.key] || []).push(a);
const retries = [];
for (const list of Object.values(byKey)) { list.sort((x, y) => x.at - y.at); for (let k = 1; k < list.length; k++) if (list[k - 1].r !== 'win' && list[k].at === list[k - 1].at + 1) retries.push(list[k]); }
const keys = [...new Set(retries.map(a => a.key))];
const out = { name, persona, retries: retries.length, realWins: retries.filter(a => a.r === 'win').length, boards: keys.length, fits: [] };
const cache = {};
for (const mp of mps.split(',').map(Number)) {
  let pred = 0, ll = 0, firstPred = 0;
  for (const a of retries) {
    const k = a.key + '|' + mp;
    if (!cache[k]) cache[k] = Hard.rate2(build(a), runs, 5, Hard.persona(persona), mp);
    const p = Math.min(0.99, Math.max(0.01, cache[k].second === null ? cache[k].first : cache[k].second));
    pred += p; firstPred += cache[k].first; ll += Math.log(a.r === 'win' ? p : 1 - p);
  }
  out.fits.push({ memP: mp, predictedWins: +pred.toFixed(1), ll: +ll.toFixed(1), firstTryChanceSameBoards: +(firstPred / retries.length).toFixed(2) });
  console.error(JSON.stringify(out.fits[out.fits.length - 1]));
}
console.log(JSON.stringify(out));
