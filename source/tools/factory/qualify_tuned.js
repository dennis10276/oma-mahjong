'use strict';
const fs = require('fs'), path = require('path');
const { atomicJson } = require('./meter.js');
const { minimum } = require('./shape_preferences.js');

async function run(planFile, poolFile, dir, jobs = 6, options = {}) {
  const plan = JSON.parse(fs.readFileSync(planFile)), pool = JSON.parse(fs.readFileSync(poolFile));
  const rows = pool.filter(r => r.tuning?.measuredId === r.id && Number.isFinite(r.tuning.pooledFamily) &&
    r.design.tiles.length >= minimum(plan)).map(r => ({ ...r, forcePlanner: true }));
  const evaluate = options.evaluate || require('./batch_evaluate.js').run;
  const input = path.join(dir, 'known-tuned-input.json'); atomicJson(input, rows);
  // These boards were already fully metered while steering. A noisy scout or
  // a per-creation quota must not discard a useful different curve placement.
  await evaluate(input, dir, 'rate', jobs, true);
  const viable = rows.filter(r => {
    const rate = JSON.parse(fs.readFileSync(path.join(dir, r.id + '.rate.json')));
    if (!rate.train?.valid || !rate.validation?.valid || Math.abs(rate.train.exp - rate.validation.exp) > (plan.maxSeedGap ?? 2)) return false;
    const score = (rate.train.exp + rate.validation.exp) / 2;
    return plan.levels.some(s => require('./placement_score.js').slotAllows(r,s) && Math.abs(score - s.target) <= (plan.tolerance ?? .5));
  });
  const quality = path.join(dir, 'known-tuned-quality-input.json'); atomicJson(quality, viable);
  await evaluate(quality, dir, 'quality', jobs, true);
  return { rated: rows.length, quality: viable.length };
}
module.exports = { run };
if (require.main === module) run(...process.argv.slice(2, 5), +(process.argv[5] || 6))
  .then(r => console.log('Known tuned candidates checked:', r)).catch(e => { console.error(e); process.exitCode = 1; });
