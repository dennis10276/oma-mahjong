'use strict';
const fs = require('fs'), path = require('path');
const { BRIEFS, make } = require('./original_layouts.js');
const { checkOrigin } = require('./originality.js');
const { atomicJson } = require('./meter.js');
const { refresh } = require('./refresh_original.js');

function portable(row) {
  if (checkOrigin(row)) throw Error('Candidate pool only accepts fresh original designs');
  const origin = { ...row.origin, creationSlot: row.origin.creationSlot ?? row.origin.intendedLevel ?? row.level };
  delete origin.intendedLevel;
  return { ...row, origin, candidatePool: true };
}
function prepare(planFile, dir, count = 20, existingPiles) {
  const plan = JSON.parse(fs.readFileSync(planFile));
  fs.mkdirSync(dir, { recursive: true });
  const pilesFile = path.resolve(dir, 'candidate-piles.json'), candidatePlan = path.resolve(dir, 'candidate-plan.json');
  if (!fs.existsSync(pilesFile)) fs.copyFileSync(existingPiles || path.resolve(path.dirname(planFile), plan.piles), pilesFile);
  const initial = 300;
  if (!fs.existsSync(candidatePlan)) atomicJson(candidatePlan, { ...plan,
    levelTable: path.resolve(path.dirname(planFile), plan.levelTable), outputLevels: plan.levels,
    from: initial, to: initial + count - 1, normalSizes: [64, 68, 72, 76, 80, 84, 88], layoutAttempts: 32,
    levels: Array.from({ length: count }, (_, k) => ({ level: initial + k, target: +(7 + 3 * k / (count - 1)).toFixed(2), big: k === 4 || k === 14,
      ...BRIEFS[k % BRIEFS.length] })) });
  make(candidatePlan, pilesFile);
  const combinedPlan = path.resolve(dir, 'output-plan.json');
  atomicJson(combinedPlan, { ...plan, piles: pilesFile,
    levelTable: path.resolve(path.dirname(planFile), plan.levelTable),
    candidateNote: 'IDs 300+ are fresh design candidates. Only output levels 200–225 are assigned, and each creation is selected at most once.' });
  return { candidatePlan, combinedPlan };
}
async function run(planFile, baselineDir, dir, jobs = 4, botJobs = 6, wanted = 8, existingPiles, tunedFile) {
  const { candidatePlan, combinedPlan } = prepare(planFile, dir, 20, existingPiles);
  // Construction and simulation run serially: one CPU-heavy job on this PC.
  const constructionDir = path.join(dir, 'construction');
  await require('./construct_original.js').run(candidatePlan, constructionDir, jobs, wanted);
  const extra = JSON.parse(fs.readFileSync(path.join(constructionDir, 'original-seeds.json'))).map(portable);
  const extrasFile = path.join(dir, 'extra-seeds.json'); atomicJson(extrasFile, extra);
  const pool = path.join(dir, 'pool.json');
  refresh(combinedPlan, [pool, path.join(baselineDir, 'pool.json'), extrasFile, tunedFile].filter(Boolean), pool);
  // Reuse compatible completed stage records as well as the shared bot cache.
  const ids = new Set(JSON.parse(fs.readFileSync(pool)).map(r => r.id));
  for (const f of fs.readdirSync(baselineDir)) if (/\.(screen|rate|quality|fresh)\.json$/.test(f) && ids.has(f.split('.')[0]) && !fs.existsSync(path.join(dir, f)))
    fs.copyFileSync(path.join(baselineDir, f), path.join(dir, f));
  return require('./run_original.js').run(combinedPlan, dir, 0, botJobs, 0);
}
module.exports = { portable, prepare, run };
if (require.main === module) run(process.argv[2], process.argv[3], process.argv[4], +(process.argv[5] || 4), +(process.argv[6] || 6), +(process.argv[7] || 8), process.argv[8], process.argv[9])
  .catch(e => { console.error(e); process.exitCode = 1; });
