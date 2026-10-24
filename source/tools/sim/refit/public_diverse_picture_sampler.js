'use strict';
const assert = require('assert/strict');
const { createPairedPictureSampler } = require('./public_paired_picture_sampler.js');

function createDiversePictureSampler(rememberedPictures, options = {}) {
  assert(Object.keys(options).every(key => ['random', 'maximumJokers'].includes(key)));
  const { random = Math.random, maximumJokers = 2 } = options;
  const broad = createPairedPictureSampler(rememberedPictures, { random, maximumJokers });
  const memory = Array.from(rememberedPictures), unknown = [], counts = new Map(), odd = new Set();
  for (const [index, picture] of memory.entries()) {
    if (picture === null) { unknown.push(index); continue; }
    counts.set(picture, (counts.get(picture) || 0) + 1);
    if (odd.has(picture)) odd.delete(picture); else odd.add(picture);
  }
  const draw = limit => {
    const value = random(); assert(Number.isFinite(value) && value >= 0 && value < 1);
    return Math.floor(value * limit);
  };
  return { sample() {
    if (draw(8) === 0) return { ...broad.sample(), pairPrior: 'uniformBackoff' };
    const pool = [...odd], totals = new Map(counts);
    for (const picture of pool) totals.set(picture, (totals.get(picture) || 0) + 1);
    while (pool.length < unknown.length) {
      const minimum = Math.min(...Array.from({ length: 36 }, (unused, picture) => totals.get(picture) || 0));
      const eligible = Array.from({ length: 36 }, (unused, picture) => picture)
        .filter(picture => (totals.get(picture) || 0) === minimum);
      const picture = eligible[draw(eligible.length)];
      pool.push(picture, picture); totals.set(picture, (totals.get(picture) || 0) + 2);
    }
    for (let tail = pool.length - 1; tail > 0; tail--) {
      const other = draw(tail + 1); [pool[tail], pool[other]] = [pool[other], pool[tail]];
    }
    const pictures = memory.slice(); unknown.forEach((index, offset) => { pictures[index] = pool[offset]; });
    return { kind: 'pairedPictureHypothesis', pictures, assumedUnknownPictures: unknown.length,
      exactPrior: false, observedFact: false, pairPrior: 'diverseRegularPairs',
      note: 'Heuristic prior favoring distinct regular pairs, motivated by public pairFacesFor and current visible counts. One-eighth probability uses the broad paired sampler, retaining support for extra repetitions and unseen Jokers. No private inventory, kind count or seed is read; this is not an inferred actual deck or an exact filling probability.' };
  } };
}

module.exports = { createDiversePictureSampler };
