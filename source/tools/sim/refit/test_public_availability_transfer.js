'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createAvailabilityTransfer } = require('./public_availability_transfer.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt, visibleRole } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
  for (const tile of tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Private picture'); } });
  const neighbors = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles), initial = tiles.map(() => 1);
  const transfer = createAvailabilityTransfer(tiles, { exclusiveRoles: true });
  let proofs = 0, nonSubsetProofs = 0;
  for (const role of ['none', 'key', 'lock', 'ice', 'ice2']) {
    const rules = { iceNb, ice: role.startsWith('ice') ? { 0: role === 'ice2' ? 2 : 1 } : {},
      keys: role === 'key' ? [0, 3] : [3, 4], locks: new Set(role === 'lock' ? [0] : []) };
    for (let mask = 1; mask < 128; mask += 2) {
      const witness = initial.map((value, index) => +(!!(mask & 2 ** index)));
      if (!Layouts.takeable(0, witness, neighbors, rules, initial)) continue;
      for (const knownKeys of [[], rules.keys.slice(0, 1), rules.keys]) {
        for (let candidateMask = 1; candidateMask < 128; candidateMask += 2) {
          const candidate = initial.map((value, index) => +(!!(candidateMask & 2 ** index)));
          const proof = transfer(0, witness, candidate, knownKeys);
          if (!proof) continue;
          assert(Layouts.takeable(0, candidate, neighbors, rules, initial));
          proofs++;
          nonSubsetProofs += +((candidateMask & mask) !== candidateMask);
        }
      }
    }
  }
  assert(proofs > 0 && nonSubsetProofs > 0);
  const observed = [1, 0, 1, 1, 1, 0, 0], swapped = [1, 1, 0, 1, 1, 1, 0];
  const first = transfer(0, observed, swapped, [3]);
  assert.equal(first.kind, 'activeObservedKeyExcludedLock');
  first.observedKeys[0] = -1;
  assert.deepEqual(transfer(0, observed, swapped, [3]).observedKeys, [3]);
  assert.equal(transfer(0, observed, swapped, []), null);
  assert.equal(transfer(0, observed, [1, 1, 0, 1, 1, 1, 1], [3]), null, 'Restored geometric covers cannot be ignored');
  const unlocked = [1, 0, 0, 0, 0, 0, 0], unrelatedRestored = [1, 0, 0, 0, 0, 1, 0];
  assert.equal(transfer(0, unlocked, unrelatedRestored, [3, 4]).kind, 'bothObservedKeysRemainRemoved');
  assert.equal(transfer(0, unlocked, [1, 0, 0, 1, 0, 1, 0], [3, 4]), null);
  assert.equal(transfer(0, unlocked, unrelatedRestored, [3]), null, 'A missing second key is not treated as a removed known key');
  assert.equal(transfer(0, unlocked, [1, 1, 1, 0, 0, 1, 0], [3, 4]), null, 'One neighbor removal cannot discharge a possible two-hit tile');
  assert.throws(() => createAvailabilityTransfer(tiles));
  assert.throws(() => transfer(0, observed, swapped, [3, 3]));
  const partiallyStarted = createAvailabilityTransfer(tiles, { exclusiveRoles: true, initialAlive: [1, 1, 1, 1, 1, 1, 0] });
  assert.equal(partiallyStarted(0, [1, 0, 0, 1, 1, 1, 0], [1, 1, 0, 1, 1, 1, 0], [3]), null,
    'A cover absent at board start is not a later ice-thaw removal');
  assert.throws(() => partiallyStarted(0, observed, [1, 1, 0, 1, 1, 1, 1], [3]), /absent at the board start/);
  const physicalTiles = tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })).concat([{ x: 20, y: 0, z: 0 }]);
  const actual = { tiles: physicalTiles, nb: Layouts.neighbors(physicalTiles), faces: [2, 3, 4, 9, 9, 3, 4, 2],
    down: physicalTiles.map(() => 0), clock: null,
    rules: { iceNb: Layouts.iceNeighbors(physicalTiles), ice: { 0: 2 }, keys: [3, 4], locks: null } };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const earlier = factory(actual, settings);
  const shown = observeBoard(physicalTiles, earlier.view().state, null,
    { picture: index => actual.faces[index], role: index => visibleRole(actual, earlier.view().state, index) });
  assert.equal(shown.roles[3], 'key');
  earlier.tap(6); earlier.tap(1);
  const before = earlier.view().state;
  assert(earlier.view().legalTiles.includes(0)); earlier.tap(0);
  for (const index of [5, 2, 7, 3, 4]) earlier.tap(index);
  assert(earlier.view().win);
  const earlierActions = [6, 1, 0, 5, 2, 7, 3, 4];
  assert.equal(verifyAttempt(encodeGame(actual), earlierActions, settings, earlier.audit()), earlierActions.length);
  const alternative = factory(actual, settings); alternative.tap(6); alternative.tap(2);
  const afterOtherRemovals = alternative.view().state;
  assert(before.alive[2] && !afterOtherRemovals.alive[2] && !before.alive[1] && afterOtherRemovals.alive[1]);
  const physicalTransfer = createAvailabilityTransfer(physicalTiles, { exclusiveRoles: true });
  assert(physicalTransfer(0, before.alive, afterOtherRemovals.alive, [3]));
  assert(alternative.view().legalTiles.includes(0));
  for (const index of [0, 7, 1, 5, 3, 4]) alternative.tap(index);
  assert(alternative.view().win);
  const alternativeActions = [6, 2, 0, 7, 1, 5, 3, 4];
  assert.equal(verifyAttempt(encodeGame(actual), alternativeActions, settings, alternative.audit()), alternativeActions.length);
  factory.verifySource();
  console.log('PASS ' + proofs + ' public obstacle-transfer proofs (' + nonSubsetProofs
    + ' beyond monotone subsets) preserve production takeability, refuse restored keys/covers and insufficient ice removals, and independently replay both different winning physical routes');
}

if (require.main === module) test();
module.exports = test;
