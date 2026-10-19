'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { openingFeatures, SCHEMA } = require('./personal_public_opening.js');
const { boardId } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(tableFile) {
  assert(tableFile, 'Supply the independently preserved causal feature table');
  const inputFile = path.join(root, 'analysis/archive/personal-bots/experiments/personal-joint-intents-first-2026-10-18T20-50-31-269Z/analysis/archive/personal-bots/personal-fresh-count-input.json');
  const inputBytes = fs.readFileSync(inputFile), tableBytes = fs.readFileSync(tableFile);
  assert.equal(hash(inputBytes), 'e9968c817ebe64b49a02a9ac6eac702014d0f2f1023e02141f2133d22c66c835');
  const input = JSON.parse(inputBytes), table = JSON.parse(tableBytes), fields = {}, differences = [];
  for (const row of [...input.recent, ...input.future]) {
    assert.equal(boardId(decodeGame(row.game)), row.board);
    const archived = table.byLevelBoard[row.name + '|lv=' + row.lv + '|' + row.board];
    assert(archived, 'Missing exact-board archived geometry');
    const measured = openingFeatures(row.game);
    const changed = JSON.parse(JSON.stringify(row.game));
    changed.faces = changed.faces.map((value, index) => changed.down[index] ? (value + 1) % 38 : value);
    assert.deepEqual(openingFeatures(changed), measured, 'An unseen down tile changed opening geometry');
    for (const [key, value] of Object.entries(measured.features)) {
      fields[key] = (fields[key] || 0) + 1;
      if (Math.abs(archived.features[key] - value) > 1e-9) differences.push({ name: row.name, lv: row.lv, key, measured: value, archived: archived.features[key] });
    }
  }
  const report = { made: new Date().toISOString(), evidence: 'independent-exact-board-public-opening-geometry-reproduction',
    targetMet: false, schema: SCHEMA, boards: input.recent.length + input.future.length, fields, differences,
    inputSha256: hash(inputBytes), tableFile: path.resolve(tableFile), tableSha256: hash(tableBytes),
    sourceHashes: Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
      .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))])),
    note: 'Reproduces six archived fields with explicit half-supported-tile units on124 exact boards. '
      + 'Checks hidden-down-picture invariance; unit tests also check covered pictures and encoded ice/locks. '
      + 'Does not certify unreproduced simulation fields, fitted thresholds or future prediction accuracy.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/public-opening-geometry-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ boards: report.boards, fields, differences: differences.length, targetMet: false }));
  if (differences.length) process.exitCode = 2;
}

if (require.main === module) main(process.argv[2]);
