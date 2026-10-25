'use strict';
const assert = require('assert/strict');

function createAcceptedTapMemory(size, { transferProof = null } = {}) {
  assert(Number.isInteger(size) && size > 0);
  assert(transferProof === null || typeof transferProof === 'function');
  const witnesses = Array.from({ length: size }, () => []);
  const validate = alive => assert(Array.isArray(alive) && alive.length === size && alive.every(value => value === 0 || value === 1));
  const subset = (candidate, witness) => candidate.every((alive, index) => !alive || witness[index]);
  const remember = (index, alive) => {
    const witness = alive.slice();
    if (witnesses[index].some(previous => subset(witness, previous))) return false;
    witnesses[index] = witnesses[index].filter(previous => !subset(previous, witness));
    witnesses[index].push(witness); return true;
  };
  return {
    observeAvailable(takeable, state) {
      validate(state.alive);
      assert.equal(typeof state.relieved, 'boolean');
      assert(Array.isArray(takeable) && takeable.length === size
        && takeable.every(value => value === null || typeof value === 'boolean'));
      if (state.relieved) return 0;
      let learned = 0;
      takeable.forEach((value, index) => {
        if (value === true) { assert(state.alive[index]); learned += +remember(index, state.alive); }
      });
      return learned;
    },
    observeAccepted(index, before, after) {
      validate(before.alive); validate(after.alive);
      assert(Number.isInteger(index) && before.alive[index] === 1);
      assert(Number.isInteger(before.physicalTaps) && before.physicalTaps >= 0);
      assert.equal(after.physicalTaps, before.physicalTaps + 1, 'Remember only an actually accepted physical tap');
      assert(subset(after.alive, before.alive), 'Accepted-tap evidence cannot resurrect tiles');
      assert.equal(typeof before.relieved, 'boolean');
      if (before.relieved) return false;
      return remember(index, before.alive);
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
