'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), R = require('./task10_report.js');
test('the additive table recovers a known effect and leaves unidentifiable effects unknown', () => {
  const fit = R.leastSquares([[1, 0], [1, 1], [1, 2]], [3, 5, 7]);
  assert.ok(Math.abs(fit.coefficients[0] - 3) < 1e-8);
  assert.ok(Math.abs(fit.coefficients[1] - 2) < 1e-8);
  assert.ok(Math.abs(R.predict(fit, [1, 3]) - 9) < 1e-8);
  const missing = R.leastSquares([[1, 0], [1, 0]], [3, 3]);
  assert.equal(missing.coefficients[1], null);
  assert.equal(R.predict(missing, [1, 1]), null);
  assert.equal(R.predict(missing, [1, 0]), 3);
});
test('a trap dose and its zero-trap parent cannot leak between training and holdout', () => {
  for (const traps of [0, 1, 2]) for (const seed of [1, 2, 3]) assert.equal(
    R.folds({ story: 'frozenGuards', way: 14, three: 5, luck: 1, traps, seed }),
    R.folds({ story: 'frozenGuards', way: 14, three: 5, luck: 1, traps: 0, seed: 1 }));
});
