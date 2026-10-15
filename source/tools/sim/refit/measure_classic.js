/* Levels 1-74 with the re-fitted test players: 1-69 are made by the game from the screen shape
   (measured for a few shapes), 70-74 come from the level table.
     node measure_classic.js <version> <personas.json> <aspects comma> [runs=300] [part=0] [parts=1] */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [v, pf, asp] = process.argv.slice(2, 5);
const runs = +(process.argv[5] || 300), part = +(process.argv[6] || 0), parts = +(process.argv[7] || 1);
const per = JSON.parse(fs.readFileSync(pf, 'utf8')), aspects = asp.split(',').map(Number);
const file = path.join(__dirname, `classic-${part}.json`);
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
for (let lv = 1; lv <= 74; lv++) {
  if ((lv - 1) % parts !== part) continue;
  for (const a of (lv >= 70 ? ['table'] : aspects)) {
    const key = lv + '|' + a; if (out[key]) continue;
    const g = a === 'table' ? B.designed(v, lv) : B.classic(lv, a);
    const row = { lv, aspect: a, tiles: g.tiles.length, down: g.down.reduce((x, y) => x + y, 0), clock: g.clock ? g.clock.n : 0 };
    for (const [k, p] of Object.entries(per)) row[k] = Hard.rate(g, runs, 3, { ...Hard.P, ...p }).rate;
    out[key] = row; fs.writeFileSync(file, JSON.stringify(out));
    console.error(key, JSON.stringify(row));
  }
}
