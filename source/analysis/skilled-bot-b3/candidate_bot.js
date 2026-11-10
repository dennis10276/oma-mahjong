'use strict';
// Candidate skilled benchmark bot (Task B3)
// Version: skilled-b3-candidate-v1
// Evaluates boards using the repaired candidate planner controller with:
// - True target-specific tray relief in lookPenalty (carrying targetFace and simulating exact tray transitions)
// - Correct bitword checking across all 4 32-bit words (tiles 0-127) for unblocking heuristics
// - Restored lock route dependency in usableInBits (preventing traversal of closed locks when keys are unknown)
// - Key memory target integration in decide() for role mapping and unblocking bitwords
// - Restrained beam width (kLim=6) to focus deep routing without beam dilution
// - Fixed face-down NO_PIC handling in suggestsNoEasyEscapeFast when tray is crowded
// - Removed spurious openPeek bonus when tray is congested (tray.length >= 2)
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
