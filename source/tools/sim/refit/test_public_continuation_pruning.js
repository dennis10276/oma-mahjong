'use strict';
const assert = require('assert/strict');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { analyzeContinuation } = require('./public_dead_end.js');
const { decodeGeometry } = require('./personal_reference_failure_trace.js');
const fixtures = require('./fixtures/reference-known-traps.json');
for (const fixture of fixtures.cases) {
  const game = decodeGeometry(fixture.geometry);
  Object.defineProperty(game, 'faces', { get() { throw Error('Private actual deck access'); } });
  const legacy = search(game, fixture.state, fixture.actions, { ...REFERENCE_PARAMETERS, continuationPruning: false });
  assert.equal(legacy.continuationProof, undefined);
  assert(analyzeContinuation(game, fixture.state, [{ index: fixture.losingRoot }], 4096).knownDead);
  const candidate = search(game, fixture.state, fixture.actions, { ...REFERENCE_PARAMETERS, continuationPruning: true });
  assert.notEqual(candidate.index, fixture.losingRoot);
  assert(candidate.provedDeadRoots.includes(fixture.losingRoot));
  const alternative = analyzeContinuation(game, fixture.state, [{ index: candidate.index }], 4096);
  assert(!alternative.knownDead && alternative.reason === 'reachableInformation');
  assert(candidate.continuationProof.certified > 0 && candidate.continuationProof.nodes > 0);
}
const fixture = fixtures.cases[0], game = decodeGeometry(fixture.geometry);
assert.throws(() => search(game, fixture.state, fixture.actions, { ...REFERENCE_PARAMETERS, continuationPruning: 'yes' }));
assert.throws(() => search(game, fixture.state, fixture.actions, { ...REFERENCE_PARAMETERS, continuationTrayMin: 1 }));
console.log('PASS complete-known-continuation pruning certifies two frozen doomed roots and preserves unknown alternatives; disabling it omits its proofs without forcing an old losing choice');
