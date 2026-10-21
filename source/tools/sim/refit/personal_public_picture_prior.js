'use strict';
const assert = require('assert/strict');
const SYMBOLS = Object.freeze([...Array.from({ length: 36 }, (unused, index) => index), 101]);

function normalizedPrior(weights) {
  assert(Array.isArray(weights) && weights.length === 256);
  assert(weights.every((value, picture) => Number.isFinite(value) && value >= 0 && (SYMBOLS.includes(picture) || value === 0)));
  const mass = weights.reduce((sum, value) => sum + value, 0); assert(Number.isFinite(mass) && mass > 0);
  return Object.freeze(weights.map(value => value / mass));
}

function uniformPrior() {
  return normalizedPrior(Array.from({ length: 256 }, (unused, picture) => +SYMBOLS.includes(picture)));
}

function hitProbability(prior, waiting, knownCounts) {
  assert(Array.isArray(prior) && prior.length === 256 && Math.abs(prior.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert(Array.isArray(waiting) && waiting.every(picture => SYMBOLS.includes(picture)));
  assert(Array.isArray(knownCounts) && knownCounts.length === 256 && knownCounts.every(value => Number.isInteger(value) && value >= 0));
  const targets = new Set(waiting.concat(SYMBOLS.filter(picture => knownCounts[picture] % 2)));
  const wildcard = targets.has(101);
  return SYMBOLS.reduce((sum, picture) => sum + (targets.size && (wildcard || picture === 101 || targets.has(picture)) ? prior[picture] : 0), 0);
}

module.exports = { SYMBOLS, normalizedPrior, uniformPrior, hitProbability };
