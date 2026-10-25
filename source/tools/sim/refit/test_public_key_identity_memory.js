'use strict';
const assert = require('assert/strict');
const { createKeyIdentityMemory } = require('./public_key_identity_memory.js');

function test() {
  const memory = createKeyIdentityMemory(3);
  const state = { alive: [1, 1, 1], physicalTaps: 0 };
  for (const field of ['faces', 'down', 'deck', 'seed', 'rules']) Object.defineProperty(state, field,
    { get() { throw Error('Private ' + field); } });
  assert.equal(memory.observe(state, ['ice', null, 'lock']), 0); assert.deepEqual(memory.keys(), []);
  state.physicalTaps = 2;
  assert.equal(memory.observe(state, ['key', null, 'lock']), 1);
  assert.deepEqual(memory.keys(), [0]);
  assert.equal(memory.observe(state, ['key', 'none', 'lock']), 0);
  assert.deepEqual(memory.entries()[0], { index: 0, attempt: 1, physicalTaps: 2,
    source: 'actual observed key glyph; key identity is static within this board' });
  state.physicalTaps = 0;
  assert.equal(memory.observe(state, ['ice2', null, 'none'], 2), 0);
  assert.deepEqual(memory.keys(), [0], 'An observed key can be covered by ice on a fresh retry without losing its identity');
  assert.equal(memory.observe(state, ['none', null, 'none'], 2), 0);
  assert.deepEqual(memory.keys(), [0], 'A later plain-looking glyph cannot erase the positive original key fact');
  assert.deepEqual(memory.keys([0, 1, 1]), []); assert.deepEqual(memory.keys(), [0]);
  const entries = memory.entries(); entries[0].index = 2; assert.deepEqual(memory.keys(), [0]);
  assert.deepEqual(createKeyIdentityMemory(3).keys(), [], 'Separate boards/salts start with no inherited key identities');
  assert.throws(() => memory.observe(state, ['key', 'private', 'none']));
  assert.throws(() => memory.keys([1, 1]));
  console.log('PASS positive observed key identities survive retries and later masking without assuming no ice/lock, never read private fields, retain proof provenance, filter removed keys and stay isolated by controller instance');
}

if (require.main === module) test();
module.exports = test;
