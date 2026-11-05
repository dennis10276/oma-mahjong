'use strict';
// Reserved for final qualification; never feed this measurement to steering.
const SEED = 29717;
const tuned = row => !!(row.tuning || row.tunedFrom || row.edit);
function qualifies(row, rate, fresh, slot, plan) {
  if (!tuned(row)) return true;
  if (!fresh?.fresh?.valid || fresh.fresh.seed !== SEED) return false;
  const scores = [rate.train.exp, rate.validation.exp, fresh.fresh.exp];
  return Math.abs(fresh.fresh.exp - slot.target) <= plan.tolerance &&
    Math.max(...scores) - Math.min(...scores) <= (plan.maxSeedGap ?? 2);
}
async function run(planFile, poolFile, dir, jobs = 6) {
  const fs = require('fs'), path = require('path'), { atomicJson } = require('./meter.js');
  const plan = JSON.parse(fs.readFileSync(planFile)), pool = JSON.parse(fs.readFileSync(poolFile));
  const finalists = require('./batch_assign.js').candidates(pool, dir).filter(r => tuned(r) && plan.levels.some(s =>
    require('./placement_score.js').slotAllows(r,s) &&
    Math.abs(r.exp - s.target) <= plan.tolerance && Math.abs(r.rate.train.exp - r.rate.validation.exp) <= plan.maxSeedGap));
  const file = path.join(dir, 'final-seed-input.json'); atomicJson(file, finalists);
  await require('./batch_evaluate.js').run(file, dir, 'fresh', jobs);
}
module.exports = { SEED, tuned, qualifies, run };
if (require.main === module) run(...process.argv.slice(2, 5), +(process.argv[5] || 6))
  .catch(e => { console.error(e); process.exitCode = 1; });
