'use strict';
const reference = require('./human_release.js');
const profiles = Object.freeze({ Dennis: reference.profiles.Dennis,
  family: Object.freeze({ ...reference.profiles.family, retryKeyIdentityMemory: 1, rememberObservedKeyRoles: 1 }) });
module.exports = Object.freeze({ schema: 'human-person-candidate-v1', version: 'human-g6.3-key-memory-candidate1',
  calibrationStatus: 'experimental-awaiting-real-player-fit', profiles,
  profileNames: Object.freeze({ family: 'family-key-memory-v1', planner: 'planner-reference-v1', dennis: 'dennis-reference-v1' }) });
