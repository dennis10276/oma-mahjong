'use strict';
// Explicit opt-in candidate; human_bot.js and its released profiles are unchanged.
const release = require('./human_key_memory_release.js'), { measureHuman: measure } = require('./human_key_memory_measure.js');
const aliases = { 'family-key-memory-v1': 'family', 'planner-reference-v1': 'planner', 'dennis-reference-v1': 'dennis' };
function measureHuman(board, options = {}) {
  const setting = aliases[options.setting] || options.setting || 'family';
  const result = measure(board, { ...options, setting });
  return { ...result, version: release.version, calibrationStatus: release.calibrationStatus, profileName: release.profileNames[setting] };
}
module.exports = { measureHuman, VERSION: release.version };
