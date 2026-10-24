'use strict';
const assert = require('assert/strict');
const { createPairedPictureSampler } = require('./public_paired_picture_sampler.js');

function test() {
  const stream = () => {
    let cursor = 0;
    return () => ((cursor++ * 277 + 137) % 1021) / 1021;
  };
  let controls = 0;
  for (const maximumJokers of [0, 2]) for (const size of [2, 4, 6, 10]) {
    const completed = Array.from({ length: size }, (unused, index) => Math.floor(index / 2) % 3);
    for (let mask = 0; mask < 2 ** size; mask++) {
      const memory = completed.map((picture, index) => mask & 2 ** index ? picture : null);
      for (const field of ['faces', 'deck', 'seed', 'inventory', 'level']) Object.defineProperty(memory, field,
        { get() { throw Error('Sampler read private ' + field); } });
      const before = memory.slice(), first = createPairedPictureSampler(memory, { random: stream(), maximumJokers });
      const second = createPairedPictureSampler(memory, { random: stream(), maximumJokers });
      for (let repeat = 0; repeat < 3; repeat++) {
        const hypothesis = first.sample(); assert.deepEqual(hypothesis, second.sample());
        assert.equal(hypothesis.kind, 'pairedPictureHypothesis');
        assert.equal(hypothesis.exactPrior, false); assert.equal(hypothesis.observedFact, false);
        const odd = new Set();
        hypothesis.pictures.forEach((picture, index) => {
          assert(Number.isInteger(picture) && (picture >= 0 && picture < 36 || picture === 101));
          if (memory[index] !== null) assert.equal(picture, memory[index]);
          if (odd.has(picture)) odd.delete(picture); else odd.add(picture);
        });
        assert.equal(odd.size, 0);
        assert(hypothesis.pictures.filter(picture => picture === 101).length <= maximumJokers);
        assert.deepEqual(memory.slice(), before); controls++;
      }
    }
  }
  const forcedJoker = createPairedPictureSampler([101, null, 7, 7], { random: () => 0 }).sample();
  assert.deepEqual(forcedJoker.pictures, [101, 101, 7, 7]);
  const noMoreJokers = createPairedPictureSampler([101, 101, null, null], { random: () => 1 - Number.EPSILON }).sample();
  assert.equal(noMoreJokers.pictures.filter(picture => picture === 101).length, 2);
  const freshJokers = createPairedPictureSampler([null, null], { random: () => 1 - Number.EPSILON }).sample();
  assert.deepEqual(freshJokers.pictures, [101, 101]);
  const original = [0, null, 1, null], retained = createPairedPictureSampler(original, { random: () => 0 });
  original.fill(35); assert.deepEqual(retained.sample().pictures, [0, 1, 1, 0]);
  const sparse = [0, null]; sparse.length = 4;
  assert.throws(() => createPairedPictureSampler(sparse));
  assert.throws(() => createPairedPictureSampler([0, 1]));
  assert.throws(() => createPairedPictureSampler([101, null], { maximumJokers: 0 }));
  assert.throws(() => createPairedPictureSampler([0, null], { inventory: [0, 0] }));
  for (const invalid of [1, -0.1, NaN, Infinity]) {
    assert.throws(() => createPairedPictureSampler([null, null], { random: () => invalid }).sample());
  }
  console.log('PASS ' + controls + ' reproducible public-memory hypothesis completions preserve every remembered identity, paired counts and Joker bounds, reject private-inventory options, and remain explicitly separate from observed facts and exact probabilities');
}

if (require.main === module) test();
module.exports = test;
