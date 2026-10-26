'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createReusableExploration } = require('./public_reusable_exploration.js');
const { advance } = require('./known_tray_plan.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = [0, 8, 16, 24].map(position => ({ x: position, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2], down: [0, 0, 0, 0], rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const initial = factory(actual, settings).view().state;
  const state = { ...initial, pictures: actual.faces.slice() }, roots = tiles.map((tile, index) => ({ index }));
  const model = { tiles, nb: actual.nb, rules: null, clock: null };
  const config = { revalidatePublicChanges: true, version: 'evidence-a' };
  const preserved = createReusableExploration();
  const first = preserved.search(model, state, roots, { ...config, nodes: 8 });
  assert.equal(first.path, null);
  const second = preserved.search(model, state, roots, { ...config, version: 'evidence-b', nodes: 1 });
  assert(second.reusable.resumed); assert.equal(second.reusable.cumulativeWork, 9);
  assert(second.reusable.dependencyQueries > 0);
  assert.equal(preserved.stats().createdJobs, 1); assert.equal(preserved.stats().dependencyRestarts, 0);
  assert.equal(preserved.stats().preservedAfterValidation, 1);
  const sliced = createReusableExploration();
  sliced.search(model, state, roots, { ...config, nodes: 8 });
  const pending = sliced.search(model, state, roots, { ...config, version: 'evidence-b', nodes: 1, validationQueries: 1 });
  assert.equal(pending.reason, 'dependency_validation_limit'); assert.equal(pending.nodes, 0);
  assert(pending.reusable.pendingDependencyChecks > 0); assert.equal(sliced.stats().resumedUnfinished, 0);
  let completed = null;
  for (let call = 0; call < 50 && !completed; call++) {
    const report = sliced.search(model, state, roots, { ...config, version: 'evidence-b', nodes: 1, validationQueries: 1 });
    assert(report.reusable.dependencyQueries <= 1);
    if (report.nodes) completed = report;
  }
  assert(completed?.reusable.resumed); assert.equal(completed.reusable.cumulativeWork, 9);
  assert.equal(sliced.stats().createdJobs, 1); assert.equal(sliced.stats().resumedUnfinished, 1);
  let futureKnown = false;
  const changing = { ...model, publicFrontier: position => ({ free: position.alive.flatMap((alive, index) => alive ? [index] : []),
    uncertain: !futureKnown && !position.alive[0] && position.alive[1] ? [1] : [] }) };
  const selective = createReusableExploration();
  selective.search(changing, state, roots, { ...config, nodes: 8 });
  const other = advance(model, state, 2).state, otherRoots = [0, 1, 3].map(index => ({ index }));
  selective.search(changing, other, otherRoots, { ...config, nodes: 3 });
  futureKnown = true;
  const restarted = selective.search(changing, state, roots, { ...config, version: 'role-proof-gained', nodes: 1 });
  assert.equal(restarted.reusable.resumed, false); assert.equal(selective.stats().dependencyRestarts, 1);
  const unaffected = selective.search(changing, other, otherRoots, { ...config, version: 'role-proof-gained', nodes: 1 });
  assert(unaffected.reusable.resumed); assert.equal(unaffected.reusable.cumulativeWork, 4);
  assert.equal(selective.stats().createdJobs, 3); assert.equal(selective.stats().preservedAfterValidation, 1);
  const unqueried = createReusableExploration();
  const unknown = { ...state, pictures: [1, 1, 2, null], down: [0, 0, 0, 1] };
  unqueried.search(model, unknown, roots, { ...config, nodes: 3 });
  const learned = { ...unknown, pictures: [1, 1, 2, 2] };
  const gained = unqueried.search(model, learned, roots, { ...config, version: 'picture-learned', nodes: 1 });
  assert(gained.reusable.resumed); assert.equal(gained.reusable.cumulativeWork, 4);
  assert.equal(unqueried.stats().createdJobs, 1); assert.equal(unknown.pictures[3], null);
  let winner = null;
  for (let call = 0; call < 100 && !winner; call++) {
    const report = unqueried.search(model, learned, roots, { ...config, version: 'picture-learned', nodes: 1 });
    if (report.knownWin) winner = report;
  }
  assert(winner?.knownWin);
  let replayedTaps = 0;
  const replay = (game, route) => {
    const session = factory(game, settings);
    for (const index of route) { assert(session.view().legalTiles.includes(index)); session.tap(index); }
    replayedTaps += verifyAttempt(encodeGame(game), route, settings, session.audit()); assert(session.view().win);
  };
  replay({ ...actual, down: [0, 0, 0, 1] }, winner.path);
  const usedKnowledge = createReusableExploration();
  const unknownFirst = { ...state, pictures: [null, 1, 2, 2], down: [1, 0, 0, 0] };
  usedKnowledge.search(model, unknownFirst, roots, { ...config, nodes: 3 });
  const nowKnown = { ...unknownFirst, pictures: [1, 1, 2, 2] };
  const invalidated = usedKnowledge.search(model, nowKnown, roots, { ...config, version: 'used-picture-learned', nodes: 1 });
  assert.equal(invalidated.reusable.resumed, false); assert.equal(usedKnowledge.stats().dependencyRestarts, 1);
  const forgotten = unqueried.search(model, unknown, roots, { ...config, version: 'forgotten-fact', nodes: 1 });
  assert.equal(forgotten.reusable.resumed, false); assert.equal(unqueried.stats().knowledgeResets, 1);
  const bounded = createReusableExploration({ maximumDependencies: 1, maximumTotalDependencies: 1 });
  const capped = bounded.search(model, state, roots, { ...config, nodes: 1000 });
  assert.equal(capped.reason, 'dependency_cap'); assert.equal(capped.path, null); assert(capped.boundary && !capped.knownDead);
  assert.equal(bounded.stats().storedDependencies, 1);
  const globallyBounded = createReusableExploration({ maximumDependencies: 2, maximumTotalDependencies: 2 });
  globallyBounded.search(model, state, roots, { ...config, nodes: 3 });
  globallyBounded.search(model, state, [{ index: 2 }], { ...config, nodes: 6 });
  assert(globallyBounded.stats().storedDependencies <= 2 && globallyBounded.stats().evictedJobs > 0);
  factory.verifySource();
  console.log('PASS public dependency validation preserves supported frontiers across archive and unused-picture changes, restarts only affected jobs on used role/picture changes, resumes bounded validation without claiming search work, rejects forgotten facts, bounds dependencies and independently replays ' + replayedTaps + ' winning physical taps');
}

if (require.main === module) test();
module.exports = test;
