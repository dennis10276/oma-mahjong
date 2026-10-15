/* The dashboard's prediction file (site/dash/predict.json) from the player bots' predictions.
     node publish_predict.js <version> <out file>
   Keyed by player id; per level: [first try, within 2, within 4, clock moves] as whole percents. */
'use strict';
const fs = require('fs'), path = require('path');
const [v, outFile] = process.argv.slice(2);
const { bots } = JSON.parse(fs.readFileSync(path.join(__dirname, 'players', 'bots.json'), 'utf8'));
const scores = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'analysis', 'archive', 'realdata', 'scores.json'), 'utf8'));
const pidOf = name => Object.keys(scores).find(k => scores[k].name === name);
const pct = x => Math.round(x * 100);
const players = {};
for (const [name, b] of Object.entries(bots)) {
  const f = path.join(__dirname, 'players', `predict-${v}-${name.replace(/[^\w]+/g, '_')}.json`);
  if (!fs.existsSync(f)) continue;
  const p = JSON.parse(fs.readFileSync(f, 'utf8')), pid = pidOf(name);
  if (!pid) throw Error('no player id for ' + name);
  const fit = JSON.parse(fs.readFileSync(path.join(__dirname, 'players', b.from.match(/players\/([^ ]+\.json)/)[1].replace(/^players\//, '')), 'utf8')).data;
  const mem = b.persona.memory;
  players[pid] = {
    name, from: p.level,
    fit: { firstTries: fit.firstTries, retries: fit.retries, levels: fit.levels, memory: Array.isArray(mem) ? mem.map(pct) : pct(mem || 0), blunder: pct(b.persona.blunder || 0) },
    levels: Object.fromEntries(Object.entries(p.levels).map(([lv, x]) => [lv, [pct(x.first), pct(x.two), pct(x.four), x.clock || 0]])),
  };
}
fs.writeFileSync(outFile, JSON.stringify({ made: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }), version: v, players }) + '\n');
console.log(Object.values(players).map(p => `${p.name}: ${Object.keys(p.levels).length} levels from ${p.from}`).join('\n'));
