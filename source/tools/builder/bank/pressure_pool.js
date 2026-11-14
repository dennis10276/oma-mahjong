'use strict';
// Finish old retune records and new frozen-role variants for assignment.
// Run via heavy.js. Wall cap kills only this command's own workers.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../../../..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const OUT = path.resolve(ROOT, arg('out', 'source/build/traps/batch-pressure'));
const pools = ['batch-pool', 'batch-pool-2', 'batch-pool-ui'].map(x => path.join(ROOT, 'source/build/traps', x));
const rt = path.join(ROOT, 'source/build/traps/batch-retune');
function list() {
  const MB = require('./make_batch.js'), earlier = MB.loadEarlier(MB.config({ earlier: 'source/analysis/builder/bank/placed-250-retuned,source/analysis/builder/bank/batch-250-289' }));
  const groups = new Map();
  for (const dir of pools) if (fs.existsSync(dir)) for (const file of fs.readdirSync(dir).filter(f => /^\d+-.*\.json$/.test(f))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!j.ok || j.links < 3 || earlier.hosts.has(j.job.layout + '/' + j.job.si)) continue;
    for (const v of j.variants.filter(v => v.ok && v.score >= 5.4)) {
      const id = file.slice(0, -5) + '-' + v.tier;
      if (fs.existsSync(path.join(OUT, id + '.json'))) continue;
      const rf = path.join(rt, id + '.json'), old = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : null;
      if (!old?.ok && !j.uiFeature) continue;
      const row = { dir, file, tier: v.tier, id, rt: old?.ok ? rf : null, si: j.job.si, layout: j.job.layout, score: old?.score || v.score, ui: !!j.uiFeature, big: v.design.tiles.length === 96 };
      if (!groups.has(row.si)) groups.set(row.si, []); groups.get(row.si).push(row);
    }
  }
  for (const g of groups.values()) g.sort((a, b) => Number(b.big) - Number(a.big) || b.score - a.score);
  const todo = [], keys = [...groups.keys()].sort((a, b) => Number(groups.get(b)[0].ui) - Number(groups.get(a)[0].ui) || groups.get(a).length - groups.get(b).length);
  for (let i = 0; i < Math.max(0, ...[...groups.values()].map(x => x.length)); i++) for (const k of keys) if (groups.get(k)[i]) todo.push(groups.get(k)[i]);
  return todo.slice(0, +arg('limit', 100));
}
function worker() {
  const R = require('./retune.js'), todo = JSON.parse(fs.readFileSync(arg('jobs'), 'utf8')), w = +arg('worker'), W = +arg('workers', 4);
  for (const [i, row] of todo.entries()) if (i % W === w) {
    const out = path.join(OUT, row.id + '.json'); if (fs.existsSync(out)) continue;
    let res;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(row.dir, row.file), 'utf8')), raw = j.variants.find(v => v.tier === row.tier);
      const start = row.rt ? JSON.parse(fs.readFileSync(row.rt, 'utf8')) : R.retuneRecord(j.job, raw, { tier: row.tier, wallMs: 15000, totalMs: 90000 });
      res = start.ok ? R.forceRecord(j.job, { ...raw, ...start }, { tier: row.tier, ms: +arg('ms', 20000), seed: +arg('seed', 7) }) : start;
    } catch (e) { res = { ok: false, why: String(e.stack || e) }; }
    fs.writeFileSync(out, JSON.stringify({ file: row.file, tier: row.tier, ...res }));
    console.log(row.id, res.ok ? 'PASS score ' + res.score + ' forced ' + res.card.forcedTail.episodes.lowerBound : res.why);
  }
}
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (arg('worker', null) !== null) return worker();
  const todo = list(), jf = path.join(OUT, '_jobs-' + process.pid + '.json'), W = +arg('workers', 4); fs.writeFileSync(jf, JSON.stringify(todo));
  console.log('pressure pool', todo.length, 'jobs', [...new Set(todo.map(j => j.si))]);
  const kids = []; let running = W;
  const timer = setTimeout(() => { console.log('pressure pool wall limit'); for (const c of kids) c.kill(); }, +arg('wall-ms', 900000));
  for (let w = 0; w < W; w++) {
    const c = cp.spawn(process.execPath, [__filename, ...process.argv.slice(2), '--worker', String(w), '--jobs', jf], { stdio: 'inherit' }); kids.push(c);
    c.on('exit', () => { if (!--running) { clearTimeout(timer); fs.rmSync(jf, { force: true }); console.log('pressure pool complete'); } });
  }
}
if (require.main === module) main();
