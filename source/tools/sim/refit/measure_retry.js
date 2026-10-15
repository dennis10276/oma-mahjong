/* Won within two tries, for every level of a table: the second try remembers the lost first try
   (strong: everything it saw, like Dennisisdebeste; average: nothing, like Mrs. Doubtfire; sensible: half).
     node measure_retry.js <version> <personas.json> [from=75] [to=269] [runs=200] [part=0] [parts=1] */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [v, pf] = process.argv.slice(2, 4);
const from = +(process.argv[4] || 75), to = +(process.argv[5] || 269), runs = +(process.argv[6] || 200);
const part = +(process.argv[7] || 0), parts = +(process.argv[8] || 1);
const per = JSON.parse(fs.readFileSync(pf, 'utf8')), MEM = { strong: 1, sensible: 0.5, average: 0 };
const file = path.join(__dirname, `retry-${v}-${part}.json`);
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
for (let lv = from; lv <= to; lv++) {
  if ((lv - from) % parts !== part || out[lv]) continue;
  const g = B.designed(v, lv), row = {};
  for (const [k, p] of Object.entries(per)) { const r = Hard.rate2(g, runs, 9, { ...Hard.P, ...p }, MEM[k]); row[k] = { first: r.first, two: r.two }; }
  out[lv] = row; fs.writeFileSync(file, JSON.stringify(out));
  console.error(lv, JSON.stringify(row));
}
