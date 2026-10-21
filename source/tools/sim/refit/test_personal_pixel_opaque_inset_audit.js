'use strict';
const assert = require('assert/strict'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { bindRecording } = require('./personal_pixel_opaque_inset_audit.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-prefix-binding-'));
const write = (filename, value) => fs.writeFileSync(path.join(folder, filename), typeof value === 'string' ? value : JSON.stringify(value));
try {
  write('input.json', { entry: { game: { faces: [2, 2] } } });
  write('0.json', { position: 0, bankFiles: ['0-tile0.json.gz'] });
  for (const filename of ['0.png', '0-after.png', '0-tile0.json.gz']) write(filename, 'fixture bytes ' + filename);
  const evidence = { outcome: 'unresolvedDeterministicPublicPolicyCycle', observedCompleteFrames: 1,
    inputSha256: hash(fs.readFileSync(path.join(folder, 'input.json'))),
    frameHashes: { '0.json': hash(fs.readFileSync(path.join(folder, '0.json'))) } };
  write('cycle-stop-evidence.json', evidence);
  write('1-tile0.json.gz', 'in-flight bank, not a completed frame');
  const bound = bindRecording(folder, true);
  assert.equal(bound.frames, 1); assert.equal(bound.recordingStatus, 'incompleteCycleStoppedPrefix');
  assert.equal(Object.keys(bound.artifacts).length, 6); assert(!('1-tile0.json.gz' in bound.artifacts));
  assert.throws(() => bindRecording(folder, false), /ENOENT/);
  write('0.json', { position: 0, bankFiles: [] });
  assert.throws(() => bindRecording(folder, true), /AssertionError/);
  write('0.json', { position: 0, bankFiles: ['0-tile0.json.gz'] });
  write('cycle-stop-evidence.json', { ...evidence, observedCompleteFrames: 2 });
  assert.throws(() => bindRecording(folder, true), /AssertionError/);
  write('cycle-stop-evidence.json', evidence);
  write('input.json', { changed: true }); assert.throws(() => bindRecording(folder, true), /AssertionError/);
  write('report.json', { frames: 1, artifacts: { 'input.json': 'incorrect' } });
  assert.throws(() => bindRecording(folder, false), /AssertionError/);
  write('report.json', { frames: 1, artifacts: { 'input.json': hash(fs.readFileSync(path.join(folder, 'input.json'))) } });
  assert.equal(bindRecording(folder, false).recordingStatus, 'completedRun');
  console.log('PASS explicit prefix status, contiguous committed-frame hashes, original input binding, complete PNG/bank binding, in-flight exclusion and completed-run verification');
} finally { fs.rmSync(folder, { recursive: true, force: true }); }
