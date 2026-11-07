'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createFactoryController } = require('./human_key_memory_controller.js');
test('the candidate restores only previously observed key identities, without inventing pictures or mutating observations', () => {
  const observations = [], base = { beginAttempt() {}, observe(s, o) { observations.push(o); } }, tiles = [{}, {}, {}];
  const c = createFactoryController(tiles, { rememberObservedKeyRoles: 1, retryKeyIdentityMemory: 1 }, 1, () => base);
  const state = { alive: [1, 1, 1], physicalTaps: 0, relieved: false };
  const observed = roles => ({ roles, pictures: [null, null, null], down: [0, 0, 0], takeable: [false, false, false], clock: null });
  c.beginAttempt(); c.observe(state, observed(['key', null, null]));
  c.beginAttempt(); const hidden = observed([null, null, null]); c.observe(state, hidden);
  assert.deepEqual(observations.at(-1).roles, ['key', null, null]); assert.deepEqual(hidden.roles, [null, null, null]);
  assert.deepEqual(observations.at(-1).pictures, [null, null, null]); assert.equal(c.rememberedKeyRoleEvidence().length, 1);
  c.observe(state, observed(['ice', null, null])); assert.equal(observations.at(-1).roles[0], 'ice', 'a current visible ice glyph takes precedence');
  c.observe({ ...state, relieved: true }, hidden); assert.deepEqual(observations.at(-1).roles, [null, null, null]);
  c.observe({ ...state, alive: [0, 1, 1] }, hidden); assert.deepEqual(observations.at(-1).roles, [null, null, null]);
});
test('reference profiles without the candidate flag receive the unchanged controller directly', () => {
  const base = {}; assert.equal(createFactoryController([], {}, 1, () => base), base);
});
test('the candidate has a distinct meter fingerprint and explicit profile name, with no cache migration', () => {
  const M = require('../../factory/meter.js'), old = M.createMeter(), candidate = M.createMeter({ bot: require.resolve('./human_bot_key_memory_v1.js') });
  assert.notEqual(candidate.fingerprint, old.fingerprint); assert.equal(M.FAMILY_CACHE_MIGRATIONS[candidate.fingerprint], undefined);
  const board = { tiles: [[0, 0, 0], [4, 0, 0]], faces: [0, 0], down: [], obst: { keys: [], locks: [], ice: {} }, clock: null };
  const r = require('./human_bot_key_memory_v1.js').measureHuman(board, { setting: 'family-key-memory-v1', runs: 1, seeds: 1, seed: 4711, capture: true });
  assert.equal(r.profileName, 'family-key-memory-v1'); assert.equal(r.version, 'human-g6.3-key-memory-candidate1'); assert.equal(r.calibrationStatus, 'experimental-awaiting-real-player-fit');
});
test('the candidate leaves the skilled reference profile and its actual taps unchanged', () => {
  const a = require('./human_bot.js'), b = require('./human_bot_key_memory_v1.js');
  const d = { tiles: [[0, 0, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0]], faces: [0, 1, 0, 1], down: [2], obst: { keys: [], locks: [], ice: {} }, clock: null };
  const opts = { setting: 'planner', runs: 2, seeds: 1, seed: 4711, capture: true }, old = a.measureHuman(d, opts), next = b.measureHuman(d, opts);
  assert.equal(old.expectedTries, next.expectedTries); assert.equal(old.firstTryRate, next.firstTryRate);
  assert.deepEqual(old.results.map(c => c.attempts.map(a => a.actions)), next.results.map(c => c.attempts.map(a => a.actions)));
});
