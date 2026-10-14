/* Re-order the shipped boards from a level on so that each level is at least as hard as the one
   before, by the current measure (the clock-focused test player's first-try win chance).
   Big boards (more than 88 tiles) stay on every 10th level: they are sorted among themselves into
   those places, the other boards into the rest. Every board keeps its own clock, ice, locks, gold
   and solution; nothing is redesigned.
     node tools/sim/reorder_levels.js measure.json [from=90] [to=269] > report.json
   measure.json: [{ lv, focused, runs }] fresh measurements of the boards as they are now.
   Writes www/levels-hard.js in place (the measured chance stored per board is updated too). */
'use strict';
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', '..', 'www', 'levels-hard.js');
const src = fs.readFileSync(FILE, 'utf8');
const T = JSON.parse(src.slice(src.indexOf('{', src.indexOf('const HARD_LEVELS'))).trim().replace(/;\s*$/, ''));
const meas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const from = +(process.argv[3] || 90), to = +(process.argv[4] || 269);
const row = lv => T.levels[lv - T.from];
const BIG = r => r[0].length / 3 > 88;
// the chance per board: the fresh measurement together with the one stored at release (600 games)
const chance = lv => {
  const m = meas.find(x => x.lv === lv), stored = row(lv)[9];
  const n = m.runs || 2000;
  return (m.focused * n + stored * 600) / (n + 600);
};
const boards = [];
for (let lv = from; lv <= to; lv++) boards.push({ was: lv, row: row(lv), p: chance(lv), big: BIG(row(lv)) });
const byEase = list => list.slice().sort((a, b) => b.p - a.p);       // easiest (highest chance) first
const bigs = byEase(boards.filter(b => b.big)), normals = byEase(boards.filter(b => !b.big));
const slots = []; for (let lv = from; lv <= to; lv++) slots.push(lv);
const tenth = lv => lv % 10 === 0;
if (bigs.length !== slots.filter(tenth).length) throw Error(`big boards (${bigs.length}) do not match the 10th levels (${slots.filter(tenth).length})`);
const out = slots.map(lv => (tenth(lv) ? bigs : normals).shift());
const report = { from, to, moves: [], steps: [] };
out.forEach((b, k) => {
  const lv = from + k, r = b.row.slice();
  r[9] = +b.p.toFixed(4);
  T.levels[lv - T.from] = r;
  report.moves.push({ lv, was: b.was, chance: +b.p.toFixed(3), big: b.big });
  if (k) { const d = b.p - out[k - 1].p; if (d > 0) report.steps.push({ lv, easierBy: +d.toFixed(3) }); }
});
const before = fs.readFileSync(FILE, 'utf8');
const head = before.slice(0, before.indexOf('const HARD_LEVELS'));
T.v = +(process.env.GENV || T.v);
fs.writeFileSync(FILE, head.replace(/\*\/\s*$/, `\n   Levels ${from}-${to} re-ordered ${new Date().toISOString().slice(0, 10)} so that each is at least as hard as the one before (tools/sim/reorder_levels.js). */\n`) + 'const HARD_LEVELS = ' + JSON.stringify(T) + ';\n');
console.log(JSON.stringify(report, null, 1));
