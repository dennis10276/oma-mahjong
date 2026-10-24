'use strict';
const assert = require('assert/strict');

function createPublicActionVisits() {
  let attempts = 0;
  const positions = new Map();
  const validate = (position, knowledge, index) => {
    assert(typeof position === 'string' && position.length > 0);
    assert(typeof knowledge === 'string' && knowledge.length > 0);
    assert(Number.isInteger(index) && index >= 0);
  };
  const signature = (position, knowledge) => JSON.stringify([position, knowledge]);
  return {
    beginAttempt() { attempts++; positions.clear(); },
    recordActual(position, knowledge, index) {
      assert(attempts > 0); validate(position, knowledge, index);
      const key = signature(position, knowledge);
      if (!positions.has(key)) positions.set(key, new Set());
      positions.get(key).add(index);
    },
    hasTried(position, knowledge, index) {
      assert(attempts > 0); validate(position, knowledge, index);
      return positions.get(signature(position, knowledge))?.has(index) ?? false;
    },
  };
}

module.exports = { createPublicActionVisits };
