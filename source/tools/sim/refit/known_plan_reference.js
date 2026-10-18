'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const DATA_FILE = 'analysis/archive/personal-bots/policy-known-plan-prefix-data.json';
const sourceRoot = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function inside(root, filename) {
  const resolved = path.resolve(root, filename);
  assert(resolved.startsWith(path.resolve(root) + path.sep), 'Reference path escapes its pinned source root');
  return resolved;
}

function referenceData(root = sourceRoot, snapshot = path.join(root, 'analysis/archive/personal-bots/experiments/personal-known-plan-actions-2026-10-18T07-00-31-837Z')) {
  const manifestFile = inside(snapshot, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestFile));
  const bytes = fs.readFileSync(inside(root, DATA_FILE));
  assert.equal(hash(bytes), manifest.files[DATA_FILE], 'Reference feature values changed from the frozen action fit');
  const data = JSON.parse(bytes), digest = crypto.createHash('sha256');
  const files = [manifestFile, inside(snapshot, DATA_FILE)];
  assert.equal(hash(fs.readFileSync(files[1])), manifest.files[DATA_FILE]);
  for (const filename of data.fingerprintFiles) {
    const local = Object.hasOwn(manifest.files, filename);
    const expected = local ? manifest.files[filename] : manifest.externalPinnedDependencies[filename];
    assert(expected, 'Missing immutable reference dependency: ' + filename);
    const source = inside(local ? snapshot : root, filename), content = fs.readFileSync(source);
    assert.equal(hash(content), expected, 'Immutable feature-training source changed: ' + filename);
    digest.update(filename).update(content);
    files.push(source);
  }
  assert.equal(digest.digest('hex'), data.fingerprint, 'Immutable feature-training fingerprint differs');
  return { data, referenceFeatureFingerprint: data.fingerprint,
    referenceFiles: [...new Set(files.map(filename => path.relative(root, filename).replace(/\\/g, '/')))] };
}

module.exports = { DATA_FILE, referenceData };
