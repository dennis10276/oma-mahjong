'use strict';
const assert = require('assert/strict');

function createPairedPictureSampler(rememberedPictures, options = {}) {
  assert(Object.keys(options).every(key => ['random', 'maximumJokers'].includes(key)));
  const random = options.random ?? Math.random, maximumJokers = options.maximumJokers ?? 2;
  assert.equal(typeof random, 'function');
  assert(Number.isInteger(maximumJokers) && maximumJokers >= 0 && maximumJokers % 2 === 0);
  assert(Array.isArray(rememberedPictures) && rememberedPictures.length > 0 && rememberedPictures.length % 2 === 0);
  const memory = Array.from(rememberedPictures), unknown = [], odd = new Set();
  let knownJokers = 0;
  for (const [index, picture] of memory.entries()) {
    if (picture === null) { unknown.push(index); continue; }
    assert(Number.isInteger(picture) && (picture >= 0 && picture < 36 || picture === 101));
    knownJokers += +(picture === 101);
    if (odd.has(picture)) odd.delete(picture); else odd.add(picture);
  }
  assert(knownJokers <= maximumJokers, 'Observed Jokers contradict the declared opening bound');
  assert(odd.size <= unknown.length && (unknown.length - odd.size) % 2 === 0,
    'Observed pictures contradict the paired opening contract');
  const draw = limit => {
    const value = random(); assert(Number.isFinite(value) && value >= 0 && value < 1);
    return Math.floor(value * limit);
  };
  return {
    sample() {
      const pool = [...odd];
      let jokers = knownJokers + +odd.has(101);
      while (pool.length < unknown.length) {
        const labels = jokers + 2 <= maximumJokers ? 37 : 36;
        const selected = draw(labels), picture = selected === 36 ? 101 : selected;
        pool.push(picture, picture); jokers += picture === 101 ? 2 : 0;
      }
      for (let tail = pool.length - 1; tail > 0; tail--) {
        const other = draw(tail + 1); [pool[tail], pool[other]] = [pool[other], pool[tail]];
      }
      const pictures = memory.slice();
      unknown.forEach((index, offset) => { pictures[index] = pool[offset]; });
      return { kind: 'pairedPictureHypothesis', pictures, assumedUnknownPictures: unknown.length,
        exactPrior: false, observedFact: false,
        note: 'Public-memory completion under paired opening counts and the declared Joker bound. This pair-label sampling prior is not uniform over distinct fillings or calibrated to a player. It reads no private inventory or actual hidden picture. Winnability and physical consistency still need separate checks; this is never observed knowledge or an exact loss fraction.' };
    },
  };
}

module.exports = { createPairedPictureSampler };
