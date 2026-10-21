'use strict';
const assert = require('assert/strict');
const { SYMBOLS, normalizedPrior } = require('./personal_public_picture_prior.js');

function condition(prior, observation) {
  const normalized = normalizedPrior(prior), total = prior.reduce((sum, value) => sum + value, 0);
  const initial = Math.abs(total - 1) < 1e-12 ? prior.slice() : Array.from(normalized);
  assert.equal(observation.type, 'publicPixelPartition-v1');
  assert(Array.isArray(observation.pictures) && observation.pictures.length && new Set(observation.pictures).size === observation.pictures.length
    && observation.pictures.every(picture => SYMBOLS.includes(picture)));
  assert(Number.isInteger(observation.visiblePixels) && observation.visiblePixels >= 0);
  assert(['noSafeVisiblePixels', 'outsideDictionary', 'ambiguousPixels', 'identified'].includes(observation.reason));
  const informative = observation.reason === 'identified' || observation.reason === 'ambiguousPixels';
  if (observation.reason === 'identified') assert(observation.pictures.length === 1 && observation.known === observation.pictures[0]);
  else assert.equal(observation.known, null);
  if (!informative) return { weights: initial, conditioned: false, zeroMassFallback: false };
  const allowed = new Set(observation.pictures), mass = observation.pictures.reduce((sum, picture) => sum + initial[picture], 0);
  const weights = initial.map((value, picture) => !allowed.has(picture) ? 0 : mass ? value / mass : 1 / allowed.size);
  return { weights, conditioned: true, zeroMassFallback: !mass };
}

function symbolCompatibility(left, right) {
  const first = normalizedPrior(left), second = normalizedPrior(right);
  return SYMBOLS.reduce((total, picture) => total + first[picture] * SYMBOLS.reduce((sum, other) =>
    sum + (picture === other || picture === 101 || other === 101 ? second[other] : 0), 0), 0);
}

module.exports = { condition, symbolCompatibility };
