'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createObservedSafetyTransfer, observedSafetyPlanningAllowed } = require('./public_observed_safety_transfer.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 1.8, y: 0, z: 0 }, { x: -1.8, y: 0, z: 0 },
  { x: 0, y: 1.8, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
for (const tile of tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Unavailable geometry picture'); } });
const initial = tiles.map(() => 1), neighbors = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles);
const transfer = createObservedSafetyTransfer(tiles);
let supportedWorlds = 0, transfers = 0, restoredTiles = 0, unboundedIceChecks = 0;
for (const hits of [0, 1, 2, 3]) for (const locked of [false, true]) for (const keys of [[4], [4, 5], [0, 4, 5], [0, 1, 4, 5]]) {
  const rules = { ice: { 0: hits, 4: 2 }, locks: new Set(locked ? [0, 1] : [1]), keys, iceNb };
  for (let witnessBits = 0; witnessBits < 2 ** tiles.length; witnessBits++) {
    const witness = initial.map((alive, index) => +(!!(witnessBits & 2 ** index)));
    if (!witness[0] || !Layouts.takeable(0, witness, neighbors, rules, initial)) continue;
    for (const known of [keys.slice(0, 1), keys.slice(), []]) {
      if (!known.some(key => witness[key])) continue;
      supportedWorlds++;
      for (let candidateBits = 0; candidateBits < 2 ** tiles.length; candidateBits++) {
        const candidate = initial.map((alive, index) => +(!!(candidateBits & 2 ** index)));
        const proof = transfer(0, witness, candidate, known);
        if (!proof) continue;
        assert(Layouts.takeable(0, candidate, neighbors, rules, initial), 'A transfer must hold with composite roles, arbitrary known-key counts and up to three-hit ice');
        transfers++; restoredTiles += +candidate.some((alive, index) => alive && !witness[index]);
        unboundedIceChecks += +(hits === 3);
      }
    }
  }
}
assert(transfers && restoredTiles && unboundedIceChecks);
const witness = [1, 0, 0, 0, 1, 1], insufficient = [1, 1, 0, 0, 1, 1];
assert.equal(transfer(0, witness, insufficient, [4]), null, 'A three-neighbor witness must not be truncated to an assumed two-hit bound');
assert.equal(transfer(0, witness, witness, []), null, 'An unobserved key is not a positive fact');
assert.throws(() => createObservedSafetyTransfer(tiles, { maximumIce: 2 }));
assert.throws(() => transfer(0, witness, witness, [4, 4]));
assert.throws(() => transfer(0, witness, witness, [99]));
const sparse = [4]; sparse.length = 2;
assert.throws(() => transfer(0, witness, witness, sparse));
const partial = createObservedSafetyTransfer(tiles, { initialAlive: [1, 1, 1, 0, 1, 1] });
assert.equal(partial(0, witness, insufficient, [4]), null, 'A neighbor absent at board start must not count as a later removal');
assert.throws(() => partial(0, witness, [1, 0, 0, 1, 1, 1], [4]), 'A candidate cannot resurrect a tile absent at board start');
assert.throws(() => partial(0, [1, 0, 0, 1, 1, 1], witness, [4]), 'A witness cannot resurrect a tile absent at board start');
const physicalTiles = [...tiles.slice(0, 4), { x: 8, y: 0, z: 0 }, { x: 9.8, y: 0, z: 0 },
  { x: 16, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }];
const actual = { tiles: physicalTiles, nb: Layouts.neighbors(physicalTiles), faces: [2, 1, 4, 1, 2, 3, 3, 4],
  down: physicalTiles.map(() => 0), clock: null,
  rules: { iceNb: Layouts.iceNeighbors(physicalTiles), ice: { 0: 2, 5: 1 }, keys: [4, 5, 6], locks: new Set([7]) } };
const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
const observe = session => {
  const view = session.view(), legal = new Set(view.legalTiles ?? []);
  return observeBoard(physicalTiles, view.state, null, { picture: index => actual.faces[index],
    role: index => visibleRole(actual, view.state, index), takeable: index => legal.has(index) });
};
const earlier = factory(actual, settings), alternative = factory(actual, settings);
assert.equal(observe(earlier).roles[6], 'key');
for (const index of [1, 3]) earlier.tap(index);
const earlierState = earlier.view().state;
assert.equal(earlierState.relieved, false); assert.equal(observe(earlier).takeable[0], true);
for (const index of [2, 3]) alternative.tap(index);
const candidateState = alternative.view().state;
assert(candidateState.alive.some((alive, index) => alive && !earlierState.alive[index]));
const physicalTransfer = createObservedSafetyTransfer(physicalTiles);
assert(physicalTransfer(0, earlierState.alive, candidateState.alive, [6]));
assert.equal(candidateState.relieved, false); assert.equal(observe(alternative).takeable[0], true);
for (const index of [0, 4, 5, 6, 2, 7]) earlier.tap(index);
for (const index of [0, 4, 1, 5, 6, 7]) alternative.tap(index);
assert(earlier.view().win); assert(alternative.view().win);
const verifiedTaps = verifyAttempt(encodeGame(actual), [1, 3, 0, 4, 5, 6, 2, 7], settings, earlier.audit())
  + verifyAttempt(encodeGame(actual), [2, 3, 0, 4, 1, 5, 6, 7], settings, alternative.audit());
factory.verifySource();
const gateState = { alive: initial, moves: 0, relieved: false };
const publicGame = { tiles, nb: neighbors, rules: null, clock: { i: 4, n: 31 } };
for (const field of ['faces', 'deck', 'seed', 'down']) Object.defineProperty(publicGame, field,
  { get() { throw Error('Private safety planning gate ' + field); } });
assert(observedSafetyPlanningAllowed(publicGame, gateState, true, 30));
assert(!observedSafetyPlanningAllowed(publicGame, gateState, true, 29));
assert(observedSafetyPlanningAllowed(publicGame, { ...gateState, moves: 1 }, true, 29));
assert(!observedSafetyPlanningAllowed({ ...publicGame, clock: null }, gateState, true, 30));
assert(!observedSafetyPlanningAllowed(publicGame, { ...gateState, alive: initial.map((alive, index) => index === 4 ? 0 : alive) }, true, 30));
assert(observedSafetyPlanningAllowed({ ...publicGame, clock: null }, gateState));
const dependencyGame = { ...publicGame, clock: { i: 0, n: 31 },
  rules: { ice: {}, iceNb, locks: new Set([0]), keys: [4] } };
assert(!observedSafetyPlanningAllowed(dependencyGame, gateState, true, 28));
assert(observedSafetyPlanningAllowed(dependencyGame, gateState, true, 28, [5]));
for (const invalid of [-1, 2.5, '30', NaN]) assert.throws(() => observedSafetyPlanningAllowed(publicGame, gateState, true, invalid));
assert.throws(() => observedSafetyPlanningAllowed(publicGame, gateState, false, 30));
assert.throws(() => observedSafetyPlanningAllowed(publicGame, gateState, true, 30, [99]));
console.log(JSON.stringify({ supportedWorlds, transfers, restoredTiles, unboundedIceChecks,
  passed: true, independentlyVerifiedPhysicalTaps: verifiedTaps,
  limitation: 'Production-rule predicate checks and two actual winning routes; controller integration remains required before any experiment.' }));
