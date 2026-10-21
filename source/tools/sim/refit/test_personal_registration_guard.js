'use strict';
const assert = require('assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const { assertUnregistered, registerNewLedger } = require('./generate_personal_witness_v3.js');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-registration-'));
const target = path.join(folder, 'synthetic-test-candidate.jsonl');
try {
  assertUnregistered(target);
  registerNewLedger(target, { evidence: 'synthetic-unit-test-only', predictedAttempt: 1 });
  const original = fs.readFileSync(target);
  assert.throws(() => assertUnregistered(target), /Refusing to overwrite/);
  assert.throws(() => registerNewLedger(target, { predictedAttempt: 8 }), { code: 'EEXIST' });
  assert.deepEqual(fs.readFileSync(target), original);
  console.log('PASS: early refusal and exclusive registration preserve every original byte');
} finally {
  fs.unlinkSync(target);
  fs.rmdirSync(folder);
}

// Exercise the actual CLI entry point against the registered candidate. It must
// refuse before writing calibration or starting a simulation job.
const root = path.resolve(__dirname, '../../../..');
const protectedPaths = ['source/analysis/personal-bots/personal-source-bound-causal-forecasts-v3.jsonl',
  'source/analysis/personal-bots/personal-behavioral-fit.json'].map(p => path.join(root, p));
const before = protectedPaths.map(p => fs.readFileSync(p));
const attempt = spawnSync(process.execPath, [path.join(__dirname, 'generate_personal_witness_v3.js')],
  { encoding: 'utf8', timeout: 5000 });
assert.equal(attempt.status, 1, 'Actual registered v3 CLI must refuse immediately');
assert.match(attempt.stderr, /Refusing to overwrite registered candidate/);
assert.doesNotMatch(attempt.stdout, /Calibrating|Dispatching/);
protectedPaths.forEach((p, i) => assert.deepEqual(fs.readFileSync(p), before[i]));
console.log('PASS: actual generator CLI refuses before calibration and worker launch');
