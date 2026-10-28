/* Level factory, step 3: the levels Dennis checks in the lab (Claude, 2026-10-28). Dennis plays only
   the first, the middle and the hardest level of a batch (hardest: the lowest first-try chance of the
   Dennis test player) and says whether the difficulty is right. Writes tools/lab/lab-ideas.js.
     node source/tools/factory/to_lab.js <batch.json>                                               */
'use strict';
const fs = require('fs'), path = require('path');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).sort((a, b) => a.level - b.level);
const first = rows[0], middle = rows[Math.floor((rows.length - 1) / 2)];
const hardest = rows.filter(r => r !== first && r !== middle).sort((a, b) => a.dennis.first - b.dennis.first)[0];
const pct = x => Math.round(x * 100) + '%';
const card = (r, role) => ({ id: r.level, lv: r.level, kind: 'factory', level: role, shape: r.shape, tiles: r.n,
  title: `${role} of levels ${first.level}-${rows[rows.length - 1].level} · ${r.shape}`,
  idea: `The factory aimed this level at about ${pct(r.target)} first-try wins for the Dennis test player (it measured ${pct(r.dennis.first)}; on levels 92-163 that player came out 8 points below your real first tries). Mrs. Doubtfire's test player clears it within 4 tries ${pct(r.mrsD.four)} of the time. The alarm clock has ${r.clockSpare} spare move${r.clockSpare === 1 ? '' : 's'}.`,
  specials: { down: r.down, ice: r.ice, locks: r.locks, clockSpare: r.clockSpare },
  m: { Dennisisdebeste: r.dennis, 'Mrs. Doubtfire': r.mrsD }, bot: r.bot, board: r.design });
const ideas = [card(first, 'First'), card(middle, 'Middle'), card(hardest, 'Hardest')];
const LAB = { made: new Date().toISOString(), factory: true, heading: 'Level factory',
  intro: `New levels ${first.level}-${rows[rows.length - 1].level}, made by the factory: new pile shapes without towers, tiles at least 52 px, the game's own designer for the deal, tuned to the curve, and checked by the strong bot (it cleared each within 3 tries, seeing only what a person sees). You only play these three. Is the difficulty right for where they sit in the game?`,
  verdict: [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']],
  noteHint: 'Fun? Anything that felt wrong? (optional)', winText: 'Was the difficulty right? Say so in the factory list.',
  ideas };
fs.writeFileSync(path.join(__dirname, '..', 'lab', 'lab-ideas.js'), '/* made by tools/factory/to_lab.js */\nconst LAB_IDEAS = ' + JSON.stringify(LAB) + ';\n');
console.log('lab:', ideas.map(i => i.id + ' ' + i.level).join(', '));
