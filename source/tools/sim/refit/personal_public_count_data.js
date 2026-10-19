'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { PIDS } = require('./mimic_games.js');
const { boardId } = require('./personal_model.js');
const { encodeGame } = require('./personal_game_io.js');
const { openingFeatures } = require('./personal_public_opening.js');
const { restoreBoard } = require('./personal_policy_temperature_data.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function publicFeatures(game) {
  const measured = openingFeatures(game);
  return { ...measured.features, hasClock: Number(!!game.clock), clockBudget: game.clock?.n || 0,
    mateSamples: measured.diagnostics.visibleMateSamples };
}

function main() {
  const sourceHashes = {}, read = filename => {
    const bytes = fs.readFileSync(path.join(root, filename)); sourceHashes[filename] = hash(bytes); return JSON.parse(bytes);
  };
  const snapshot = 'analysis/archive/personal-bots/experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z';
  const manifest = read(snapshot + '/manifest.json');
  const replays = Object.fromEntries(Object.entries(PIDS).map(([name, pid]) => {
    const relative = 'analysis/archive/replays/' + pid + '.json', filename = snapshot + '/' + relative;
    const payload = read(filename); assert.equal(sourceHashes[filename], manifest.files[relative]); return [name, payload];
  }));
  const countsFile = 'analysis/archive/personal-bots/runs/fresh-count-2026-10-18T16-12-34-747Z/analysis/archive/personal-bots/physical-fresh-count-data.json';
  const counts = read(countsFile);
  assert.equal(sourceHashes[countsFile], 'bb6135fe7cd78ae899db3cd9fe3c55da2c0d2e6ae48adee49485e7f8eba64f3a');
  const rows = [], missing = [];
  for (const row of counts.rows) {
    try {
      const game = restoreBoard(row, replays[row.name]);
      assert.equal(boardId(game), row.board);
      rows.push({ name: row.name, lv: row.lv, version: row.version, board: row.board,
        start: row.start, end: row.end, wonOn: row.wonOn, firstAttempt: row.firstAttempt,
        firstClear: row.firstClear, boardChangedWithinCampaign: row.boardChangedWithinCampaign,
        assisted: row.assisted, openingRecorded: row.openingRecorded,
        features: publicFeatures(encodeGame(game)) });
    } catch (error) {
      missing.push({ name: row.name, lv: row.lv, start: row.start, board: row.board, reason: error.message });
    }
  }
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    sourceHashes[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  }
  for (const filename of fs.readdirSync(path.join(__dirname, 'tables')).filter(name => /^(levels|hard|early)-.*\.js$/.test(name))) {
    const relative = 'tools/sim/refit/tables/' + filename;
    sourceHashes[relative] = hash(fs.readFileSync(path.join(root, relative)));
  }
  const report = { made: new Date().toISOString(), evidence: 'exact-public-opening-own-count-training-data', targetMet: false,
    rows, missing, comparisonEpisodes: counts.comparisonEpisodes, additionalRecentIds: counts.additionalRecentIds,
    sourceHashes, note: 'Geometry only: no generic reference player, other-person fitted actor or guessed simulation field. '
      + 'Exact recorded/fixed-table board identity is checked. Missing boards stay explicit. Older counts without recorded '
      + 'opening timestamps are training/development-only, never frozen-before-start accuracy evidence.' };
  const output = path.join(root, 'analysis/archive/personal-bots/personal-public-count-data.json');
  fs.writeFileSync(output, JSON.stringify(report), { flag: 'wx' });
  console.log(JSON.stringify({ rows: rows.length, missing: missing.length, output }));
}

if (require.main === module) main();
module.exports = { publicFeatures };
