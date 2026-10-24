'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createClearedRoleMemory } = require('./public_cleared_role_memory.js');
const { visibleRole } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 },
    { x: 0.28, y: 0.28 / 1.24, z: 1 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
  const neighbors = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles), initial = tiles.map(() => 1);
  let controls = 0;
  for (const iceHits of [0, 1, 2]) for (const locked of [false, true]) {
    const actual = { rules: { iceNb, ice: { 0: iceHits }, keys: locked ? [4, 5] : [], locks: new Set(locked ? [0] : []) } };
    for (let mask = 1; mask < 64; mask += 2) {
      const alive = initial.map((value, index) => +(!!(mask & 2 ** index)));
      const state = { alive, physicalTaps: 1, relieved: false };
      if (visibleRole(actual, state, 0) !== 'none') continue;
      for (const field of ['pictures', 'down', 'seed', 'deck']) Object.defineProperty(state, field, { get() { throw Error('Private ' + field); } });
      const observed = tiles.map(() => null); observed[0] = 'none';
      const memory = createClearedRoleMemory(tiles);
      assert.equal(memory.observe(state, observed), 1);
      for (let candidateMask = 1; candidateMask < 64; candidateMask += 2) {
        const candidate = initial.map((value, index) => +(!!(candidateMask & 2 ** index)));
        const expected = (candidateMask & mask) === candidateMask && Layouts.isFree(0, candidate, neighbors);
        assert.equal(memory.knowsAvailable(0, candidate), expected);
        if (expected) { assert(Layouts.takeable(0, candidate, neighbors, actual.rules, initial)); controls++; }
      }
    }
  }
  const memory = createClearedRoleMemory(tiles), roles = tiles.map(() => null); roles[0] = 'none';
  const observe = (alive, relieved = false) => memory.observe({ alive, relieved, physicalTaps: 2 }, roles);
  assert.equal(observe([1, 1, 1, 0, 1, 1]), 1);
  assert.equal(observe([1, 1, 1, 1, 0, 1]), 1);
  assert.equal(memory.entries().length, 2);
  assert(!memory.knowsAvailable(0, [1, 1, 1, 1, 1, 1]));
  assert.equal(observe(initial), 1);
  assert.equal(memory.entries().length, 1);
  assert(!memory.knowsAvailable(0, initial), 'Observed obstacle safety cannot bypass an intact geometric cover');
  assert.equal(observe([1, 1, 1, 0, 1, 1]), 0);
  assert.equal(observe(initial, true), 0);
  const isolated = createClearedRoleMemory(tiles);
  assert.equal(isolated.observe({ alive: initial, relieved: true, physicalTaps: 1 }, roles), 0);
  assert.equal(isolated.observe({ alive: initial, relieved: false, physicalTaps: 1 }, tiles.map(() => null)), 0);
  assert.deepEqual(isolated.entries(), []);
  assert.throws(() => isolated.observe({ alive: initial, relieved: false, physicalTaps: -1 }, roles));
  console.log('PASS ' + controls + ' production-rule subset controls retain only actually observed cleared roles, preserve geometric blocking and removal prerequisites, and exclude global-relief evidence');
}

if (require.main === module) test();
module.exports = test;
