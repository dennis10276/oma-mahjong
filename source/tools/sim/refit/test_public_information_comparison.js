'use strict';
const assert = require('assert/strict');
const { createInformationComparison } = require('./public_information_comparison.js');
const { saltedPublicSeed } = require('./public_sampling_seed.js');

function test() {
  const row = (progress, status = 'lost') => ({ honest: { status, progress }, exact: { status: 'unresolved' } });
  const correlated = createInformationComparison([0, 1], 0, { scoreMode: 'progress', confidenceSE: 2 });
  for (const progress of [0.2, 0.5, 0.8]) correlated.add([row(progress), row(progress + 0.1)], 1);
  const stable = correlated.finish();
  assert.equal(stable.index, 1); assert(stable.totals[1].standardError < 1e-8);
  assert(stable.totals.every(total => total.informationClears === 0));
  const noisy = createInformationComparison([0, 1], 0, { scoreMode: 'progress', confidenceSE: 2 });
  for (const [primary, candidate] of [[0.3, 1], [0.9, 0.3], [0.2, 0.6]]) noisy.add([row(primary), row(candidate)], 1);
  assert.equal(noisy.finish().index, 0); assert.equal(noisy.finish().confidence.rawWinner, 1);
  const single = createInformationComparison([0, 1], 0, { scoreMode: 'progress', confidenceSE: 2 });
  single.add([row(0.1), row(0.9)], 1); assert.equal(single.finish().index, 0);
  assert.equal(single.finish().totals[1].standardError, null);
  const legacy = createInformationComparison([0, 1], 0);
  legacy.add([row(0.2), row(1, 'cleared')], 1); assert.equal(legacy.finish().index, 1);
  const partial = createInformationComparison([0, 1], 0, { scoreMode: 'progress', confidenceSE: 2 });
  for (let world = 0; world < 3; world++) partial.add([row(0.2, 'unresolved'), row(0.6, 'unresolved')], 1);
  assert.equal(partial.finish().index, 1); assert.equal(partial.finish().totals[1].informationClears, 0);
  assert.equal(partial.finish().totals[1].unresolved, 3);
  const remembered = createInformationComparison([0, 1], 0, { scoreMode: 'progress', confidenceSE: 2 });
  for (let world = 0; world < 3; world++) remembered.add([
    { ...row(0.3), exact: { status: 'lost', progress: 0.9 } },
    { ...row(0.3), exact: { status: 'cleared' } }], 0.2);
  assert.equal(remembered.finish().index, 1);
  assert(remembered.finish().totals.every(total => total.progress === 0));
  const conservative = createInformationComparison([0, 1], 0, { scoreMode: 'clear', confidenceSE: 2 });
  for (let world = 0; world < 3; world++) conservative.add([
    { ...row(0.2), exact: { status: 'lost', progress: 0.1 } },
    { ...row(0.3), exact: { status: 'lost', progress: 0.9 } }], 0.2);
  assert.equal(conservative.finish().index, 0);
  assert.throws(() => partial.add([row(0), row(1.1)], 1));
  assert.equal(saltedPublicSeed(123456, 1), saltedPublicSeed(123456, 1));
  assert.equal(new Set([1, 2, 3].map(salt => saltedPublicSeed(123456, salt))).size, 3);
  assert.throws(() => saltedPublicSeed({ level: 93 }, 1)); assert.throws(() => saltedPublicSeed(123456, 0));
  console.log('PASS fractional play-out scores differ without clears; paired two-standard-error margins retain noisy/single-sample primary choices, exploit correlated stable gains and remembered-board exact clears, preserve censored statuses, and salt only public-state hashes');
}

if (require.main === module) test();
module.exports = test;
