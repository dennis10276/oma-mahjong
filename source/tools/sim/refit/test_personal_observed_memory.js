'use strict';
const assert = require('assert/strict'), crypto = require('crypto');
const Layouts = require('../../../www/layouts.js');
const { createSession } = require('./production_physical_session.js');
const { createObservedMemory } = require('./personal_observed_memory.js');
const identity = { size: 8, campaign: 'fixture-campaign', board: 'fixture-board' };
const options = { ...identity, seed: 7, retryRetention: 1, decay: 0 };
const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 8, y: 0, z: 0 }));
const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 3, 4, 1, 2, 3, 4], down: Array(8).fill(1), rules: null, clock: null };
const evidence = { kind: 'synthetic-current-visible-fixture-not-screenshot-validation', sha256: crypto.createHash('sha256').update('fixture').digest('hex') };
function currentObservation(frame) {
  const pictures = frame.state.alive.map((alive, index) => alive && index === frame.state.openPeek ? game.faces[index] : null);
  return { physicalTaps: frame.state.physicalTaps, alive: frame.state.alive, pictures,
    evidence: pictures.map(picture => picture === null ? null : evidence) };
}
function firstAttempt(memory) {
  memory.beginAttempt({ ...identity, attempt: 1 });
  const session = createSession(game);
  memory.observe(currentObservation(session.view()));
  for (const index of [0, 0, 1, 1, 2, 2, 3, 3]) memory.observe(currentObservation(session.tap(index)));
  assert.equal(session.view().why, 'tray'); assert.equal(session.view().state.moves, 4);
  const end = memory.endAttempt(session.view()); assert.equal(end.wonOn, null); assert.equal(end.status, 'physicalLoss');
  return memory;
}
const retained = firstAttempt(createObservedMemory(options));
const carry = retained.beginAttempt({ ...identity, attempt: 2 });
assert.deepEqual(carry.map(record => record?.picture ?? null), [1, 2, 3, 4, null, null, null, null]);
assert(carry.slice(0, 4).every(record => record.observed.attempt === 1));
carry[0].picture = 99;
const restarted = createSession(game), observation = currentObservation(restarted.view());
assert.equal(retained.observe(observation).pictures[0], 1);
const forgot = firstAttempt(createObservedMemory({ ...options, retryRetention: 0 }));
assert(forgot.beginAttempt({ ...identity, attempt: 2 }).every(record => record === null));
const decayed = createObservedMemory({ ...options, decay: 1 }); decayed.beginAttempt({ ...identity, attempt: 1 });
const visible = { ...observation, pictures: [1, null, null, null, null, null, null, null], evidence: [evidence, null, null, null, null, null, null, null] };
assert.equal(decayed.observe(visible).pictures[0], 1);
assert.equal(decayed.observe({ ...observation, physicalTaps: 1 }).pictures[0], null);
assert.throws(() => decayed.observe({ ...observation, physicalTaps: 1 }));
assert.equal(decayed.observe({ ...visible, physicalTaps: 2 }).pictures[0], 1);
const repeated = createObservedMemory({ ...options, decay: 1 }); repeated.beginAttempt({ ...identity, attempt: 1 });
repeated.observe(visible);
assert.equal(repeated.observe({ ...visible, physicalTaps: 1 }).pictures[0], 1);
assert.throws(() => repeated.observe({ ...visible, physicalTaps: 2, pictures: [2, null, null, null, null, null, null, null] }));
assert.throws(() => repeated.observe({ ...visible, physicalTaps: 2, evidence: Array(8).fill(null) }));
assert.throws(() => repeated.beginAttempt({ ...identity, attempt: 2 }));
assert.throws(() => repeated.endAttempt({ type: 'productionPhysicalFrame-v1' }));
const capped = createSession(game, { choiceLimit: 1 }); capped.tap(0);
const censored = createObservedMemory(options); censored.beginAttempt({ ...identity, attempt: 1 });
assert.equal(censored.endAttempt(capped.view()).status, 'unresolved');
assert.throws(() => censored.beginAttempt({ ...identity, attempt: 2 }));
const clockTiles = tiles.slice(0, 2), clock = createSession({ ...game, tiles: clockTiles,
  nb: Layouts.neighbors(clockTiles), faces: [1, 1], down: [1, 1], clock: { i: 0, n: 1 } });
clock.tap(0); assert.equal(clock.view().state.moves, 0); clock.tap(1); assert(clock.view().win);
assert.throws(() => repeated.endAttempt(clock.view()));
const completed = createObservedMemory({ ...options, size: 2 }); completed.beginAttempt({ ...identity, size: 2, attempt: 1 });
assert.equal(completed.endAttempt(clock.view()).wonOn, 1);
assert.throws(() => completed.beginAttempt({ ...identity, size: 2, attempt: 2 }));
assert.throws(() => createObservedMemory({ ...options, retryRetention: NaN }));
assert.throws(() => firstAttempt(createObservedMemory(options)).beginAttempt({ ...identity, attempt: 2, board: 'different-board' }));
const run = () => {
  const memory = firstAttempt(createObservedMemory({ ...options, retryRetention: 0.5 }));
  return memory.beginAttempt({ ...identity, attempt: 2 });
};
assert.deepEqual(run(), run());
console.log('PASS observed retry memory retains only earlier supplied observations, carries exact-board provenance, forgets persistently and reproducibly, preserves current recognition, and never restarts wins or numerical caps as losses');
