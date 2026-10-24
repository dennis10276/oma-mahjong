'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createBlockedTapMemory } = require('./public_blocked_tap_memory.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 },
    { x: 6, y: 0, z: 0 }, { x: 6, y: 2, z: 0 }, { x: 10, y: 0, z: 0 }];
  for (const tile of tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Private picture'); } });
  const neighbors = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles), initial = tiles.map(() => 1);
  let controls = 0, nonSubsetControls = 0;
  for (const exclusiveRoles of [false, true]) for (const hits of [0, 1, 2]) for (const locked of [false, true]) {
    if (exclusiveRoles && hits && locked) continue;
    const rules = { iceNb, ice: hits ? { 0: hits } : {}, locks: new Set(locked ? [0] : []), keys: [4, 5] };
    for (let observedMask = 1; observedMask < 64; observedMask += 2) {
      const observed = initial.map((unused, index) => +(!!(observedMask & 2 ** index)));
      if (!Layouts.isFree(0, observed, neighbors) || Layouts.takeable(0, observed, neighbors, rules, initial)) continue;
      const memory = createBlockedTapMemory(tiles, { exclusiveRoles }); memory.beginAttempt();
      memory.observeBlocked(0, { alive: observed, physicalTaps: 4, relieved: false });
      const source = JSON.stringify(memory.entries());
      for (const keys of [[], [4], [4, 5]]) for (let candidateMask = 1; candidateMask < 64; candidateMask += 2) {
        const candidate = initial.map((unused, index) => +(!!(candidateMask & 2 ** index)));
        if (!memory.knowsBlocked(0, candidate, keys)) continue;
        assert.equal(Layouts.takeable(0, candidate, neighbors, rules, initial), false);
        assert.equal(memory.knowsBlocked(0, candidate, keys, true), false);
        controls++; nonSubsetControls += +((candidateMask & observedMask) !== candidateMask);
      }
      assert.equal(JSON.stringify(memory.entries()), source, 'Hypothetical queries cannot record observations');
    }
  }
  assert(controls > 0 && nonSubsetControls > 0);
  const memory = createBlockedTapMemory(tiles, { exclusiveRoles: true });
  assert.throws(() => memory.observeBlocked(0, { alive: initial, physicalTaps: 0, relieved: false }));
  memory.beginAttempt();
  memory.observeBlocked(0, { alive: initial, physicalTaps: 0, relieved: false });
  assert(memory.knowsBlocked(0, [1, 1, 1, 0, 1, 1], [4]));
  assert(!memory.knowsBlocked(0, [1, 0, 1, 1, 1, 1], [4]), 'One thawing removal might release one-hit ice');
  assert(!memory.knowsBlocked(0, [1, 1, 1, 1, 0, 0], []), 'Unseen removed keys might release a lock');
  assert(!memory.knowsBlocked(0, initial, [], true));
  memory.observeBlocked(0, { alive: [1, 1, 1, 0, 1, 1], physicalTaps: 1, relieved: false });
  assert.throws(() => memory.observeBlocked(0, { alive: initial, physicalTaps: 2, relieved: false }), /new attempt/);
  memory.beginAttempt(); assert(memory.knowsBlocked(0, initial));
  assert.equal(memory.entries().length, 2, 'Actual negative evidence survives a real retry');
  const copied = memory.entries(); copied[0].alive.fill(0); assert(memory.knowsBlocked(0, initial));
  assert.throws(() => memory.observeBlocked(0, { alive: initial, physicalTaps: 0, relieved: true }), /Relief/);
  assert.throws(() => memory.observeBlocked(0, { alive: initial, physicalTaps: 0, relieved: false, faces: [] }));
  assert.throws(() => memory.knowsBlocked(0, initial, [4, 4]));
  assert(!memory.knowsBlocked(0, [0, 1, 1, 1, 1, 1]));
  const stacked = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }], covered = createBlockedTapMemory(stacked);
  covered.beginAttempt(); assert.throws(() => covered.observeBlocked(0, { alive: [1, 1], physicalTaps: 0, relieved: false }), /geometrically free/);
  console.log('PASS ' + controls + ' production-rule negative-observation proofs including ' + nonSubsetControls
    + ' different-route transfers; no ice/lock identity guessed, no relief or hypothetical evidence retained, and actual retry facts remain separate from immutable role memory');
}

if (require.main === module) test();
module.exports = test;
