'use strict';
const path = require('path'), fs = require('fs'), P = require('./task11_plan.js'), S = require('./task10_study.js'), M = require('../factory/meter.js');
function prepare(root) {
  const raw = P.read(path.join(root, 'ladder/plan.json')); S.verifyPlan(raw);
  const dir = path.join(root, 'ladder-readable'), proto = { ...P.read(path.join(root, 'ladder/protocol.json')), parent: raw.fingerprint,
    eligibility: 'Before any ratings: require the existing readable-objective check in addition to zero hidden planned-dig tiles and the existing construction proofs. Keep rejected boards and reasons; do not rate them as readable examples.' };
  const boards = raw.boards.map(b => !b.fail && b.readable === false ? { ...b, fail: 'blindObjectiveRoute', detail: 'No hidden planned dig, but the existing objective-route guard still rejects this design.' } : b);
  const plan = { ...raw, parent: raw.fingerprint, protocol: M.digest(proto), boards }; delete plan.fingerprint; plan.fingerprint = M.digest(plan);
  if (fs.existsSync(path.join(dir, 'plan.json')) && P.read(path.join(dir, 'plan.json')).fingerprint !== plan.fingerprint) throw Error('Frozen readable measurement plan changed');
  P.save(dir, 'protocol.json', proto); P.save(dir, 'plan.json', plan);
  return { requested: boards.length, constructed: raw.boards.filter(b => !b.fail).length, readable: boards.filter(b => !b.fail).length, filtered: boards.filter(b => b.fail === 'blindObjectiveRoute').length };
}
if (require.main === module) console.log(prepare(path.resolve(process.argv[2])));
module.exports = { prepare };
