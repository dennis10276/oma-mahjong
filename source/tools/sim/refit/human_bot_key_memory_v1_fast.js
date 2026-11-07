'use strict';
// Zero-drift fast path for the explicit key-memory candidate; human_bot_key_memory_v1.js is unchanged.
const release = require('./human_key_memory_release.js');
const { measureHuman: measure } = require('./human_key_memory_measure_fast.js');
const aliases = { 'family-key-memory-v1': 'family', 'planner-reference-v1': 'planner', 'dennis-reference-v1': 'dennis' };

function runWith(board, options = {}, forceFast) {
  const setting = aliases[options.setting] || options.setting || 'family';
  const nextOptions = forceFast === undefined ? { ...options, setting } : { ...options, fast: forceFast, setting };
  const result = measure(board, nextOptions);
  return { ...result, version: release.version, calibrationStatus: release.calibrationStatus, profileName: release.profileNames[setting] };
}

function measureHuman(board, options = {}) { return runWith(board, options); }
function measureHumanFast(board, options = {}) { return runWith(board, options, true); }
function measureHumanSlow(board, options = {}) { return runWith(board, options, false); }

module.exports = { measureHuman, measureHumanFast, measureHumanSlow, VERSION: release.version };
if (require.main === module) {
  const fs = require('fs');
  const board = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  process.stdout.write(JSON.stringify(measureHuman(board, { runs: Number(process.argv[3] ?? 20), setting: process.argv[4] ?? 'family' }), null, 2) + '\n');
}
