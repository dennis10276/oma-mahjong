'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');

function createAvailabilityTransfer(tiles, { exclusiveRoles = false, initialAlive = tiles.map(() => 1) } = {}) {
  assert.equal(exclusiveRoles, true, 'Declare the zero/two-key and at-most-two-hit production contract');
  const geometry = tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z }));
  const neighbors = Layouts.neighbors(geometry), iceNeighbors = Layouts.iceNeighbors(geometry);
  const validate = alive => assert(Array.isArray(alive) && alive.length === tiles.length
    && alive.every(value => value === 0 || value === 1));
  validate(initialAlive);
  const starting = initialAlive.slice();
  return (index, witness, candidate, observedKeys) => {
    validate(witness); validate(candidate);
    assert(witness.every((alive, target) => !alive || starting[target])
      && candidate.every((alive, target) => !alive || starting[target]), 'Transfer cannot resurrect a tile absent at the board start');
    assert(Number.isInteger(index) && index >= 0 && index < tiles.length && witness[index]);
    assert(Array.isArray(observedKeys) && observedKeys.length <= 2 && new Set(observedKeys).size === observedKeys.length
      && observedKeys.every(key => Number.isInteger(key) && key >= 0 && key < tiles.length));
    if (!candidate[index] || !Layouts.isFree(index, candidate, neighbors)) return null;
    const witnessedGone = iceNeighbors[index].filter(neighbor => starting[neighbor] && !witness[neighbor]).length;
    const requiredIceRemovals = Math.min(2, witnessedGone);
    const candidateGone = iceNeighbors[index].filter(neighbor => starting[neighbor] && !candidate[neighbor]).length;
    if (candidateGone < requiredIceRemovals) return null;
    const activeKey = observedKeys.find(key => witness[key]);
    if (activeKey !== undefined) return { kind: 'activeObservedKeyExcludedLock', observedKeys: [activeKey], requiredIceRemovals,
      note: 'Actual original-rule safety while a known key remained proves this tile was not locked. Any equally sufficient neighbor-removal count discharges possible ice.' };
    if (observedKeys.length === 2 && observedKeys.every(key => !candidate[key])) {
      return { kind: 'bothObservedKeysRemainRemoved', observedKeys: observedKeys.slice(), requiredIceRemovals,
        note: 'Both actually known keys were already gone at the safety witness and remain gone. Current geometry and the public ice bound discharge all supported obstacles.' };
    }
    return null;
  };
}

module.exports = { createAvailabilityTransfer };
