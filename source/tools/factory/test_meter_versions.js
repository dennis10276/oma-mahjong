'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), os = require('os'), M = require('./meter.js');
test('named key-memory policy has a distinct fingerprint and cannot migrate reference ratings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task11-meter-'));
  try {
    const reference = M.createMeter({ bot: require.resolve('../sim/refit/human_bot.js') }), candidate = M.createMeter({ botVersion: 'family-key-memory-v1', cacheDir: dir });
    assert.equal(candidate.fingerprint, M.createMeter({ bot: M.BOT_VERSIONS['family-key-memory-v1'] }).fingerprint); assert.notEqual(candidate.fingerprint, reference.fingerprint);
    assert.equal(M.FAMILY_CACHE_MIGRATIONS[candidate.fingerprint], undefined);
    const d = { tiles: [[0, 0, 0], [4, 0, 0]], faces: [0, 0], down: [], obst: { ice: {}, keys: [], locks: [] }, clock: null }, settings = { runs: 1, seeds: 1, seed: 4711, setting: 'family' };
    const oldFile = path.join(dir, M.digest({ fingerprint: reference.fingerprint, input: M.boardOf(d), settings }) + '.json');
    fs.writeFileSync(oldFile, JSON.stringify({ valid: true, expectedTries: 17, results: [] }));
    assert.equal(candidate.measure(d, settings).expectedTries, 1); assert.equal(candidate.stats.calls, 1); assert.equal(candidate.stats.familyReused, 0);
    assert.equal(candidate.measure(d, settings).expectedTries, 1); assert.equal(candidate.stats.hits, 1);
    assert.throws(() => M.createMeter({ botVersion: 'unknown' }), /Unknown/);
    assert.throws(() => M.createMeter({ botVersion: 'family-key-memory-v1', bot: M.BOT_VERSIONS['family-key-memory-v1'] }), /conflicting/);
  } finally { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); fs.rmdirSync(dir); }
});
