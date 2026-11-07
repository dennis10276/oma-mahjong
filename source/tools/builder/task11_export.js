'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto'), M = require('../factory/meter.js'), P = require('./task11_plan.js');
const SOURCE = path.resolve(__dirname, '../..'), BASE = path.join(SOURCE, 'build/why-hard-v1'), OUT = path.join(SOURCE, 'analysis/builder/why-hard-v1'), EXTERNAL = path.resolve(SOURCE, '../../codex-tasks/results/why-hard-v1');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function copyTree(from, to, filter = () => true, prefix = '') {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const rel = prefix + e.name; if (!filter(rel, e.isDirectory())) continue;
    if (e.isDirectory()) copyTree(path.join(from, e.name), path.join(to, e.name), filter, rel + '/');
    else fs.copyFileSync(path.join(from, e.name), path.join(to, e.name));
  }
}
function apiManifest(studies, fit) {
  const jobs = new Map(), add = (design, settings, fingerprint) => {
    const key = M.digest({ fingerprint, input: M.boardOf(design), settings: { runs: 20, seeds: 2, seed: 4711, ...settings } });
    jobs.set(key, { fingerprint, boardKey: M.boardKey(design), settings: { runs: 20, seeds: 2, seed: 4711, ...settings } });
  };
  for (const dir of studies) {
    const p = P.read(path.join(dir, 'protocol.json')), plan = P.read(path.join(dir, 'plan.json'));
    for (const b of plan.boards.filter(b => !b.fail)) for (const s of p.settings) add(b.design, s, p.bot);
  }
  // The reference counterpart of every candidate board is part of the paired evidence.
  const rerate = P.read(path.join(SOURCE, 'build/why-hard-key-memory/plan.json')), proto = P.read(path.join(SOURCE, 'build/why-hard-key-memory/protocol.json'));
  for (const b of rerate.boards) for (const s of proto.settings) add(b.design, s, fit.versions.reference);
  for (const b of fit.benches) for (const fingerprint of Object.values(fit.versions)) add(b.design, { ...fit.settings, setting: b.setting }, fingerprint);
  const rows = [];
  for (const [key, info] of jobs) {
    const file = path.join(SOURCE, 'build/factory-cache', key + '.json'); if (!fs.existsSync(file)) throw Error('Required raw meter return missing: ' + key);
    const raw = fs.readFileSync(file), result = JSON.parse(raw); if (!result.valid) throw Error('Invalid raw meter return');
    const gzip = zlib.gzipSync(raw, { level: 6 }), dest = path.join(EXTERNAL, 'full-api', key + '.json.gz'); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, gzip);
    rows.push({ key, ...info, expectedTries: result.expectedTries, file: 'full-api/' + key + '.json.gz', contentSHA256: sha(raw), gzipSHA256: sha(gzip), bytes: raw.length });
  }
  return { note: 'Exact meter API cache returns. Compact capture retains the API\'s sampled campaign details and last5 decisions per attempt; it is not a claim that all40 pooled campaigns or both planner-style traces are returned. Complete diagnostic tap traces are separately retained in reference/traces and candidate/traces. No new measurements or cache migration during export.', rows };
}
function run() {
  const fitSummary = P.read(path.join(BASE, 'fit/summary.json')); if (!fitSummary.complete) throw Error('Do not export a final handback while fit is incomplete');
  const dirs = [['reference', BASE], ['v3-reference', path.join(SOURCE, 'build/why-hard-v3')]];
  if (fitSummary.accepted) {
    if (!P.read(path.join(SOURCE, 'build/why-hard-key-memory/rerating-summary.json')).complete) throw Error('Re-rating incomplete');
    dirs.push(['candidate', path.join(SOURCE, 'build/why-hard-key-memory')], ['v3-candidate', path.join(SOURCE, 'build/why-hard-v3-candidate')]);
  }
  for (const [name, dir] of dirs) {
    copyTree(dir, path.join(EXTERNAL, name));
    copyTree(dir, path.join(OUT, name), (rel, isDir) => !rel.startsWith('labels-v1-backup') && (!rel.startsWith('playable-examples/') || isDir || /\.(png|md)$/.test(rel)));
  }
  const studies = [path.join(SOURCE, 'build/why-hard-v3/ladder-readable')];
  if (fitSummary.accepted) studies.push(path.join(SOURCE, 'build/why-hard-key-memory'));
  const api = fitSummary.accepted ? apiManifest(studies, P.read(path.join(BASE, 'fit/plan.json'))) : { note: 'Candidate rejected; see reference fit evidence.', rows: [] };
  P.save(OUT, 'full-api-manifest.json', api); P.save(EXTERNAL, 'full-api-manifest.json', api);
  fs.copyFileSync(path.join(SOURCE, 'build/TASK-11-RUNNING.md'), path.join(EXTERNAL, 'RUNNING.md'));
  for (const dir of [OUT, EXTERNAL]) {
    const files = []; const walk = sub => { for (const e of fs.readdirSync(sub, { withFileTypes: true })) { const f = path.join(sub, e.name); if (e.isDirectory()) walk(f); else if (e.name !== 'manifest-sha256.json') files.push({ file: path.relative(dir, f).replace(/\\/g, '/'), sha256: sha(fs.readFileSync(f)), bytes: fs.statSync(f).size }); } }; walk(dir);
    P.save(dir, 'manifest-sha256.json', { created: new Date().toISOString(), files });
  }
  return { source: OUT, results: EXTERNAL, apiReturns: api.rows.length };
}
if (require.main === module) console.log(run());
module.exports = { run, copyTree };
