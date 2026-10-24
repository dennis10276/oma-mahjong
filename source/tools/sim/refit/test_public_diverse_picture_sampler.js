'use strict';
const assert = require('assert/strict');
const { createDiversePictureSampler } = require('./public_diverse_picture_sampler.js');

function test() {
  const memory = Array(72).fill(null);
  for (const field of ['faces', 'inventory', 'deck', 'seed', 'kinds']) Object.defineProperty(memory, field,
    { get() { throw Error('Diverse sampler read private ' + field); } });
  const rare = createDiversePictureSampler(memory, { random: () => 0.5 }).sample();
  const counts = new Map(); for (const picture of rare.pictures) counts.set(picture, (counts.get(picture) || 0) + 1);
  assert.equal(rare.pairPrior, 'diverseRegularPairs'); assert.equal(counts.size, 36);
  assert([...counts.values()].every(count => count === 2));
  assert.equal(rare.observedFact, false); assert.equal(rare.exactPrior, false);
  const broad = createDiversePictureSampler(memory, { random: () => 0 }).sample();
  assert.equal(broad.pairPrior, 'uniformBackoff'); assert(broad.pictures.every(picture => picture === 0),
    'Extra-copy fillings remain supported rather than being ruled out as facts');
  let calls = 0;
  const joker = createDiversePictureSampler([null, null], { random: () => calls++ === 0 ? 0 : 1 - Number.EPSILON }).sample();
  assert.deepEqual(joker.pictures, [101, 101]);
  assert.deepEqual(createDiversePictureSampler([101, null, 7, 7], { random: () => 0.5 }).sample().pictures.sort((left, right) => left - right), [7, 7, 101, 101]);
  const repeated = [0, 0, 0, null, 1, 1, ...Array(78).fill(null)], before = repeated.slice();
  const filled = createDiversePictureSampler(repeated, { random: () => 0.5 }).sample();
  assert.equal(filled.pictures.filter(picture => picture === 0).length, 4);
  const odd = new Set();
  filled.pictures.forEach((picture, index) => {
    if (repeated[index] !== null) assert.equal(picture, repeated[index]);
    if (odd.has(picture)) odd.delete(picture); else odd.add(picture);
  });
  assert.equal(odd.size, 0); assert.deepEqual(repeated, before);
  assert.throws(() => createDiversePictureSampler([0, 1]));
  assert.throws(() => createDiversePictureSampler([null, null], { inventory: [0, 0] }));
  assert.throws(() => createDiversePictureSampler([null, null], { random: () => NaN }).sample());
  console.log('PASS dispersed regular-pair hypotheses match public generation structure without reading actual inventory, preserve visible repetitions/parity/Joker bounds, and retain broad support for extra copies and unseen Jokers as explicitly biased guesses');
}

if (require.main === module) test();
module.exports = test;
