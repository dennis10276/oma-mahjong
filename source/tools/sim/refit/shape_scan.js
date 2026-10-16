/* Levels 1-69 are made by the game from the screen shape: how hard each level is per shape, for
   the average test player. Finds boards that are much harder on some phones than on others.
     node shape_scan.js [from=1] [to=69] [runs=80] > shape-scan.json */
'use strict';
const path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const from = +(process.argv[2] || 1), to = +(process.argv[3] || 69), runs = +(process.argv[4] || 80);
const SHAPES = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.2];
const out = {};
for (let lv = from; lv <= to; lv++) {
  out[lv] = {};
  for (const a of SHAPES) out[lv][a] = Hard.rate(B.classic(lv, a), runs, 9, Hard.persona('average')).rate;
  const v = Object.values(out[lv]), mean = v.reduce((x, y) => x + y, 0) / v.length;
  console.error(lv, 'mean', mean.toFixed(2), 'min', Math.min(...v).toFixed(2), 'at', SHAPES[v.indexOf(Math.min(...v))]);
}
console.log(JSON.stringify(out));
