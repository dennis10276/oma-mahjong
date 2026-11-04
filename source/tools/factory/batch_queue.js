'use strict';
const fs = require('fs'), path = require('path');
const { Worker } = require('worker_threads');
const { atomicJson } = require('./meter.js');
const { predictTries } = require('./predict.js');

async function main(poolFile, planFile, dir, jobs = 4) {
  let rows = JSON.parse(fs.readFileSync(poolFile)), stamp = fs.statSync(poolFile).mtimeMs;
  const plan = JSON.parse(fs.readFileSync(planFile));
  const running = new Set(); let completed = 0, last = '';
  const file = (r, mode) => path.join(dir, r.id + '.' + mode + '.json');
  const read = (r, mode) => fs.existsSync(file(r, mode)) ? JSON.parse(fs.readFileSync(file(r, mode))) : null;
  function fits(r, rate) {
    const exp = (rate.train?.exp + rate.validation?.exp) / 2;
    return rate.train?.valid && rate.validation?.valid && plan.levels.some(p =>
      (r.origin?.intendedLevel == null || r.origin.intendedLevel === p.level) &&
      (r.n > 88) === p.big && Math.abs(exp - p.target) <= plan.tolerance && Math.abs(rate.train.exp - rate.validation.exp) <= (plan.maxSeedGap ?? 2));
  }
  function next() {
    // Finish verification of viable candidates before expanding the pool.
    const qualityCounts = {};
    for (const r of rows) if (read(r, 'quality')?.eligible && fits(r, read(r, 'rate') || {})) qualityCounts[r.level] = (qualityCounts[r.level] || 0) + 1;
    const needs = r => (qualityCounts[r.level] || 0) < (plan.qualityPerLevel ?? 2);
    const ready = rows.filter(r => { const rate = read(r, 'rate');
      return needs(r) && rate && fits(r, rate) && !read(r, 'quality') && !running.has(r.id + '.quality'); });
    ready.sort((a, b) => (a.n > 88 ? -10 : 0) - (b.n > 88 ? -10 : 0) || (qualityCounts[a.shape] || 0) - (qualityCounts[b.shape] || 0));
    if (ready.length) return { row: ready[0], mode: 'quality' };
    const candidates = rows.filter(r => {
      const s = read(r, 'screen');
      return needs(r) && s?.valid && s.exp >= 5 && s.exp <= 12 && !read(r, 'rate') && !running.has(r.id + '.rate');
    });
    // Spread early work across shapes rather than spending the budget on one pile.
    const counts = {};
    for (const r of rows) if (read(r, 'rate')) counts[r.shape] = (counts[r.shape] || 0) + 1;
    candidates.sort((a, b) => (qualityCounts[a.level] || 0) - (qualityCounts[b.level] || 0) ||
      Math.abs(read(a, 'screen').exp - a.target) - Math.abs(read(b, 'screen').exp - b.target));
    if (candidates.length) return { row: candidates[0], mode: 'rate' };
    const scouts = rows.filter(r => needs(r) && !read(r, 'screen') && !running.has(r.id + '.screen'));
    // learned from earlier batches (predict.js): the boards most likely to land near their target are screened first
    scouts.sort((a, b) => Math.abs(Math.log(predictTries(a) / a.target)) - Math.abs(Math.log(predictTries(b) / b.target)));
    return scouts.length ? { row: scouts[0], mode: 'screen' } : null;
  }
  await Promise.all(Array.from({ length: jobs }, () => new Promise((resolve, reject) => {
    const w = new Worker(path.join(__dirname, 'batch_evaluate.js'));
    w.on('error', reject);
    function dispatch() {
      if (fs.existsSync(path.join(dir, 'pause-queues'))) { w.terminate().then(resolve, reject); return; }
      const changed = fs.statSync(poolFile).mtimeMs;
      if (changed !== stamp) { rows = JSON.parse(fs.readFileSync(poolFile)); stamp = changed; }
      const task = next();
      if (task) { running.add(task.row.id + '.' + task.mode); console.log('start', task.mode, task.row.id, task.row.shape); w.postMessage(task); return; }
      const screens = rows.filter(r => read(r, 'screen')).length;
      const status = `${screens}/${rows.length} screened; ${rows.filter(r => read(r, 'rate')).length} rated; ${rows.filter(r => read(r, 'quality')?.eligible).length} quality passes`;
      if (status !== last) { console.log(status); last = status; }
      if (!running.size && !fs.existsSync(path.join(dir, 'producer-running'))) { w.terminate().then(resolve, reject); return; }
      setTimeout(dispatch, 5000);
    }
    w.on('message', result => {
      atomicJson(file(result, result.mode), result); running.delete(result.id + '.' + result.mode); completed++;
      console.log(completed, result.mode, result.id, JSON.stringify({ exp: result.train?.exp, validation: result.validation?.exp,
        skilled: result.skilled?.exp, eligible: result.eligible, reason: result.reason, idle: result.idle }), result.seconds?.toFixed(1) + 's');
      dispatch();
    });
    dispatch();
  })));
}
module.exports = { main };
if (require.main === module) main(...process.argv.slice(2, 5), +(process.argv[5] || 4)).catch(e => { console.error(e); process.exitCode = 1; });
