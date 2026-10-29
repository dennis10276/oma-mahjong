/* Level factory, step 3: the levels Dennis checks in the lab (Claude, 2026-10-28). Dennis plays only
   the first, the middle and the hardest level of a batch (hardest: the lowest first-try chance of the
   Dennis test player) and says whether the difficulty is right. Writes tools/lab/lab-ideas.js.
     node source/tools/factory/to_lab.js <batch.json>                                               */
'use strict';
const fs = require('fs'), path = require('path');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).sort((a, b) => a.level - b.level);
const first = rows[0], middle = rows[Math.floor((rows.length - 1) / 2)];
// hardest: the most tries for the bot (batches tuned by the bot), else the test player's lowest first try
const hardest = rows.filter(r => r !== first && r !== middle).sort((a, b) => (b.botAvg || 0) - (a.botAvg || 0) || a.dennis.first - b.dennis.first)[0];
const batch = +(process.argv[3] || 1);
const pct = x => Math.round(x * 100) + '%';
const card = (r, role) => ({ id: batch * 1000 + r.level, lv: r.level, kind: 'factory', level: role, shape: r.shape, tiles: r.n,
  title: `${role} of levels ${first.level}-${rows[rows.length - 1].level} · ${r.shape}`,
  idea: r.botAvg ? `Codex's bot needed ${r.bot.join(', ')} tries in three runs (it only sees what you see and remembers earlier tries). The factory aims at ${r.aim.toFixed(1)} tries on average here, more as the levels go up. The alarm clock has ${r.clockSpare} spare move${r.clockSpare === 1 ? '' : 's'}.`
    : `The factory aimed this level at about ${pct(r.target)} first-try wins for the Dennis test player (it measured ${pct(r.dennis.first)}). The alarm clock has ${r.clockSpare} spare move${r.clockSpare === 1 ? '' : 's'}.`,
  specials: { down: r.down, ice: r.ice, locks: r.locks, clockSpare: r.clockSpare },
  m: { Dennisisdebeste: r.dennis, 'Mrs. Doubtfire': r.mrsD }, bot: r.bot, board: r.design });
const ideas = [card(first, 'First'), card(middle, 'Middle'), card(hardest, 'Hardest')];
const LAB = { made: new Date().toISOString(), factory: true, heading: 'Level factory',
  intro: batch > 1 ? `Batch ${batch}: levels ${first.level}-${rows[rows.length - 1].level} again, now tuned to Codex's bot: every level made it fail at least its first try in most runs, and it still cleared every one within 6 tries. New pile shapes without towers, tiles at least 52 px. You only play these three. Is the difficulty right?`
    : `New levels ${first.level}-${rows[rows.length - 1].level}, made by the factory: new pile shapes without towers, tiles at least 52 px, the game's own designer for the deal, tuned to the curve, and checked by the strong bot. You only play these three. Is the difficulty right?`,
  verdict: [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']],
  noteHint: 'Fun? Anything that felt wrong? (optional)', winText: 'Was the difficulty right? Say so in the factory list.',
  ideas };
fs.writeFileSync(path.join(__dirname, '..', 'lab', 'lab-ideas.js'), '/* made by tools/factory/to_lab.js */\nconst LAB_IDEAS = ' + JSON.stringify(LAB) + ';\n');
console.log('lab:', ideas.map(i => i.id + ' ' + i.level).join(', '));
