'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createAcceptedTapMemory } = require('./public_accepted_tap_memory.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 16, y: 0, z: 0 }];
  const neighbors = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles), initial = tiles.map(() => 1);
  let controls = 0;
  for (const role of ['none', 'key', 'lock', 'ice', 'ice2']) {
    const rules = { keys: role === 'key' ? [0, 1] : [1, 2], locks: new Set(role === 'lock' ? [0] : []), iceNb,
      ice: role.startsWith('ice') ? { 0: role === 'ice2' ? 2 : 1 } : {} };
    for (let mask = 1; mask < 64; mask += 2) {
      const alive = initial.map((value, index) => +(!!(mask & 2 ** index)));
      if (!Layouts.takeable(0, alive, neighbors, rules, initial)) continue;
      const memory = createAcceptedTapMemory(6);
      const before = { alive, relieved: false, physicalTaps: 0 }, after = { alive, physicalTaps: 1 };
      for (const field of ['pictures', 'roles', 'down', 'seed', 'deck']) Object.defineProperty(before, field, { get() { throw Error('Private ' + field); } });
      assert(memory.observeAccepted(0, before, after));
      for (let candidateMask = 1; candidateMask < 64; candidateMask += 2) {
        const candidate = initial.map((value, index) => +(!!(candidateMask & 2 ** index)));
        const expected = (candidateMask & mask) === candidateMask;
        assert.equal(memory.knowsAvailable(0, candidate), expected);
        if (expected) { assert(Layouts.takeable(0, candidate, neighbors, rules, initial)); controls++; }
      }
    }
  }
  const memory = createAcceptedTapMemory(3);
  const record = alive => memory.observeAccepted(0, { alive, relieved: false, physicalTaps: 0 }, { alive, physicalTaps: 1 });
  record([1, 0, 1]); record([1, 1, 0]);
  assert.equal(memory.entries().length, 2);
  assert(!memory.knowsAvailable(0, [1, 1, 1]));
  record([1, 1, 1]); assert.equal(memory.entries().length, 1);
  assert(!record([1, 0, 0]));
  assert(!memory.knowsAvailable(0, [0, 1, 1]));
  assert.throws(() => memory.observeAccepted(0, { alive: [1, 1, 1], relieved: false, physicalTaps: 0 }, { alive: [1, 1, 1], physicalTaps: 0 }));
  const reliefTiles = [{ x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }];
  const actual = { tiles: reliefTiles, nb: Layouts.neighbors(reliefTiles), faces: [1, 1, 2, 2], down: [0, 0, 0, 0], clock: null,
    rules: { ice: { 2: 1, 3: 1 }, iceNb: Layouts.iceNeighbors(reliefTiles), keys: [], locks: null } };
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 32 }, factory = createSessionFactory(), session = factory(actual, settings);
  session.tap(0);
  const beforeRelief = session.view().state;
  session.tap(1);
  const relieved = session.view().state;
  assert(relieved.relieved);
  const originalRules = createAcceptedTapMemory(4);
  assert(originalRules.observeAccepted(1, beforeRelief, relieved));
  assert.deepEqual(originalRules.entries(), [{ index: 1, requiredGone: [0] }]);
  const isolated = createAcceptedTapMemory(4), after = session.tap(2).state;
  assert(!isolated.observeAccepted(2, relieved, after));
  assert(!isolated.knowsAvailable(2, [1, 1, 1, 1]));
  session.tap(3); assert(session.view().win);
  assert.equal(verifyAttempt(encodeGame(actual), [0, 1, 2, 3], settings, session.audit()), 4);
  assert.deepEqual(createAcceptedTapMemory(4).entries(), []);
  factory.verifySource();
  console.log('PASS ' + controls + ' production-rule subset controls preserve actual accepted availability for keys/locks/ice without reading hidden roles, compress only redundant witnesses, and refuse after-relief evidence across retries');
}

if (require.main === module) test();
module.exports = test;
