'use strict';
const assert = require('assert/strict');

function saltedPublicSeed(publicHash, runSalt) {
  assert(Number.isInteger(publicHash) && publicHash >= 0 && publicHash <= 0xffffffff);
  assert([1, 2, 3].includes(runSalt));
  return Math.imul(publicHash ^ runSalt, 16777619) >>> 0;
}

module.exports = { saltedPublicSeed };
