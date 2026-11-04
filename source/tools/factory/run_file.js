'use strict';
const fs = require('fs'), path = require('path');
const { createSteerer } = require('./steer_design.js');
const { digest, sourceHash, atomicJson } = require('./meter.js');
const readRows = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim()).map(JSON.parse);

function runFile(startFile, outFile, options = {}) {
  if (path.resolve(startFile) === path.resolve(outFile)) throw Error('Input and output must differ');
  const starts = readRows(startFile), engine = createSteerer(options), progressFile = outFile + '.progress.json';
  if (new Set(starts.map(s => s.level)).size !== starts.length) throw Error('Duplicate level in input');
  const implementation = [__filename, '../lab/ideas.js', '../lab/exact.js', '../../www/hard.js', '../../www/layouts.js', '../sim/variety/piles.js']
    .map(f => sourceHash(path.resolve(__dirname, f)));
  const fingerprint = digest({ starts, bot: engine.meter.fingerprint, implementation, options,
    env: Object.fromEntries(['TOL', 'DENNIS_MAX', 'ATTR', 'STEPS'].map(k => [k, process.env[k] || null])) });
  let progress = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, 'utf8')) : { fingerprint, levels: {} };
  if (progress.fingerprint !== fingerprint) throw Error('Inputs, bot or steering options changed. Choose a new output file to keep the old run reproducible.');
  const rows = fs.existsSync(outFile) ? readRows(outFile) : [];
  if (rows.length && !fs.existsSync(progressFile)) throw Error('Output has no matching run manifest; choose a new output file');
  atomicJson(progressFile, progress);
  const done = new Set(rows.map(r => r.level));
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  for (const start of starts) {
    if (done.has(start.level)) continue;
    const begun = Date.now(), before = { ...engine.meter.stats };
    const row = engine.steer(start, progress.levels[start.level], state => {
      progress.levels[start.level] = state;
      atomicJson(progressFile, progress);
    });
    row.build = { seconds: +((Date.now() - begun) / 1000).toFixed(2), bot: engine.meter.fingerprint,
      calls: engine.meter.stats.calls - before.calls, hits: engine.meter.stats.hits - before.hits };
    rows.push(row);
    // Rewrite atomically: an interrupted append must not corrupt a resumable batch.
    const tmp = outFile + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    fs.renameSync(tmp, outFile);
    console.log(start.level, row.pass ? 'PASS' : 'REVIEW', 'family', row.g61.exp, 'target', row.target,
      'skilled', row.skilled, 'holdout', row.holdout?.exp ?? '-', row.build.seconds + 's');
  }
  return { rows, stats: engine.meter.stats };
}
module.exports = { runFile, readRows };
