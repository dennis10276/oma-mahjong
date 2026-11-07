'use strict';
// Zero-drift fast path for the skilled planner (and reference Dennis/family profiles); human_bot.js is unchanged.
const { measureHuman: measure } = require('./human_planner_measure_fast.js');
const { critique } = require('./human_critic.js');
const VERSION = require('./human_release.js').version;

const aliases = {
  'planner-fast-v1': 'planner',
  'planner-reference-v1': 'planner',
  'dennis-reference-v1': 'dennis',
};

function normalizeSetting(setting) {
  return aliases[setting] || setting || 'planner';
}

function measureHuman(board, options = {}) {
  return measure(board, { ...options, setting: normalizeSetting(options.setting) });
}

function measureHumanFast(board, options = {}) {
  return measure(board, { ...options, fast: true, setting: normalizeSetting(options.setting) });
}

function measureHumanSlow(board, options = {}) {
  return measure(board, { ...options, fast: false, setting: normalizeSetting(options.setting) });
}

module.exports = { measureHuman, measureHumanFast, measureHumanSlow, critique, VERSION, supportsAllResults: true };
if (require.main === module) {
  const fs = require('fs');
  const board = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  process.stdout.write(JSON.stringify(measureHuman(board, { runs: Number(process.argv[3] ?? 20), setting: process.argv[4] ?? 'planner' }), null, 2) + '\n');
}
