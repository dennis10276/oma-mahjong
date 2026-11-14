'use strict';
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), crypto = require('crypto'), cp = require('child_process');
const OUT = __dirname, ROOT = path.resolve(OUT, '../../..'), SHARED = path.dirname(ROOT);
const read = f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const snapshot = read('snapshot.json'), a = read('port8264-mapping.json'), b = read('task17-mapping.json'), check = read('level312-mechanical-check.json'), reuse = read('reuse-audit.json');
assert.equal(a.records.filter(r => r.rating?.note?.trim()).length, 7);
for (const r of a.records.filter(r => r.rating?.note?.trim())) {
  assert.equal(r.exactPlacedMatches.length, 1);
  assert.equal(r.exactPlacedMatches[0].level, r.labelLevel);
}
assert.equal(b.records.length, 8); assert.ok(b.records.every(r => r.reportMatchesLiveRating));
assert.ok(a.records.every(r => !b.records.some(t => t.id === r.id)));
assert.ok(snapshot.http.every(r => r.status === 200 && r.matchesDisk));
assert.equal(reuse.records.length, 29);
assert.ok(reuse.records.every(r => !r.exactMatches250to300.length && !r.samePairingAllowingMirrorsAndRenumbering250to300.length));
assert.ok(check.strictReplay.ok); assert.equal(check.clock.k, 18); assert.equal(check.clock.n, 19);
assert.ok(check.designatedBaits.every(r => r.resultAtShippedClock === 'lose' && r.sourceBaitFacesUnchanged));
for (const s of snapshot.rawSources) assert.equal(hash(fs.readFileSync(s.path)), s.sha256, 'source changed since capture: ' + s.path);
for (const [folder, expected] of [['cc-builder-loop', snapshot.branches.claude], ['codex-chained-2', snapshot.branches.task17]]) {
  assert.equal(cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.join(SHARED, folder), encoding: 'utf8' }).trim(), expected);
}
const archived = cp.execFileSync('git', ['rev-parse', 'refs/archive/codex-task16-post-takeover'], { cwd: ROOT, encoding: 'utf8' }).trim();
assert.equal(archived, '8d8d9b06c27b90a30aad186d97c44bfebdfc45a3');
const sourceChanges = cp.execFileSync('git', ['diff', '--name-only', '56c0218f', '--', 'source'], { cwd: ROOT, encoding: 'utf8' });
assert.equal(sourceChanges.trim(), '', 'handoff must not change builder/game/boards');
console.log('Verified: separate 7+8 verbatim review mappings; current source hashes; 29-board reuse audit; 312 mechanical checks; archived stale work; no source changes.');
