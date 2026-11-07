'use strict';
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js'), { pool } = require('../factory/empirical_workers.js');
async function prepare(root) {
  const selection = P.read(path.join(root, 'selection-plan.json')); S.verifyPlan(selection);
  const original = S.collect(path.join(root, 'ladder-readable'));
  if (original.boards.some(b => b.cell.story === 'roomInTrayLocked' && !b.fail)) throw Error('Fallback is only for the entirely unreadable original sixth pair');
  const dir = path.join(root, 'ladder-fallback'), pair = { story: 'keysOnIsland', layout: 7, shape: 'frame' }, worker = require.resolve('./task11_build_worker.js');
  const specs = selection.ladder.ways.flatMap(way => selection.ladder.seeds.map(seed => ({ ...pair, way, seed, targets: selection.ladder.targets, task: `${pair.story}-L${pair.layout}-w${way}-s${seed}` })));
  const protocol = { parent: selection.fingerprint, original: original.plan.fingerprint, pair, specs, worker: M.sourceHash(worker),
    reason: 'Original roomInTrayLocked/steps yielded zero readable designs (24 blind-objective,18 no-clock-for-way). Retain all42 failures and add an omitted non-frozen story on the first original Task10 grid-fitting frame layout. Same seed/way/spare plan; no slot-based builds or selection on new ratings.' };
  const f = path.join(dir, 'construction-protocol.json'); if (fs.existsSync(f) && M.digest(P.read(f)) !== M.digest(protocol)) throw Error('Fallback construction changed');
  P.save(dir, 'construction-protocol.json', protocol);
  const boards = [], pending = [];
  for (const job of specs) { const f = path.join(dir, 'construction', job.task + '.json'); if (fs.existsSync(f)) boards.push(...P.read(f).boards); else pending.push(job); }
  await pool(pending, worker, r => { P.save(dir, 'construction/' + r.task + '.json', r); boards.push(...r.boards); console.log(boards.length + '/42', r.task, r.boards[0].fail || 'built'); }, 4);
  const raw = { parent: selection.fingerprint, construction: M.digest(protocol), boards: boards.sort((a, b) => a.id.localeCompare(b.id)) }; raw.fingerprint = M.digest(raw);
  P.save(dir, 'construction-plan.json', raw);
  const proto = { ...original.protocol, pair, parent: raw.fingerprint, eligibility: 'Existing readability check before any rating; all construction failures retained.' };
  const plan = { schema: proto.schema, protocol: M.digest(proto), bot: proto.bot, worker: proto.worker, parent: raw.fingerprint,
    boards: raw.boards.map(b => !b.fail && b.readable === false ? { ...b, fail: 'blindObjectiveRoute' } : b) }; plan.fingerprint = M.digest(plan);
  const prior = path.join(dir, 'plan.json'); if (fs.existsSync(prior) && P.read(prior).fingerprint !== plan.fingerprint) throw Error('Frozen fallback boards changed');
  P.save(dir, 'protocol.json', proto); P.save(dir, 'plan.json', plan); console.log('Frozen fallback42requests;', plan.boards.filter(b => !b.fail).length, 'readable');
}
if (require.main === module) prepare(path.resolve(process.argv[2])).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { prepare };
