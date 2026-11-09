'use strict';
// Candidate skilled benchmark bot (Task B1)
// Version: skilled-b1-candidate-v1
// Evaluates boards using the candidate planner controller with expanded beam search,
// tie-breaking child heuristics, true tray relief, and orphan tray reservation.

const { measureHuman: measure, VERSION } = require('./candidate_measure.js');

function normalizeSetting(setting) {
  return setting || 'planner';
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

module.exports = {
  measureHuman,
  measureHumanFast,
  measureHumanSlow,
  VERSION,
  supportsAllResults: true,
};

if (require.main === module) {
  const fs = require('fs');
  const board = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  process.stdout.write(JSON.stringify(measureHuman(board, {
    runs: Number(process.argv[3] ?? 20),
    setting: process.argv[4] ?? 'planner',
  }), null, 2) + '\n');
}
