'use strict';
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js');
const { pool } = require('../factory/empirical_workers.js');
async function prepare(dir) {
  const p = P.read(path.join(dir, 'selection-plan.json')); S.verifyPlan(p);
  const root = path.join(dir, 'ladder'), worker = path.join(__dirname, 'task11_build_worker.js');
  const specs = p.ladder.pairs.flatMap(pair => p.ladder.ways.flatMap(way => p.ladder.seeds.map(seed => ({ ...pair, way, seed, targets: p.ladder.targets, task: `${pair.story}-L${pair.layout}-w${way}-s${seed}` }))));
  const protocolFile = path.join(root, 'construction-protocol.json'), protocol = { selection: p.fingerprint, worker: M.sourceHash(worker), specs };
  if (fs.existsSync(protocolFile) && M.digest(P.read(protocolFile)) !== M.digest(protocol)) throw Error('Construction implementation/plan changed');
  P.save(root, 'construction-protocol.json', protocol);
  const boards = [], queue = [];
  for (const job of specs) { const f = path.join(root, 'construction', job.task + '.json'); if (fs.existsSync(f)) boards.push(...P.read(f).boards); else queue.push(job); }
  await pool(queue, worker, r => { P.save(root, 'construction/' + r.task + '.json', r); boards.push(...r.boards); console.log(boards.length + '/252', r.task, r.boards[0].fail || 'built'); }, 4);
  const measurementWorker = require.resolve('./task10_worker.js'), settings = [{ setting: 'family', seed: 4711, runs: 20, seeds: 2 }, { setting: 'family', seed: 18427, runs: 20, seeds: 2 }, { setting: 'planner', seed: 4711, runs: 20, seeds: 2 }];
  const proto = { schema: 'task11-ladder-v1', bot: p.bot, worker: M.sourceHash(measurementWorker), settings, purpose: 'Full-protocol way ladder; no early stopping because full scores across the entire range are the outcome.' };
  P.save(root, 'protocol.json', proto);
  const plan = { schema: proto.schema, protocol: M.digest(proto), bot: p.bot, worker: proto.worker, selection: p.fingerprint, boards: boards.sort((a, b) => a.id.localeCompare(b.id)) };
  plan.fingerprint = M.digest(plan); const f = path.join(root, 'plan.json');
  if (fs.existsSync(f) && P.read(f).fingerprint !== plan.fingerprint) throw Error('Frozen boards changed');
  P.save(root, 'plan.json', plan); console.log('Frozen', boards.length, 'requests;', boards.filter(b => b.design && !b.fail).length, 'built');
}
if (require.main === module) prepare(path.resolve(process.argv[2])).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { prepare };
