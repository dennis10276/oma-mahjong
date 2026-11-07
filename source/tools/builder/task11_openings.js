'use strict';
const path = require('path'), fs = require('fs'), P = require('./task11_plan.js'), M = require('../factory/meter.js'), S = require('./task10_study.js');
const { pool } = require('../factory/empirical_workers.js');
const rowName = id => M.digest(id) + '.json';
function prepare(root) {
  const dir = path.join(root, 'visible-key-openings'), file = path.join(dir, 'plan.json');
  if (fs.existsSync(file)) { const p = P.read(file); S.verifyPlan(p); return p; }
  const visibility = P.read(path.join(root, 'key-visibility-recheck.json')), source = P.read(path.resolve(__dirname, '../../analysis/builder/knobs-v1/boards.json'));
  const ids = visibility.rows.filter(r => r.hasKeys && r.keysShownAtStart === 2 && r.family >= 18).map(r => r.id);
  const p = { created: new Date().toISOString(), purpose: 'All non-frozen Task10 family18+ boards with both actual key glyphs visible, not just the selected60. Opening refinement frozen before calls. Unknown is never losing or unique.',
    source: M.digest(source), ids, boards: ids.map(id => source.find(b => b.id === id)), budget: { nodes: 300000, ms: 1000 }, worker: M.sourceHash(require.resolve('./task11_openings_worker.js')) };
  p.fingerprint = M.digest(p); P.save(dir, 'plan.json', p); return p;
}
async function run(root, workers = 6) {
  const p = prepare(root), dir = path.join(root, 'visible-key-openings');
  if (p.worker !== M.sourceHash(require.resolve('./task11_openings_worker.js'))) throw Error('Opening worker changed');
  const queue = p.boards.filter(b => !fs.existsSync(path.join(dir, 'rows', rowName(b.id)))).map(board => ({ task: board.id, board, budget: p.budget, plan: p.fingerprint }));
  await pool(queue, require.resolve('./task11_openings_worker.js'), r => { P.save(dir, 'rows/' + rowName(r.id), r); console.log(r.id, r.win, 'win', r.lose, 'lose', r.unknown, 'unknown'); }, workers);
  return report(root);
}
function report(root) {
  const p = prepare(root), dir = path.join(root, 'visible-key-openings'), rows = p.ids.map(id => P.read(path.join(dir, 'rows', rowName(id))));
  const out = { plan: p.fingerprint, boards: rows.length, fullyClassified: rows.filter(r => !r.unknown).length,
    exactlyOneWinningOpening: rows.filter(r => !r.unknown && r.win === 1).length, unresolvedCouldBeUnique: rows.filter(r => r.unknown && r.win <= 1).length, rows };
  P.save(root, 'visible-key-opening-summary.json', out);
  const lines = ['# Brutal boards with both key glyphs visible', '', `${out.boards} Task10 boards; ${out.fullyClassified} fully classified openings; ${out.exactlyOneWinningOpening} proved exactly one winning opening; ${out.unresolvedCouldBeUnique} unresolved openings could still be unique. Unknown never counts as losing.`, '',
    'This counts legal engine actions, including instant same-picture pairs. It does not say a winning action was obvious to a person. Later route bottlenecks are reported separately in the60-board profiles; a non-unique opening does not rule out a uniquely safe state later.', '',
    '| Board | family / skilled | winning | losing | unknown | legal | winning tile numbers (one-based) |', '|---|---|---:|---:|---:|---:|---|'];
  for (const r of rows) lines.push(`| ${r.id} | ${r.family}/${r.skilled} | ${r.win} | ${r.lose} | ${r.unknown} | ${r.legal} | ${r.options.filter(o => o.result === 'win').map(o => (typeof o.move === 'number' ? [o.move] : o.move.pair).map(i => i + 1).join('+')).join(', ')} |`);
  fs.writeFileSync(path.join(root, 'VISIBLE-KEY-OPENINGS.md'), lines.concat('').join('\n')); return out;
}
if (require.main === module) { const root = path.resolve(process.argv[2]); (process.argv[3] === 'prepare' ? Promise.resolve(prepare(root)) : run(root, +(process.argv[3] || 6))).then(r => console.log({ boards: r.boards?.length || r.boards, unique: r.exactlyOneWinningOpening })).catch(e => { console.error(e); process.exitCode = 1; }); }
module.exports = { prepare, run, report, rowName };
