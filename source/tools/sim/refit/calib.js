/* Calibration check: does a persona win as often on first tries as the real player did, per level band?
   (The likelihood fit in analyze.js also rewards guessing WHICH boards are hard; for level targets
   the average first-try chance is what counts.)
     REVEAL=<n> node calib.js <name> <temps comma> [unknown=0] [clockFocus=4] [runs=100] */
'use strict';
const path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [name, temps] = process.argv.slice(2, 4);
const unknown = +(process.argv[4] || 0), cf = +(process.argv[5] || 4), runs = +(process.argv[6] || 100), reveal = +(process.env.REVEAL || 0);
const A = require('./attempts.json').filter(a => a.name === name && a.at === 1);
const build = a => a.board.kind === 'classic' ? B.classic(a.board.lv, a.board.aspect) : B.designed(a.board.v, a.board.lv);
const bands = [[10, 29], [30, 49], [50, 74], [75, 79], [80, 89], [90, 104]];
const cache = new Map();
for (const t of temps.split(',').map(Number)) {
  const out = [];
  for (const [lo, hi] of bands) {
    const L = A.filter(a => a.lv >= lo && a.lv <= hi); if (!L.length) continue;
    let p = 0; for (const a of L) { const k = a.key + '|' + t; if (!cache.has(k)) cache.set(k, Hard.rate(build(a), runs, 1, { ...Hard.P, temp: t, end: 12, clockFocus: cf, unknown, reveal }).rate); p += cache.get(k); }
    out.push(`${lo}-${hi} n${L.length} real ${(L.filter(a => a.r === 'win').length / L.length).toFixed(2)} bot ${(p / L.length).toFixed(2)}`);
  }
  console.log(`temp ${t}: ` + out.join(' | '));
}
