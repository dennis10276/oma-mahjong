/* Step 3: the live level table measured with the re-fitted honest test players.
     node measure_table.js <version> <personas.json> [from=75] [to=269] [runs=200] [part=0] [parts=1]
   personas.json: { name: { temp, end, clockFocus } }. Writes table-<version>-<part>.json. */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [v, pf] = process.argv.slice(2, 4);
const from = +(process.argv[4] || 75), to = +(process.argv[5] || 269), runs = +(process.argv[6] || 200);
const part = +(process.argv[7] || 0), parts = +(process.argv[8] || 1);
const per = JSON.parse(fs.readFileSync(pf, 'utf8'));
const file = path.join(__dirname, `table-${v}-${part}.json`);
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
for (let lv = from; lv <= to; lv++) {
  if ((lv - from) % parts !== part || out[lv]) continue;
  const g = B.designed(v, lv), row = { tiles: g.tiles.length, down: g.down.reduce((a, b) => a + b, 0), clock: g.clock ? g.clock.n : 0 };
  for (const [k, p] of Object.entries(per)) row[k] = Hard.rate(g, runs, 3, { ...Hard.P, ...p }).rate;
  out[lv] = row;
  fs.writeFileSync(file, JSON.stringify(out));
  console.error(lv, JSON.stringify(row));
}
