'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { observeBoard } = require('./human_board_visibility.js');
const { visibleRole } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { createPairedPictureSampler } = require('./public_paired_picture_sampler.js');
const { createHypothesisPhysics } = require('./public_hypothesis_physics.js');

function problemFrom(actual, actions = [], boardMode = 'standard', rejected = null) {
  const factory = createSessionFactory(), session = factory(actual, { seed: 1, tapMs: 1000, choiceLimit: 64 });
  const memory = actual.tiles.map(() => null), orientation = memory.slice(), initialRoles = memory.slice(), frames = [];
  const observe = () => {
    const state = session.view().state;
    const observed = observeBoard(actual.tiles, state, actual.clock,
      { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) });
    observed.pictures.forEach((picture, index) => { if (picture !== null) memory[index] = picture; });
    observed.down.forEach((value, index) => { if (value !== null) orientation[index] = value; });
    observed.roles.forEach((role, index) => {
      if (state.physicalTaps === 0 || role === 'key' || role === 'lock') {
        if (role !== null) initialRoles[index] = role;
      }
    });
    frames.push({ state: Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
      .map(field => [field, structuredClone(state[field])])), roles: observed.roles });
  };
  observe();
  if (rejected !== null) assert(!session.view().legalTiles.includes(rejected));
  for (const index of actions) { session.tap(index); observe(); }
  return { tiles: actual.tiles, rememberedPictures: memory, rememberedDown: orientation, initialRoles,
    episodes: [{ actions, frames }], blockedFacts: rejected === null ? [] : [{ index: rejected, attempt: 1, physicalTaps: 0,
      alive: frames[0].state.alive, source: 'observedRejectedGeometricallyFreeTap' }], boardMode, clock: actual.clock };
}

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 4, 4],
    down: [0, 1, 0, 0, 0, 0, 0, 0], rules: null, clock: null };
  for (const history of [[], [0, 2]]) {
    const problem = problemFrom(actual, history), snapshot = JSON.stringify(problem);
    assert.equal(problem.rememberedPictures[1], null);
    const hypothesis = createPairedPictureSampler(problem.rememberedPictures, { random: () => 0 }).sample();
    const evaluator = createHypothesisPhysics(problem, { random: () => 0 });
    assert(evaluator.prepare({ hypothesis, deadline: Date.now() + 2000, worldOrdinal: 1 }));
    const preparationStats = evaluator.stats();
    assert.equal(preparationStats.verifiedHypotheticalClears, 0, 'Preparing a world cannot count any winning root');
    assert(evaluator.prepare({ hypothesis: structuredClone(hypothesis), deadline: Date.now() + 2000, worldOrdinal: 1 }));
    assert.deepEqual(evaluator.stats(), preparationStats, 'Repeated preparation reuses the same independently validated history');
    for (const index of history.length ? [1, 3] : [0, 2]) {
      const result = evaluator.evaluate({ hypothesis, index, deadline: Date.now() + 2000, nodeLimit: 256, worldOrdinal: 1 });
      assert.equal(result.status, 'cleared'); assert.equal(result.kind, 'hypothesisEvaluation');
      assert(result.nodes <= 256); assert.equal(result.knownWin, undefined);
    }
    assert.equal(evaluator.stats().historyReplays, 1, 'Every candidate in a batch shares one validated world');
    assert.equal(evaluator.stats().verifiedHypotheticalClears, 2);
    assert.equal(JSON.stringify(problem), snapshot); assert.equal(problem.rememberedPictures[1], null);
    evaluator.verifySource();
    const capped = createHypothesisPhysics(problem, { random: () => 0 });
    assert.equal(capped.evaluate({ hypothesis, index: history.length ? 1 : 0,
      deadline: Date.now() + 1000, nodeLimit: 1, worldOrdinal: 1 }).status, 'unresolved');
    const expired = createHypothesisPhysics(problem, { random: () => 0, now: () => 1 });
    assert.equal(expired.evaluate({ hypothesis, index: 0, deadline: 1, nodeLimit: 8, worldOrdinal: 1 }).status, 'unresolved');
    assert.equal(expired.stats().assignments, 0);
    assert.equal(expired.prepare({ hypothesis, deadline: 1, worldOrdinal: 1 }), false);
    assert.equal(expired.stats().assignments, 0);
    assert.throws(() => evaluator.prepare({ hypothesis, deadline: Date.now() + 1000, worldOrdinal: 1, seed: 7 }));
  }
  const changedHistory = problemFrom(actual, [0, 2]); changedHistory.episodes[0].frames.at(-1).state.tray = [5, 6];
  const inconsistent = createHypothesisPhysics(changedHistory, { random: () => 0, maximumAssignments: 2 });
  const hypothesis = createPairedPictureSampler(changedHistory.rememberedPictures, { random: () => 0 }).sample();
  assert.equal(inconsistent.evaluate({ hypothesis, index: 1, deadline: Date.now() + 1000, nodeLimit: 64, worldOrdinal: 1 }).status, 'unresolved');
  assert.equal(inconsistent.stats().verifiedHypotheticalClears, 0);
  assert(inconsistent.stats().rejectedAssignments > 0);

  const specialTiles = Array.from({ length: 8 }, (unused, index) => ({ x: index === 0 ? 0 : 2 + (index - 1) * 4, y: 0, z: 0 }));
  const frozen = { tiles: specialTiles, nb: Layouts.neighbors(specialTiles), faces: [1, 1, 2, 2, 9, 9, 3, 3],
    down: [1, 0, 0, 0, 0, 0, 0, 0], clock: null,
    rules: { iceNb: Layouts.iceNeighbors(specialTiles), ice: { 0: 1 }, locks: new Set(), keys: [4, 5] } };
  const negative = problemFrom(frozen, [2, 3], 'lab', 0);
  assert.equal(negative.initialRoles[0], null);
  const sampled = createPairedPictureSampler(negative.rememberedPictures, { random: () => 0 }).sample();
  const evaluator = createHypothesisPhysics(negative, { random: () => 0 });
  assert.equal(evaluator.evaluate({ hypothesis: sampled, index: 0, deadline: Date.now() + 1000,
    nodeLimit: 128, worldOrdinal: 1 }).status, 'unresolved', 'A blocked probe is not a hypothetical physical loss');
  assert.equal(evaluator.evaluate({ hypothesis: sampled, index: 1, deadline: Date.now() + 2000,
    nodeLimit: 256, worldOrdinal: 1 }).status, 'cleared');
  assert.equal(negative.initialRoles[0], null); assert.equal(negative.rememberedPictures[0], null);
  evaluator.verifySource();
  const changed = structuredClone(sampled); [changed.pictures[0], changed.pictures[2]] = [changed.pictures[2], changed.pictures[0]];
  assert.throws(() => evaluator.prepare({ hypothesis: changed, deadline: Date.now() + 1000, worldOrdinal: 1 }), /same picture filling/);
  assert.throws(() => evaluator.evaluate({ hypothesis: changed, index: 1, deadline: Date.now() + 1000,
    nodeLimit: 64, worldOrdinal: 1 }), /same picture filling/);
  assert.throws(() => createHypothesisPhysics({ ...negative, faces: frozen.faces }));
  assert.throws(() => createHypothesisPhysics({ ...negative, seed: 1 }));
  const secretTiles = tiles.map(tile => {
    const copied = { ...tile }; Object.defineProperty(copied, 'face', { enumerable: true, get() { throw Error('Private picture read'); } }); return copied;
  });
  const safeProjection = createHypothesisPhysics({ ...problemFrom(actual), tiles: secretTiles }, { random: () => 0 });
  safeProjection.verifySource();
  console.log('PASS public-only hypothetical physics replays actual history and every hypothetical clear through original production, respects closed placement and negative probes, shares a world across roots, rejects contradictory histories and keeps guesses out of picture/role memory');
}

if (require.main === module) test();
module.exports = test;
