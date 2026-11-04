'use strict';
// One resumable offline pipeline. Each creation owns a whole fresh layout.
// Tuning siblings remain one creation, which can be placed at most once.
const fs = require('fs'), path = require('path');
const { run: construct } = require('./construct_original.js');
const { main: evaluate } = require('./batch_queue.js');
const { refresh } = require('./refresh_original.js');
const { variants } = require('./original_variants.js');
const { assign } = require('./batch_assign.js');
const { verify } = require('./batch_verify.js');
const { atomicJson } = require('./meter.js');
const Final = require('./final_seed.js');
async function run(planFile, dir, constructionJobs = 4, meterJobs = 6, wanted = 8) {
  fs.mkdirSync(dir, { recursive: true });
  const poolFile = path.join(dir, 'pool.json'), seeds = path.join(dir, 'original-seeds.json'), marker = path.join(dir, 'producer-running');
  if (!fs.existsSync(seeds)) atomicJson(seeds, []);
  if (!fs.existsSync(poolFile)) atomicJson(poolFile, []);
  const update = () => refresh(planFile, [poolFile, seeds, path.join(dir, 'original-tuned.json')], poolFile);
  update(); fs.writeFileSync(marker, 'Fresh construction is active.');
  let timer, expanding = false, lastSeen = '';
  const tick = () => {
    update();
    const files = fs.readdirSync(dir), rows = JSON.parse(fs.readFileSync(poolFile));
    const seen = [rows.length, files.filter(f => f.endsWith('.screen.json')).length,
      files.filter(f => f.endsWith('.quality.json')).length].join('/');
    if (seen === lastSeen || expanding) return;
    expanding = true;
    try { atomicJson(poolFile, variants(rows, dir)); lastSeen = seen; }
    finally { expanding = false; }
  };
  try {
    timer = setInterval(tick, 15000);
    const production = (constructionJobs > 0 ? construct(planFile, dir, constructionJobs, wanted) : Promise.resolve())
      .finally(() => { update(); fs.rmSync(marker, { force: true }); });
    await Promise.all([production, evaluate(poolFile, planFile, dir, meterJobs)]);
  } finally { clearInterval(timer); fs.rmSync(marker, { force: true }); }
  for (let round = 0; round < 4; round++) {
    const before = JSON.parse(fs.readFileSync(poolFile)).length;
    tick(); await evaluate(poolFile, planFile, dir, meterJobs); tick();
    if (JSON.parse(fs.readFileSync(poolFile)).length === before && round) break;
  }
  const plan = JSON.parse(fs.readFileSync(planFile));
  if (plan.levelTable) plan.levelTable = path.resolve(path.dirname(planFile), plan.levelTable);
  const pool = JSON.parse(fs.readFileSync(poolFile));
  await Final.run(planFile, poolFile, dir, meterJobs);
  const result = assign(plan, pool, dir);
  atomicJson(path.join(dir, 'coverage.json'), { coverage: result.coverage, nodes: result.nodes });
  if (!result.rows) { console.log('REVIEW: the batch is not complete; missing slots are recorded in coverage.json'); return result; }
  const out = path.join(dir, 'levels.jsonl');
  fs.writeFileSync(out, result.rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  verify(planFile, out); console.log('READY:', out); return result;
}
module.exports = { run };
if (require.main === module) run(process.argv[2], process.argv[3], +(process.argv[4] || 4), +(process.argv[5] || 6), +(process.argv[6] || 8))
  .catch(e => { console.error(e); process.exitCode = 1; });
