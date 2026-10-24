'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { analyzeContinuation } = require('./public_dead_end.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 7, 8, 9, 4],
    down: [1, 0, 0, 0, 0, 0], rules: null, clock: null };
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 32 };
  const session = createSessionFactory()(actual, settings);
  for (const index of [2, 3, 4]) session.tap(index);
  const state = { ...session.view().state, pictures: [1, 1, null, null, null, 4] };
  const game = { tiles, nb: actual.nb, rules: null, clock: null };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const options = { ...REFERENCE_PARAMETERS, nodes: 1, taps: 2, knownPairMacros: true,
    continuationPruning: true, cachePublicAnalysis: true };
  const unguarded = search(game, state, [{ index: 0 }], { ...options, pruneDead: false });
  assert.deepEqual(unguarded.path, [0, 1]);
  assert.equal(unguarded.prunedDeadSuccessors, 0);
  const guarded = search(game, state, [{ index: 0 }], options);
  assert(guarded.expandedKnownPairs > 0);
  assert(guarded.prunedDeadSuccessors > 0, 'Pair macros need the same complete-continuation check as primitive removals');
  assert(guarded.continuationProof.certified > 0);
  assert(!guarded.knownDead, 'A one-node main search remains bounded even if a macro suffix is proved dead');
  for (const index of [0, 1]) session.tap(index);
  const endpoint = { ...session.view().state, pictures: state.pictures };
  assert(analyzeContinuation(game, endpoint, [{ index: 5 }], 32).knownDead);
  assert.equal(verifyAttempt(encodeGame(actual), [2, 3, 4, 0, 1], settings, session.audit()), 5);
  const exposed = { ...game, publicExposure: position => position.alive[0] ? [] : [5] };
  const information = analyzeContinuation(exposed, endpoint, [{ index: 5 }], 32);
  assert(!information.knownDead);
  assert.equal(information.reason, 'reachablePublicExposure');
  const preserved = search(exposed, state, [{ index: 0 }], options);
  assert.equal(preserved.prunedDeadSuccessors, 0);
  assert.equal(preserved.continuationProof.certified, 0);
  const expired = search(game, state, [{ index: 0 }], { ...options, deadline: 0 });
  assert(expired.boundary && !expired.knownDead);
  console.log('PASS macro continuation checks reject an independently replayed doomed pair suffix, retain public-exposure boundaries and never promote bounded work to a death certificate');
}

if (require.main === module) test();
module.exports = test;
