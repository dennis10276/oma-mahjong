'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Layouts = require('../../../www/layouts.js');
const { encodeGame } = require('./personal_game_io.js');
const { run, summarize } = require('./human_level_benchmark.js');
const { evaluateTrackA, projectRecordsToSalts, compare } = require('./human_level_evaluation.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
  const game = encodeGame({ tiles, nb: Layouts.neighbors(tiles), faces: [7, 7], down: [0, 0], rules: null, clock: null });
  const payload = { schema: 'human-level-design-catalog-v1', observedAt: 'transport-fixture', salts: [1, 2, 3], maxTries: 12,
    criticalLabs: [], failures: [21], guards: Array.from({ length: 20 }, (value, index) => index + 1),
    entries: Array.from({ length: 21 }, (value, index) => ({ lv: index + 1, wonOn: 1, kind: 'natural', game })), excluded: [] };
  const input = { ...payload, hash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'human-track-a-')), created = [];
  try {
    const developmentFiles = [], fullFiles = [];
    for (const shard of Array.from({ length: 12 }, (value, index) => index)) {
      const development = path.join(directory, 'development-' + shard + '.jsonl'); created.push(development);
      run(input, {}, 'development', shard, 12, development, [1]); developmentFiles.push(development);
      const full = path.join(directory, 'full-' + shard + '.jsonl'); created.push(full);
      run(input, {}, 'all', shard, 12, full); fullFiles.push(full);
    }
    const development = summarize(input, developmentFiles, 'development', { track: 'A' });
    const full = summarize(input, fullFiles, 'all', { track: 'A' });
    assert.deepEqual(development.salts, [1]); assert.deepEqual(full.salts, [1, 2, 3]);
    assert(development.passed && full.passed); assert.equal(full.rows.length, 21);
    assert.equal(full.correlation, null, 'Identical easy fixtures do not manufacture correlation');
    const actualFullRecords = fullFiles.flatMap(filename => fs.readFileSync(filename, 'utf8').trim().split(/\r?\n/).map(JSON.parse))
      .filter(row => row.type === 'board');
    const projected = evaluateTrackA(input.entries, projectRecordsToSalts(actualFullRecords, [1]));
    assert.deepEqual(compare(projected, development), { fixes: [], regressions: [], adopted: false,
      note: 'Adoption requires a repaired failing level and no formerly passing level broken on the same real boards and salts.' });
    assert.throws(() => run(input, {}, 'all', 0, 12, path.join(directory, 'unsupported.jsonl'), [2]));
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith('human-track-a-'));
    for (const filename of created) {
      assert.equal(path.dirname(filename), directory);
      if (fs.existsSync(filename)) fs.unlinkSync(filename);
    }
    fs.rmdirSync(directory);
  }
  console.log('PASS salt1 development and full three-salt transport replay actual games, frozen baseline projection agrees, and Track A does not require later strength-calibration metrics');
}

if (require.main === module) test();
module.exports = test;
