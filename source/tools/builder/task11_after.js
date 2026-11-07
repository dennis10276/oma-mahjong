'use strict';
// Sequential post-rating phases. Safe to resume; refuses incomplete/invalid ratings.
const fs = require('fs'), path = require('path'), cp = require('child_process'), P = require('./task11_plan.js');
async function run() {
  const source = path.resolve(__dirname, '../..'), repo = path.dirname(source), baseline = path.join(source, 'build/why-hard-v1'), primary = path.join(source, 'build/why-hard-v3');
  const candidate = path.join(source, 'build/why-hard-key-memory'), ladder = path.join(source, 'build/why-hard-v3-candidate');
  const summary = require('./task11_rerate.js').report(candidate); if (!summary.complete || summary.invalid) throw Error('Candidate ratings incomplete or invalid');
  console.log('PHASE full ratings complete', summary.kept, summary.hidden);
  cp.execFileSync('git', ['fetch', 'origin'], { cwd: repo, stdio: 'inherit' });
  const upstream = cp.execFileSync('git', ['rev-parse', 'origin/wip/level-builder'], { cwd: repo, encoding: 'utf8' }).trim();
  if (upstream !== '0e9d6479bd121d81905b6cf28fc450c2ab49f5d2') throw Error('Review new upstream at this safe phase boundary before continuing (including G2 fast mode): ' + upstream);
  const fp = require('../factory/meter.js').createMeter({ botVersion: 'family-key-memory-v1' }).fingerprint;
  if (require('../factory/meter.js').createMeter().fingerprint !== fp) throw Error('Use HUMAN_BOT=candidate for the capture phase');
  require('./task11_candidate_study.js').prepare(baseline, primary, candidate, ladder);
  console.log('PHASE exact ten-board candidate memory audit');
  await require('./task11_capture.js').run(candidate, 4, 'keys');
  require('./task11_key_memory.js').report(candidate);
  console.log('PHASE memory comparison', require('./task11_candidate_study.js').compareMemory(baseline, candidate).candidate);
  const incidental = require('./task11_incidental.js').check(primary, candidate);
  console.log('PHASE incidental originality', incidental.bothBands, incidental.originalInBothBands);
  const python = path.join(source, 'build/task10-python/Scripts/python.exe');
  cp.execFileSync(python, [path.join(__dirname, 'task11_plot.py'), ladder], { stdio: 'inherit', env: { ...process.env, MPLCONFIGDIR: path.join(source, 'build/task11-matplotlib') } });
  const tests = ['builder', 'factory'].flatMap(dir => fs.readdirSync(path.join(source, 'tools', dir)).filter(f => /^test_.*\.js$/.test(f)).map(f => path.join(source, 'tools', dir, f)));
  tests.push(path.join(source, 'tools/sim/refit/test_human_key_memory_controller.js'));
  // Tests exercise the released default as well as the explicit candidate; no env override.
  const env = { ...process.env }; delete env.HUMAN_BOT;
  const log = fs.openSync(path.join(source, 'build/task11-tests.log'), 'w'); let test;
  try { test = cp.spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...tests], { cwd: repo, env, stdio: ['ignore', log, log] }); }
  finally { fs.closeSync(log); }
  if (test.status !== 0) throw Error('Factory/builder/bot regression suite failed; inspect task11-tests.log');
  console.log('PHASE regression suite passed');
  P.save(baseline, 'post-rating-phases.json', { completed: new Date().toISOString(), candidateFingerprint: fp, allRatingsValid: true, keyAuditComplete: true, candidateLadderComplete: true, regressionSuitePassed: true, finalHandbackPending: true });
}
if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run };
