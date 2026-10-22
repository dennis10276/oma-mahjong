'use strict';
const assert = require('assert/strict');

function knowledgeChange(expectedPictures, state) {
  assert(Array.isArray(expectedPictures) && Array.isArray(state.pictures));
  assert.equal(expectedPictures.length, state.pictures.length);
  const gained = [], lost = [], changed = [];
  expectedPictures.forEach((picture, index) => {
    if (!state.alive[index]) return;
    const current = state.pictures[index];
    if (picture === null && current !== null) gained.push(index);
    else if (picture !== null && current === null) lost.push(index);
    else if (picture !== current) changed.push(index);
  });
  return { gained, lost, changed };
}

module.exports = { knowledgeChange };
