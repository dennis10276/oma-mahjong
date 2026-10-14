/* Fit the test player (www/hard.js) to how real players did: their levels are made again exactly
   as their phones made them (screen shape found from the tile counts in their play log), the test
   player plays each one many times, and we compare its win chance per try with their real tries.
     node tools/sim/calibrate.js            (uses tools/sim/real.json, an export of their play logs) */
'use strict';
const { game } = require('./levels.js');
const H = require('../../www/hard.js');
const real = require('./real.json');
const WHO = { dennis: { name: 'Dennisisdebeste', aspect: 1.5 }, doubt: { name: 'Mrs. Doubtfire', aspect: 1.6 } };
const temps = (process.argv[2] || '0.3,0.6,1,1.5,2.2,3,4.5').split(',').map(Number);
const RUNS = +(process.argv[3] || 80);
const cache = {};
const out = {};
for (const [who, w] of Object.entries(WHO)) {
  // their tries per level: wins and losses (restarts are left out: no result)
  const lv = {};
  for (const e of real[who]) if (e.k === 'end' && e.lv >= 50 && e.lv <= 74 && e.r !== 'restart') { (lv[e.lv] = lv[e.lv] || { w: 0, l: 0, first: null }); e.r === 'win' ? lv[e.lv].w++ : lv[e.lv].l++; if (lv[e.lv].first === null) lv[e.lv].first = e.r === 'win' ? 1 : 0; }
  const levels = Object.keys(lv).map(Number).sort((a, b) => a - b);
  const realWin = levels.reduce((a, l) => a + lv[l].w, 0) / levels.reduce((a, l) => a + lv[l].w + lv[l].l, 0);
  const res = [];
  for (const t of temps) {
    const p = { ...H.P, temp: t };
    let ll = 0, exp = 0, tries = 0; const per = {};
    for (const l of levels) {
      const k = w.aspect + ':' + l; const g = cache[k] || (cache[k] = game(l, w.aspect));
      const q = Math.min(0.98, Math.max(0.02, H.rate(g, RUNS, 1, p).rate));
      per[l] = q;
      ll += lv[l].w * Math.log(q) + lv[l].l * Math.log(1 - q);
      exp += q * (lv[l].w + lv[l].l); tries += lv[l].w + lv[l].l;
    }
    res.push({ t, ll: +ll.toFixed(1), botWin: +(exp / tries).toFixed(2), per });
  }
  res.sort((a, b) => b.ll - a.ll);
  out[who] = { name: w.name, levels: levels.length, realWin: +realWin.toFixed(2), best: res[0], all: res.map(r => ({ t: r.t, ll: r.ll, botWin: r.botWin })), real: lv };
  console.log(w.name, 'levels', levels.length, 'real win per try', realWin.toFixed(2));
  for (const r of res.slice().sort((a, b) => a.t - b.t)) console.log('  temp', r.t, 'bot win', r.botWin, 'loglik', r.ll);
}
require('fs').writeFileSync(__dirname + '/calibration.json', JSON.stringify(out, null, 1));
