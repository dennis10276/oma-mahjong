'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../engine.js');
const d = require('../../../analysis/builder/bank/placed-250-retuned/level-271.json').design;
test('Dennis level 271: clock 19 wins; both game and strict shortest searches prove 19, never 20', () => {
  assert.equal(d.clock.n, 19);
  assert.equal(d.solution.indexOf(d.clock.i) + 1, 19);
  assert.ok(E.replay(d, d.solution, { strict: true }).ok);
  for (const mode of [{}, { strict: true }, { reserveCuts: false }]) {
    const r = E.clockShortest(E.game(structuredClone(d), mode), { nodes: 400000, ms: 10000 });
    assert.ok(r && !r.unsure); assert.equal(r.k, 19);
    assert.ok(E.replay(d, E.flatten(r.path), mode).ok);
  }
});
