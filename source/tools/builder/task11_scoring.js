'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js');
const { pool } = require('../factory/empirical_workers.js');
async function run(root, kind = 'traces', workers = 8, limit = 0) {
  const p = P.read(path.join(root, 'selection-plan.json')); S.verifyPlan(p);
  const worker = require.resolve('./task11_analyze_worker.js'), protocol = { selection: p.fingerprint, worker: M.sourceHash(worker), budget: p.classification };
  const file = path.join(root, 'scoring-protocol.json');
  if (fs.existsSync(file) && M.digest(P.read(file)) !== M.digest(protocol)) throw Error('Frozen engine-scoring implementation changed');
  P.save(root, 'scoring-protocol.json', protocol);
  let boards = p.boards;
  if (kind === 'structure') { const d = S.collect(path.join(root, 'ladder-readable')), seen = new Set(); boards = d.boards.filter(b => { const key = b.design && !b.fail && M.boardKey(b.design); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }
  if (limit) boards = boards.slice(0, limit);
  const tasks = boards.map(board => ({ board, root, kind: kind === 'structure' ? 'structure' : 'traces', bot: p.bot, budget: p.classification, task: M.boardKey(board.design) }));
  let saved = 0;
  const queue = tasks.filter(t => { const f = path.join(root, kind === 'structure' ? 'structures' : 'profiles', t.task + '.json'); if (fs.existsSync(f)) { const r = P.read(f); if (r.scoring !== M.digest(protocol)) throw Error('Old scoring checkpoint'); if (r.detailFile && fs.existsSync(path.join(root, r.detailFile))) { saved++; return false; } } return true; });
  await pool(queue, worker, r => {
    const dir = path.join(root, 'engine-detail', r.kind); fs.mkdirSync(dir, { recursive: true });
    const detail = r.detail || { states: r.states }; fs.writeFileSync(path.join(dir, r.task + '.json.gz'), zlib.gzipSync(JSON.stringify(detail), { level: 6 }));
    const value = r.score || { ...r, states: undefined }; value.scoring = M.digest(protocol);
    value.detailFile = 'engine-detail/' + r.kind + '/' + r.task + '.json.gz'; value.detailHash = M.digest(detail);
    P.save(root, (kind === 'structure' ? 'structures/' : 'profiles/') + r.task + '.json', value);
    console.log(kind, ++saved + '/' + tasks.length, r.score?.id || r.task.slice(0, 12), Math.round(r.ms / 1000) + 's');
  }, workers);
}
if (require.main === module) run(path.resolve(process.argv[2]), process.argv[3] || 'traces', +(process.argv[4] || 8), +(process.argv[5] || 0)).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run };
