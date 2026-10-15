/* Predict how each family member does on the levels still ahead of them, with their own test player
   (players/bots.json): first-try chance, and won within 2 and within 4 tries (retries remember
   what the player's memory setting says).
     node predict.js <version> [levels ahead=30] [runs=150] [name] -> players/predict-<version>-<name>.json */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [v] = process.argv.slice(2, 3), ahead = +(process.argv[3] || 30), runs = +(process.argv[4] || 150), only = process.argv[5];
const { bots } = JSON.parse(fs.readFileSync(path.join(__dirname, 'players', 'bots.json'), 'utf8'));
for (const [name, b] of Object.entries(bots)) {
  if (only && name !== only) continue;
  // one file per player (several players can run side by side)
  const file = path.join(__dirname, 'players', `predict-${v}-${name.replace(/[^\w]+/g, '_')}.json`);
  const res = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { level: b.level, persona: b.persona, levels: {} };
  for (let lv = b.level; lv < b.level + ahead; lv++) {
    if (res.levels[lv]) continue;
    const g = lv >= 70 ? B.designed(v, lv) : B.classic(lv, b.aspect);
    const p = { ...Hard.P, ...b.persona }, c = Hard.rateChain(g, runs, 13, p, p.memory, 4);
    res.levels[lv] = { first: +c.first.toFixed(3), two: +c.within[1].toFixed(3), four: +c.within[3].toFixed(3), clock: g.clock ? g.clock.n : 0 };
    fs.writeFileSync(file, JSON.stringify(res));
    console.error(name, lv, JSON.stringify(res.levels[lv]));
  }
}
