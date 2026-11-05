'use strict';
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { createMeter, boardKey, atomicJson, digest, sourceHash } = require('./meter.js');
const { checkOrigin, layoutKey } = require('./originality.js');
if (!isMainThread) {
  const { createSteerer } = require('./steer_design.js');
  parentPort.on('message', ({ row, saved, stateFile, fingerprint }) => {
    const started = Date.now(), meter = createMeter(), measure = meter.measure;
    // Same calibrated bot, two disjoint campaigns. No retuning of its persona.
    const pooled = { ...meter, measure(d, options) {
      const a = measure(d, options);
      if (options.setting !== 'family' || options.runs !== 20 || options.seed !== 4711) return a;
      const b = measure(d, { ...options, seeds: 2, seed: 18427 });
      return { ...a, expectedTries: (a.expectedTries + b.expectedTries) / 2,
        firstTryRate: (a.firstTryRate + b.firstTryRate) / 2, valid: a.valid && b.valid,
        results: a.results.concat(b.results) };
    } };
    try {
      if (checkOrigin(row)) throw Error('Tuning requires an original level');
      const result = createSteerer({ meter: pooled, steps: 14, tolerance: .35, routeMilliseconds: 800 }).steer(row, saved,
        state => atomicJson(stateFile, { input: row.id, fingerprint, state }));
      parentPort.postMessage({ row: { ...result, id: boardKey(result.design).slice(0, 16), forcePlanner: true,
        tuning: { measuredId: boardKey(result.design).slice(0, 16), pooledFamily: result.g61.exp,
          searchPass: result.searchPass, reasons: result.reviewReasons } },
        input: row.id, seconds: (Date.now() - started) / 1000 });
    } catch (e) { parentPort.postMessage({ input: row.id, error: e.stack }); }
  });
} else {
  async function run(seedFile, dir, jobs = 4, planFile) {
    const seeds = JSON.parse(fs.readFileSync(seedFile)), output = path.join(dir, 'original-tuned.json');
    const plan = planFile && JSON.parse(fs.readFileSync(planFile));
    const layouts = plan && new Map(JSON.parse(fs.readFileSync(path.resolve(path.dirname(planFile), plan.piles))).map(p => [p.level, layoutKey(p)]));
    const fingerprint = digest({ bot: createMeter().fingerprint, implementation:
      [__filename, './steer_design.js', '../lab/ideas.js', '../lab/exact.js'].map(f => sourceHash(path.resolve(__dirname, f))) });
    const rows = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output)) : [];
    const queue = seeds.filter(r => (!layouts || r.origin.initialLayout === layouts.get(r.origin.creationSlot ?? r.origin.intendedLevel ?? r.level)) && !rows.some(x => x.tunedFrom === r.id));
    const read = r => { const f = path.join(dir, r.id + '.screen.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)).exp : 20; };
    const counts = {};
    queue.sort((a, b) => Math.abs(read(a) - a.target) - Math.abs(read(b) - b.target));
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, () => new Promise((resolve, reject) => {
      const worker = new Worker(__filename); worker.on('error', reject);
      const next = () => {
        queue.sort((a, b) => (counts[a.level] || 0) - (counts[b.level] || 0));
        const row = queue.shift();
        if (!row) { worker.terminate().then(resolve, reject); return; }
        counts[row.level] = (counts[row.level] || 0) + 1;
        const stateFile = path.join(dir, row.id + '.tuning.json');
        const saved = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : null;
        if (saved && (saved.input !== row.id || saved.fingerprint !== fingerprint)) throw Error('Stale tuning checkpoint; choose a new tuning output directory');
        console.log('tune', row.level, row.id); worker.postMessage({ row, saved: saved?.state, stateFile, fingerprint });
      };
      worker.on('message', result => {
        if (result.row) { rows.push({ ...result.row, tunedFrom: result.input }); atomicJson(output, rows); }
        console.log('tuned', result.row?.level, result.row?.tuning, result.error || result.seconds?.toFixed(1) + 's'); next();
      }); next();
    })));
  }
  module.exports = { run };
  if (require.main === module) run(process.argv[2], process.argv[3], +(process.argv[4] || 4), process.argv[5]).catch(e => { console.error(e); process.exitCode = 1; });
}
