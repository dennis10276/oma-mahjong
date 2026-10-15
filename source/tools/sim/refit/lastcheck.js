/* Each player's own test player on the last levels the real player played: how many tries it needs
   (up to 20, remembering like the player) against how many the player needed.
     node lastcheck.js [levels=3] [runs=200] */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const nLast = +(process.argv[2] || 3), runs = +(process.argv[3] || 200);
const { bots } = JSON.parse(fs.readFileSync(path.join(__dirname, 'players', 'bots.json'), 'utf8'));
const A = require('./attempts.json');
const build = a => a.board.kind === 'classic' ? B.classic(a.board.lv, a.board.aspect) : B.designed(a.board.v, a.board.lv);
const out = {};
for (const [name, b] of Object.entries(bots)) {
  const L = A.filter(a => a.name === name);
  const lvs = [...new Set(L.map(a => a.lv))].sort((x, y) => y - x).slice(0, nLast);
  const p = { ...Hard.P, ...b.persona };
  out[name] = lvs.map(lv => {
    const tries = L.filter(a => a.lv === lv).sort((x, y) => x.at - y.at), last = tries[tries.length - 1];
    const realTries = last.r === 'win' ? last.at : null;
    const key = tries[0].key, g = build(tries[0]);           // the board of their first try
    const c = Hard.rateChain(g, runs, 21, p, p.memory, 20);
    // chance the test player needs n tries: within[n-1] - within[n-2]
    const need = c.within.map((w, i) => w - (i ? c.within[i - 1] : 0)), never = 1 - c.within[19];
    const atLeast = n => 1 - (n > 1 ? c.within[n - 2] : 0);
    let med = c.within.findIndex(w => w >= 0.5) + 1; if (!med) med = '>20';
    return { lv, key, real: realTries ? `won at try ${realTries}` : `${tries.length} tries, not won`, first: +c.first.toFixed(2), within2: +c.within[1].toFixed(2), within4: +c.within[3].toFixed(2), median: med,
      chanceOfReal: realTries ? +(need[realTries - 1]).toFixed(3) : null, chanceSoManyOrMore: realTries ? +atLeast(realTries).toFixed(3) : +atLeast(tries.length + 1).toFixed(3) };
  });
  for (const r of out[name]) console.log(name.padEnd(16), r.lv, r.key.padEnd(12), r.real.padEnd(14), '| bot: 1st', r.first, 'within 2', r.within2, 'within 4', r.within4, 'median tries', r.median, '| chance it needs that many or more:', r.chanceSoManyOrMore);
}
fs.writeFileSync(path.join(__dirname, 'players', 'lastcheck.json'), JSON.stringify(out, null, 1));
