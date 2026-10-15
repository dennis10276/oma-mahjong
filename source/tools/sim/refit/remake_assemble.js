/* Remake 106-269, step 4: the new level table. Levels up to 105 are copied unchanged from the live
   table; 106-269 come from the tuning rounds (the second round where it ran, else the first, the
   one closest to the target). Writes the table to <out> with version <GENV>.
     node remake_assemble.js <live levels-hard.js> <out> <GENV> */
'use strict';
const fs = require('fs'), path = require('path');
const [src, outFile, genv] = process.argv.slice(2);
const text = fs.readFileSync(src, 'utf8');
const T = JSON.parse(text.slice(text.indexOf('{', text.indexOf('const HARD_LEVELS'))).trim().replace(/;\s*$/, ''));
const load = re => { const o = {}; for (const f of fs.readdirSync(__dirname).filter(f => re.test(f))) Object.assign(o, JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'))); return o; };
const rounds = [1, 2, 3, 4].map(k => load(new RegExp(`^remake-tuned${k === 1 ? '' : k}-\\d+\\.json$`)));
const report = [];
for (let lv = 106; lv <= 269; lv++) {
  const cands = rounds.map(o => o[lv]).filter(Boolean).filter(x => x.valid);
  if (!cands.length) throw Error('no valid board for ' + lv);
  // round 4 fixed levels found off target or unfair on fresh games: it wins where it ran
  const best = rounds[3][lv] && rounds[3][lv].valid ? rounds[3][lv] : cands.sort((a, b) => Math.abs(a.strong - a.target) - Math.abs(b.strong - b.target))[0];
  T.levels[lv - T.from] = best.row;
  report.push({ lv, src: best.src, target: best.target, strong: best.strong, sensible: best.sensible, average: best.average, round: rounds.findIndex(o => o[lv] === best) + 1 });
}
T.v = +genv;
const head = text.slice(0, text.indexOf('const HARD_LEVELS')).replace(/\*\/\s*$/, `\n   Levels 106-269 remade 2026-10-15 for the new curve with the re-fitted strong test player (tools/sim/refit/remake_*.js on wip/honest-observer); 1-105 unchanged. */\n`);
fs.writeFileSync(outFile, head + 'const HARD_LEVELS = ' + JSON.stringify(T) + ';\n');
console.log(JSON.stringify(report));
