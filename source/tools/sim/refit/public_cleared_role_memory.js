'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');

function createClearedRoleMemory(tiles, { transferProof = null, transferProofLabel = 'publicObstacleBounds' } = {}) {
  assert(transferProof === null || typeof transferProof === 'function');
  assert(['publicObstacleBounds', 'observedKeyAndNeighborCount'].includes(transferProofLabel));
  const neighbors = Layouts.neighbors(tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })));
  const witnesses = tiles.map(() => []);
  const validate = alive => assert(Array.isArray(alive) && alive.length === tiles.length
    && alive.every(value => value === 0 || value === 1));
  const subset = (candidate, witness) => candidate.every((alive, index) => !alive || witness[index]);
  return {
    observe(state, observedRoles) {
      validate(state.alive);
      assert(Number.isInteger(state.physicalTaps) && state.physicalTaps >= 0);
      assert.equal(typeof state.relieved, 'boolean');
      assert(Array.isArray(observedRoles) && observedRoles.length === tiles.length
        && observedRoles.every(role => role === null || ['none', 'key', 'lock', 'ice', 'ice2'].includes(role)));
      if (state.relieved) return 0;
      let learned = 0;
      observedRoles.forEach((role, index) => {
        if (role !== 'none' || !state.alive[index]) return;
        const witness = state.alive.slice();
        if (witnesses[index].some(previous => subset(witness, previous))) return;
        witnesses[index] = witnesses[index].filter(previous => !subset(previous, witness));
        witnesses[index].push(witness);
        learned++;
      });
      return learned;
    },
    knowsAvailable(index, alive, observedKeys = []) {
      validate(alive);
      assert(Number.isInteger(index) && index >= 0 && index < tiles.length);
      return !!alive[index] && Layouts.isFree(index, alive, neighbors)
        && witnesses[index].some(witness => subset(alive, witness) || !!transferProof?.(index, witness, alive, observedKeys));
    },
    entries() {
      return witnesses.flatMap((rows, index) => rows.map(alive => ({ index,
        requiredGone: alive.flatMap((value, target) => value ? [] : [target]),
        ...(transferProof ? { alternateProof: transferProofLabel } : {}) })));
    },
  };
}

module.exports = { createClearedRoleMemory };
