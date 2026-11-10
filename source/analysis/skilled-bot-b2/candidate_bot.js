'use strict';
// Candidate skilled benchmark bot (Task B2)
// Version: skilled-b2-candidate-v1
// Evaluates boards using the repaired candidate planner controller with:
// - True target-specific tray relief in lookPenalty (carrying targetFace and simulating exact tray transitions)
// - Correct bitword checking across all 4 32-bit words (tiles 0-127) for unblocking heuristics
// - Expanded child beam search with structural tie-breaking
// - Honest pooled population statistics across all seed blocks and both planner styles

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
