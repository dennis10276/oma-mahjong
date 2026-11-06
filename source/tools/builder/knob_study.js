'use strict';
const fs = require('fs'), path = require('path');
const { isMainThread, parentPort } = require('worker_threads');
const M = require('../factory/meter.js'), { pool } = require('../factory/empirical_workers.js');
const { clockSpare } = require('./knobs.js');

function preregister(gate, outDir) {
  if (fs.existsSync(path.join(outDir, 'plan.json'))) throw Error('Plan already exists; run it or choose another directory');
  const selected = [], seen = new Set();
  const stories = [...new Set(gate.records.map(r => r.story))];
  for (const story of stories) {
    const layouts = new Set(); let count = 0;
    for (const row of gate.records.filter(r => r.story === story && r.ok && !r.check.problems.length)) {
      if (count >= 2) break;
      if (layouts.has(row.layout)) continue;
      const tight = clockSpare(row.design, 1), loose = clockSpare(row.design, 3);
      if (tight.fail || loose.fail) continue;
      const key = M.boardKey(tight.design);
      if (seen.has(key)) continue;
      // Prove that neither the pictures, geometry, obstacles, hidden flags nor witness changed.
      const stripped = d => { const x = structuredClone(d); delete x.clock.n; return x; };
      if (M.digest(stripped(tight.design)) !== M.digest(stripped(loose.design))) throw Error('Extra edit');
      selected.push({ id: row.id + '-s' + row.seed, story, layout: row.layout, tight, loose });
      seen.add(key); layouts.add(row.layout); count++;
    }
    if (count !== 2) throw Error('Cannot preregister two layouts for ' + story);
  }
  if (selected.length !== 20) throw Error('Expected 20 boards');
  const plan = { schema: 1, created: new Date().toISOString(), bot: M.createMeter().fingerprint,
    implementation: M.sourceHash(__filename), sourceGate: gate.meta.tag,
    question: 'Does raising exact clock spare from 1 to 3 reduce retries? Only clock.n changes; derived trap outcomes may change.',
    selection: 'First two distinct successful layouts per story in gate order, with the same valid stored witness at both deadlines; no bot scores used.',
    settings: { runs: 20, seeds: 2, seed: 4711 }, profiles: ['family', 'planner'],
    criterion: 'At least 16 of 20 strictly easier, separately per profile. Ties do not establish a useful knob; invalid or unmeasured results never pass.',
    boards: selected };
  plan.fingerprint = M.digest(plan);
  M.atomicJson(path.join(outDir, 'plan.json'), plan);
  return plan;
}
function summarize(plan, records) {
  const profiles = {};
  for (const profile of plan.profiles) {
    const pairs = plan.boards.map(b => {
      const get = variant => records.find(r => r.id === b.id && r.profile === profile && r.variant === variant);
      const a = get('tight'), z = get('loose'), valid = a?.valid === true && z?.valid === true;
      return { id: b.id, story: b.story, valid, tight: a?.expectedTries ?? null, loose: z?.expectedTries ?? null,
        delta: valid ? z.expectedTries - a.expectedTries : null };
    });
    const measured = pairs.filter(p => p.valid), easier = measured.filter(p => p.delta < -1e-9).length;
    profiles[profile] = { total: pairs.length, valid: measured.length, easier, tied: measured.filter(p => Math.abs(p.delta) <= 1e-9).length,
      harder: measured.filter(p => p.delta > 1e-9).length, pass: measured.length === pairs.length && easier / pairs.length >= 0.8, pairs };
  }
  return { schema: 1, plan: plan.fingerprint, bot: plan.bot, profiles, production: false,
    limitation: 'One 40-campaign seeded comparison per variant/profile. This establishes a local knob direction, not a retry prediction or level qualification.' };
}
async function run(outDir, jobs = 4) {
  const plan = JSON.parse(fs.readFileSync(path.join(outDir, 'plan.json')));
  if (M.createMeter().fingerprint !== plan.bot || M.sourceHash(__filename) !== plan.implementation) throw Error('Bot or implementation changed; keep this plan immutable');
  const records = [], tasks = [];
  for (const b of plan.boards) for (const profile of plan.profiles) for (const variant of ['tight', 'loose']) {
    const task = { id: b.id, profile, variant, design: b[variant].design, settings: plan.settings, bot: plan.bot, plan: plan.fingerprint };
    task.key = M.digest(task);
    const file = path.join(outDir, 'measurements', task.key + '.json');
    if (fs.existsSync(file)) { const r = JSON.parse(fs.readFileSync(file)); if (r.valid && r.plan === plan.fingerprint) { records.push(r); continue; } }
    tasks.push(task);
  }
  await pool(tasks, __filename, r => {
    M.atomicJson(path.join(outDir, 'measurements', r.key + '.json'), r); records.push(r);
    M.atomicJson(path.join(outDir, 'summary.json'), summarize(plan, records));
    console.log(`${records.length}/80 ${r.id} ${r.profile} ${r.variant}: ${r.valid ? r.expectedTries : 'INVALID'}`);
  }, jobs);
  const summary = summarize(plan, records);
  M.atomicJson(path.join(outDir, 'summary.json'), summary);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(summary.profiles).map(([k, v]) => [k, { ...v, pairs: undefined }]))));
  return summary;
}
if (!isMainThread) {
  const meter = M.createMeter();
  parentPort.on('message', task => {
    try {
      if (meter.fingerprint !== task.bot) throw Error('Bot fingerprint changed');
      const before = { ...meter.stats }, t = Date.now();
      const r = meter.measure(task.design, { ...task.settings, setting: task.profile });
      parentPort.postMessage({ id: task.id, profile: task.profile, variant: task.variant, key: task.key, plan: task.plan, bot: task.bot,
        valid: r.valid, expectedTries: r.valid ? r.expectedTries : null, firstTryRate: r.firstTryRate,
        ms: Date.now() - t, calls: meter.stats.calls - before.calls, cacheHits: meter.stats.hits - before.hits });
    } catch (e) { parentPort.postMessage({ error: e.stack }); }
  });
} else if (require.main === module) {
  const [action, first, second] = process.argv.slice(2);
  if (action === 'prepare') console.log(preregister(JSON.parse(fs.readFileSync(first)), path.resolve(second)).boards.map(b => b.id).join('\n'));
  else if (action === 'run') run(path.resolve(first), Number(second || 4)).catch(e => { console.error(e); process.exitCode = 1; });
  else throw Error('prepare <gate-results.json> <out-dir> | run <out-dir> [jobs]');
}
module.exports = { preregister, summarize, run };
