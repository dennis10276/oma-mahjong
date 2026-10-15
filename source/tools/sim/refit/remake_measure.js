/* Remake 106-269, step 1: every board of the live table measured with the strong test player for
   a range of alarm-clock budgets (the clock is taken at move `base` along the board's own
   solution; any budget from base on keeps that solution valid).
     node remake_measure.js <version> [from=106] [to=269] [runs=100] [part=0] [parts=1]
   Writes remake-<version>-<part>.json: { lv: { tiles, big, base, n0, rates: { n: strong } } } */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const v = process.argv[2], from = +(process.argv[3] || 106), to = +(process.argv[4] || 269), runs = +(process.argv[5] || 100);
const part = +(process.argv[6] || 0), parts = +(process.argv[7] || 1);
const file = path.join(__dirname, `remake-${v}-${part}.json`);
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const SPREAD = 9;
for (let lv = from; lv <= to; lv++) {
  if ((lv - from) % parts !== part || out[lv]) continue;
  const g = B.designed(v, lv), d = B.tableOf(v).Hard.get(lv);
  const base = d.solution.indexOf(d.clock.i) + 1;
  const rates = {};
  for (let n = base; n < base + SPREAD; n++) rates[n] = Hard.rate({ ...g, clock: { i: d.clock.i, n } }, runs, 11, Hard.persona('strong')).rate;
  out[lv] = { tiles: g.tiles.length, big: g.tiles.length > 88, base, n0: d.clock.n, rates };
  fs.writeFileSync(file, JSON.stringify(out));
  console.error(lv, base, d.clock.n, JSON.stringify(rates));
}
