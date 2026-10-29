/* Planned levels for Dennis in the lab (Claude, 2026-10-29): every kept level of a plan run, with the
   puzzles it was built around.   node source/tools/factory/plan_to_lab.js <plan.jsonl...> <batch no.> */
'use strict';
const fs = require('fs'), path = require('path');
const I = require(path.join(__dirname, '..', 'lab', 'ideas.js'));
const args = process.argv.slice(2), batch = +args.pop();
const rows = args.flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)).filter(r => r.ok).sort((a, b) => a.level - b.level);
const ideas = rows.map(r => ({ id: batch * 1000 + r.level, lv: r.level, kind: 'planned', level: r.recipe.join('+'), shape: r.shape, tiles: r.n,
  title: r.recipe.map(k => I.IDEAS[k].title).join(' + ') + ' · ' + r.shape,
  idea: r.recipe.map(k => I.IDEAS[k].idea).join(' ') + ` The strong bot (it sees only what you see) needed ${r.bot.join(', ')} tries; the clock has ${r.clockSpare} spare moves over the shortest way.`,
  specials: { down: r.down, ice: r.ice, locks: r.locks, clockSpare: r.clockSpare }, m: null, bot: r.bot, board: r.design }));
const LAB = { made: new Date().toISOString(), factory: true, heading: 'Level factory',
  intro: `Batch ${batch}: planned levels. Each is built around the puzzles you rated 4-5 stars in the lab (keys deep under locked partners, a chain of ice to the clock, ice-keys-clock chains, a locked clock), with the clock at the shortest way plus 2. Kept only if the strong bot fails its first try in at least 2 of 3 runs and still finds the way out. Is the difficulty right, and is it fun?`,
  verdict: [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']], noteHint: 'Fun? Did you have to think? (optional)', winText: 'Was the difficulty right? Say so in the factory list.', ideas };
fs.writeFileSync(path.join(__dirname, '..', 'lab', 'lab-ideas.js'), '/* made by tools/factory/plan_to_lab.js */\nconst LAB_IDEAS = ' + JSON.stringify(LAB) + ';\n');
console.log('lab:', ideas.map(i => i.lv + ' ' + i.level + ' bot ' + i.bot.join('/')).join(', '));
