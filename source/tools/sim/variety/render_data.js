/* Tile spots of old and new boards for render.py.
     node source/tools/sim/variety/render_data.js 157,158 > boards.json */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js'));
global.Layouts = L; global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'analysis', 'levels-before-variety.js'), 'utf8') + ';HARD_LEVELS');
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const prog = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis', 'variety-progress.json'), 'utf8'));
const pct = x => Math.round(x * 100);
const rows = process.argv[2].split(',').map(Number).filter(lv => prog.levels[lv] && prog.levels[lv].status === 'done').map(lv => {
  const o = Hard.get(lv), r = prog.levels[lv], f = r.final;
  return { lv, old: o.tiles, new: r.board.tiles, shape: r.shape, oldNote: `${o.tiles.length} tiles`, newNote: `${r.board.tiles.length} tiles, D ${pct(f.Dennisisdebeste.first)}% / M ${pct(f['Mrs. Doubtfire'].first)}% 1st try` };
});
console.log(JSON.stringify({ rows }));
