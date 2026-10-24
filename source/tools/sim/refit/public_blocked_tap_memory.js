'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');

function createBlockedTapMemory(tiles, { exclusiveRoles = false } = {}) {
  assert.equal(typeof exclusiveRoles, 'boolean');
  const geometry = tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z }));
  const neighbors = Layouts.neighbors(geometry), iceNeighbors = Layouts.iceNeighbors(geometry);
  const facts = new Map();
  let attempt = 0, previous = null;
  const validateAlive = alive => assert(Array.isArray(alive) && alive.length === geometry.length
    && alive.every(value => value === 0 || value === 1));
  const validateIndex = index => assert(Number.isInteger(index) && index >= 0 && index < geometry.length);
  return {
    beginAttempt() { attempt++; previous = null; },
    observeBlocked(index, frame) {
      assert(attempt > 0);
      assert.deepEqual(Object.keys(frame).sort(), ['alive', 'physicalTaps', 'relieved']);
      validateIndex(index); validateAlive(frame.alive);
      assert.equal(frame.relieved, false, 'Relief removes mechanical blocking');
      assert(Number.isInteger(frame.physicalTaps) && frame.physicalTaps >= 0);
      assert(frame.alive[index] && Layouts.isFree(index, frame.alive, neighbors), 'Only a geometrically free rejected tap identifies an obstacle');
      if (previous) {
        assert(frame.physicalTaps >= previous.physicalTaps);
        assert(frame.alive.every((alive, target) => !alive || previous.alive[target]), 'Begin a new attempt before restored tiles');
        if (frame.physicalTaps === previous.physicalTaps) assert.deepEqual(frame.alive, previous.alive);
      }
      const signature = index + '|' + frame.alive.join('');
      if (!facts.has(signature)) facts.set(signature, { index, attempt, physicalTaps: frame.physicalTaps,
        alive: frame.alive.slice(), source: 'observedRejectedGeometricallyFreeTap' });
      previous = { alive: frame.alive.slice(), physicalTaps: frame.physicalTaps };
    },
    knowsBlocked(index, alive, observedKeys = [], relieved = false) {
      validateIndex(index); validateAlive(alive);
      assert.equal(typeof relieved, 'boolean');
      assert(Array.isArray(observedKeys) && new Set(observedKeys).size === observedKeys.length);
      observedKeys.forEach(validateIndex);
      assert(!exclusiveRoles || observedKeys.length <= 2);
      if (relieved || !alive[index] || !Layouts.isFree(index, alive, neighbors)) return false;
      const removedNow = iceNeighbors[index].filter(neighbor => !alive[neighbor]).length;
      for (const fact of facts.values()) {
        if (fact.index !== index) continue;
        const removedThen = iceNeighbors[index].filter(neighbor => !fact.alive[neighbor]).length;
        if (removedNow > removedThen) continue;
        const keysRetained = observedKeys.some(key => alive[key])
          || fact.alive.every((present, target) => !present || alive[target]);
        const lockWasImpossible = exclusiveRoles && observedKeys.length === 2
          && observedKeys.every(key => !fact.alive[key]);
        if (keysRetained || lockWasImpossible) return true;
      }
      return false;
    },
    entries() { return structuredClone([...facts.values()]); },
  };
}

module.exports = { createBlockedTapMemory };
