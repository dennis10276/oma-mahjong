/* The dashboard's prediction file from the move-based test players (mbot/final-<name>.json from
   finalize_predict.js), with each player's rolling test (mbot/recal2.json from mbot_recal2.js with
   BOARD=1 SAVE=1: every earlier level predicted before it was played).
     node publish_mbot.js <version> <out file> '<comparable json>' '<previous versions json>'
   comparable: older versions whose results still count for some levels, e.g.
     [{"version":"1.54","levels":[[1,50],[52,52],[70,1000]]}] */
'use strict';
const fs = require('fs'), path = require('path');
const [v, outFile, compS = '[]', prevS = '{}'] = process.argv.slice(2);
const scores = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'analysis', 'archive', 'realdata', 'scores.json'), 'utf8'));
const RECAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'mbot', 'recal2.json'), 'utf8'));
const pidOf = name => Object.keys(scores).find(k => scores[k].name === name);
const players = {}; let runs = null;
for (const name of ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']) {
  const f = path.join(__dirname, 'mbot', `final-${name.replace(/[^A-Za-z]/g, '')}.json`);
  if (!fs.existsSync(f)) continue;
  const p = JSON.parse(fs.readFileSync(f, 'utf8')), pid = pidOf(name);
  if (!pid) throw Error('no player id for ' + name);
  runs = p.model.runs;
  const t = RECAL.res[name];
  players[pid] = {
    name, from: p.from,
    fit: { model: 'move', tries: p.fit.tries, firstTries: p.fit.firstTries, retries: p.fit.retries, levels: p.fit.levels, memory: p.model.memory.map(x => Math.round(x * 100)), correction: p.model.correction,
      test: t ? { levels: t.first.n, expected: Math.round(t.first.predicted), won: t.first.won } : null },
    levels: p.levels,
  };
}
const out = { made: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }), version: v, model: 'move', runs, comparable: JSON.parse(compS), previousVersions: JSON.parse(prevS), players };
fs.writeFileSync(outFile, JSON.stringify(out) + '\n');
console.log(Object.values(players).map(p => `${p.name}: ${Object.keys(p.levels).length} levels from ${p.from}; test ${JSON.stringify(p.fit.test)}`).join('\n'));
