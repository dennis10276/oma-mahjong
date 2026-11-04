'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { readRows } = require('./run_file.js');
function build(batchFile, out) {
  const rows = readRows(batchFile), source = path.resolve(__dirname, '../..');
  const target = path.resolve(out), allowed = path.join(source, 'build') + path.sep;
  if (!target.startsWith(allowed) || target === path.join(source, 'build')) throw Error('Lab output must be inside source/build');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const parent = fs.realpathSync(path.dirname(target)), buildRoot = fs.realpathSync(path.join(source, 'build'));
  if (parent !== buildRoot && !parent.startsWith(buildRoot + path.sep))
    throw Error('Lab output parent resolves outside source/build');
  const ideas = { made: new Date().toISOString(), factory: true, blind: true, heading: 'Levels 200–225',
    intro: 'A new batch of planned puzzles. Start with 200, try 212 in the middle, and 225 at the end. Big boards are at 210 and 220.',
    verdict: [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']],
    noteHint: 'Was it fun? Did you have to think?', winText: 'How did this level feel?',
    ideas: rows.map(r => ({ id: 2026000 + r.level, lv: r.level, kind: 'planned', level: 'new',
      title: (r.level === 200 ? 'First · ' : r.level === 212 ? 'Middle · ' : r.level === 225 ? 'Final · ' : '') + r.shape,
      idea: 'A new planned puzzle. Play, then rate its difficulty and how much you enjoyed it.',
      shape: r.shape, tiles: r.design.tiles.length, m: null,
      specials: { down: r.design.down.length, ice: Object.keys(r.design.obst.ice || {}).length,
        locks: r.design.obst.locks.length }, board: r.design })) };
  const file = path.join(path.dirname(target), 'batch-lab-ideas.js');
  fs.writeFileSync(file, 'const LAB_IDEAS = ' + JSON.stringify(ideas) + ';\n');
  cp.execFileSync(process.execPath, [path.join(__dirname, '../lab/build_lab.js'), target, file], { stdio: 'inherit' });
  // Keep the legacy lab renderer intact; hide its obsolete player estimates in this preview.
  const renderer = path.join(target, 'lab.js');
  let code = fs.readFileSync(renderer, 'utf8');
  code = code.replace(' · test players win the first try: Dennis ${d ? pct(d.first) : \'?\'}, Mrs. Doubtfire ${md ? pct(md.first) : \'?\'}', '');
  fs.writeFileSync(renderer, code);
  return target;
}
module.exports = { build };
if (require.main === module) build(process.argv[2], process.argv[3]);
