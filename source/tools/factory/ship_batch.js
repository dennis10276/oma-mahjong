/* Put a level-factory batch into the game (Claude, 2026-10-31, for Dennis): replaces the rows of
   HARD_LEVELS for the batch's levels and records them in `revisions`, so only saved games on those
   levels start again (hard.js designVersion). Check the boards before (and after) with the factory's
   tools/lab/ideas.js valid() (branch wip/level-factory): the stored way through must pass every rule.
     node source/tools/factory/ship_batch.js <batch.jsonl> <tag>                                   */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..'), FILE = path.join(ROOT, 'www', 'levels-hard.js');
const [batchFile, tag] = process.argv.slice(2);
if (!batchFile || !tag) throw new Error('usage: ship_batch.js <batch.jsonl> <tag>');
const src = fs.readFileSync(FILE, 'utf8'), at = src.indexOf('const HARD_LEVELS = ');
const head = src.slice(0, at), T = vm.runInNewContext(src + ';HARD_LEVELS');
const L = require(path.join(ROOT, 'www', 'layouts.js')); global.Layouts = L; global.HARD_LEVELS = T;
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const rows = fs.readFileSync(batchFile, 'utf8').trim().split('\n').map(JSON.parse).sort((a, b) => a.level - b.level);
const from = rows[0].level, to = rows[rows.length - 1].level;
rows.forEach((r, k) => { if (r.level !== from + k) throw new Error('levels must follow each other: ' + r.level); });
for (const r of rows) {
  const d = r.design, tiles = d.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]);
  T.levels[r.level - T.from] = Hard.pack({ ...d, tiles, info: { rate: r.g2 ? r.g2.first : null, strong: r.g2 ? r.g2.first : null } });
  if (T.ratingModels) T.ratingModels[r.level - T.from] = 'human-g2.1';
}
T.revisions = (T.revisions || []).filter(([a, b]) => b < from || a > to).concat([[from, to, tag]]);
fs.writeFileSync(FILE, head.replace(/\*\/\s*$/, '*/\n') .replace('*/\n', '*/\n/* ' + from + '-' + to + ': level factory batch "' + tag + '" (revisions). */\n') + 'const HARD_LEVELS = ' + JSON.stringify(T) + ';\n');
console.log('shipped', from + '-' + to, 'as', tag, rows.map(r => r.level + ':' + r.recipe.join('+')).join(' '));
