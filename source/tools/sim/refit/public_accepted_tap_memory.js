'use strict';
const assert = require('assert/strict');

function createAcceptedTapMemory(size, { transferProof = null } = {}) {
  assert(Number.isInteger(size) && size > 0);
  assert(transferProof === null || typeof transferProof === 'function');
  const witnesses = Array.from({ length: size }, () => []);
  const validate = alive => assert(Array.isArray(alive) && alive.length === size && alive.every(value => value === 0 || value === 1));
  const subset = (candidate, witness) => candidate.every((alive, index) => !alive || witness[index]);
  return {
    observeAccepted(index, before, after) {
      validate(before.alive); validate(after.alive);
      assert(Number.isInteger(index) && before.alive[index] === 1);
      assert(Number.isInteger(before.physicalTaps) && before.physicalTaps >= 0);
      assert.equal(after.physicalTaps, before.physicalTaps + 1, 'Remember only an actually accepted physical tap');
      assert(subset(after.alive, before.alive), 'Accepted-tap evidence cannot resurrect tiles');
      assert.equal(typeof before.relieved, 'boolean');
      if (before.relieved) return false;
      const witness = before.alive.slice();
      if (witnesses[index].some(previous => subset(witness, previous))) return false;
      witnesses[index] = witnesses[index].filter(previous => !subset(previous, witness));
      witnesses[index].push(witness);
      return true;
    },
    knowsAvailable(index, alive, observedKeys = []) {
      validate(alive);
      assert(Number.isInteger(index) && index >= 0 && index < size);
      return !!alive[index] && witnesses[index].some(witness => subset(alive, witness)
        || !!transferProof?.(index, witness, alive, observedKeys));
    },
    entries() {
      return witnesses.flatMap((rows, index) => rows.map(alive => ({ index,
        requiredGone: alive.flatMap((value, target) => value ? [] : [target]),
        ...(transferProof ? { alternateProof: 'publicObstacleBounds' } : {}) })));
    },
  };
}

module.exports = { createAcceptedTapMemory };
