'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createReusableExploration } = require('./public_reusable_exploration.js');
const { retryInformationSearch } = require('./public_retry_information.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = [0, 8, 16, 24].map(position => ({ x: position, y: 0, z: 0 }));
  const model = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  const actual = { ...model, faces: [1, 1, 2, 2], down: [0, 0, 0, 0] };
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const state = { ...factory(actual, settings).view().state, pictures: actual.faces.slice() };
  const config = { version: 'public', revalidatePublicChanges: true, continueAfterInformation: true };
  const legacy = createReusableExploration({ maximumJobs: 2 });
  const invested = createReusableExploration({ maximumJobs: 2, preferInvestedWork: true });
  let winner = null;
  for (let round = 0; round < 20 && !winner; round++) {
    for (const engine of [legacy, invested]) {
      const report = engine.search(model, state, [{ index: 0 }], { ...config, nodes: round ? 1 : 8 });
      if (engine === legacy && round) assert(!report.reusable.resumed && !report.knownWin);
      if (engine === invested && round) assert(report.reusable.resumed);
      if (engine === invested && report.knownWin) winner = report;
      engine.search(model, state, [{ index: 1 }], { ...config, nodes: 1 });
      engine.search(model, state, [{ index: 2 }], { ...config, nodes: 1 });
      assert(engine.stats().jobs <= 2);
    }
  }
  assert(winner?.knownWin); assert(invested.stats().resumedUnfinished > 0);
  const cached = invested.search(model, state, [{ index: 0 }], { ...config, nodes: 1 });
  assert(cached.knownWin); assert.equal(cached.nodes, 0); assert.deepEqual(cached.path, winner.path);
  const session = factory(actual, settings);
  for (const index of winner.path) { assert(session.view().legalTiles.includes(index)); session.tap(index); }
  assert(session.view().win);
  let replayedTaps = verifyAttempt(encodeGame(actual), winner.path, settings, session.audit());
  const nowBlocked = { ...model, publicFrontier: position => ({ free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [0] }) };
  const invalidated = invested.search(nowBlocked, state, [{ index: 0 }], { ...config, version: 'public-role-change', nodes: 1 });
  assert(!invalidated.knownWin); assert.equal(invalidated.reusable.resumed, false);
  assert(invested.stats().dependencyRestarts > 0);
  const bounded = createReusableExploration({ preferInvestedWork: true, maximumDependencies: 2, maximumTotalDependencies: 2 });
  for (const index of [0, 1, 2, 3]) {
    bounded.search(model, state, [{ index }], { ...config, nodes: 6 });
    assert(bounded.stats().storedDependencies <= 2);
  }
  assert(bounded.stats().evictedJobs > 0);
  assert.equal(bounded.search(model, state, [{ index: 0 }], { ...config, nodes: 1, deadline: Date.now() - 1 }).reason, 'deadline');
  assert.throws(() => createReusableExploration({ preferInvestedWork: 1 }));
  assert.throws(() => retryInformationSearch(() => ({}), { retainInvestedWork: true }));
  assert.throws(() => createHumanController(tiles, { reusableRetainInvestedWork: true }));
  let canonical = null;
  for (const hidden of [...Array(36).keys(), 101]) {
    const concealed = { ...model, faces: [hidden, hidden, 7, 7], down: [1, 1, 1, 1] };
    const physical = factory(concealed, settings), initial = physical.view().state;
    const packet = observeBoard(tiles, initial, null, { picture: index => concealed.faces[index], role: () => 'none' });
    const observed = { ...initial, pictures: packet.pictures, down: packet.down }, before = structuredClone(observed);
    const engine = createReusableExploration({ maximumJobs: 2, preferInvestedWork: true });
    const paths = [];
    for (const roots of [[0, 1, 2, 3], [1], [2], [0, 1, 2, 3]]) {
      const report = engine.search(model, observed, roots.map(index => ({ index })), { ...config, nodes: 100 });
      assert.equal(report.kind, 'actualPeekRequired'); assert(!report.knownWin && !report.knownDead);
      paths.push(report.path); assert(engine.stats().jobs <= 2);
    }
    if (canonical === null) canonical = paths; else assert.deepEqual(paths, canonical);
    assert.deepEqual(observed, before); physical.tap(paths[0][0]);
    assert.equal(physical.view().state.openPeek, paths[0][0]);
    replayedTaps += verifyAttempt(encodeGame(concealed), paths[0], settings, physical.audit());
  }
  factory.verifySource();
  console.log('PASS investment-aware bounded eviction retains unfinished work across scan cycles, protects active jobs and completed wins, invalidates changed public dependencies, respects deadlines/caps, is invariant across37 concealed worlds and independently replays ' + replayedTaps + ' production taps');
}

if (require.main === module) test();
module.exports = test;
