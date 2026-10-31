/* Planned levels for Dennis in the lab (Claude, 2026-10-29): every kept level of a plan run, with the
   puzzles it was built around.   node source/tools/factory/plan_to_lab.js <plan.jsonl...> <batch no.> */
'use strict';
const fs = require('fs'), path = require('path');
const I = require(path.join(__dirname, '..', 'lab', 'ideas.js'));
// args: <plan.jsonl>:<batch no.> ...
const args = process.argv.slice(2), batch = Math.max(...args.map(a => +a.split(':').pop()));
const rows = args.flatMap(a => { const [f, b] = a.split(':'); return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(r => ({ ...r, batch: +b })); }).filter(r => r.ok).sort((a, b) => a.batch - b.batch || a.level - b.level);
const ideas = rows.map(r => ({ id: r.batch * 1000 + r.level, lv: r.level, kind: 'planned', level: r.recipe.join('+'), shape: r.shape, tiles: r.n,
  title: (r.pick ? r.pick + ' · ' : '') + (r.blind ? 'Blind test · ' : r.tight ? 'Too tight for the bot · ' : '') + r.recipe.map(k => I.IDEAS[k].title).join(' + ') + ' · ' + r.shape,
  idea: r.recipe.map(k => I.IDEAS[k].idea).join(' ') + (r.blind ? ' Blind test: no bot numbers shown, so they do not steer you; your result checks the difficulty bot.' : !r.bot ? '' : r.tight ? ` The strong bot (it sees only what you see) could not clear it within 4 tries; there is a way through (the factory stored one that passes every rule and the clock).` : ` The strong bot (it sees only what you see) needed ${r.bot.join(', ')} tries.`) + (r.g1 && !r.blind ? ` Gemini's difficulty bot (g1) expects you to need about ${r.g1.exp} tries (${r.g1.label}).` : '') + ` The clock has ${r.clockSpare} spare move${r.clockSpare === 1 ? '' : 's'} over the shortest way.`,
  specials: { down: r.down, ice: r.ice, locks: r.locks, clockSpare: r.clockSpare }, m: null, bot: r.blind ? ['blind'] : !r.bot ? ['-'] : r.tight ? ['not within 4'] : r.bot, board: r.design }));
const LAB = { made: new Date().toISOString(), factory: true, heading: 'Level factory',
  intro: `Planned levels (batches 4-${batch}), each built around puzzles you rated 4-5 stars in the lab. Newest at the bottom: the first, the middle and the hardest of 175-194, picked by Gemini's difficulty bot (g2.1) with a mix of hard levels and breathers. No bot numbers are shown, so they do not steer you. Is the difficulty right, and is it fun?`,
  verdict: [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']], noteHint: 'Fun? Did you have to think? (optional)', winText: 'Was the difficulty right? Say so in the factory list.', ideas };
fs.writeFileSync(path.join(__dirname, '..', 'lab', 'lab-ideas.js'), '/* made by tools/factory/plan_to_lab.js */\nconst LAB_IDEAS = ' + JSON.stringify(LAB) + ';\n');
console.log('lab:', ideas.map(i => i.lv + ' ' + i.level + ' bot ' + i.bot.join('/')).join(', '));
