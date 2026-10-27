'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { analyzeSurvival } = require('./public_survival_continuation.js');
const { analyzeContinuation } = require('./public_dead_end.js');
const { legal } = require('./known_tray_plan.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');
const { verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: .28, y: .28 / 1.24, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
  const model = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: { i: 1, n: 2 } };
  model.publicFrontier = position => ({ free: tiles.flatMap((tile, index) => position.alive[index]
    && Layouts.isFree(index, position.alive, model.nb) ? [index] : []), uncertain: [], relieved: !!position.relieved });
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(model, field, { get() { throw Error('Private survival proof ' + field); } });
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  let replayedTaps = 0;
  const replay = (game, route) => {
    const session = factory(game, settings);
    for (const index of route) { assert(session.view().legalTiles.includes(index)); session.tap(index); }
    replayedTaps += verifyAttempt(encodeGame(game), route, settings, session.audit()); return session;
  };
  let canonical = null;
  for (const hidden of [...Array(36).keys(), 101]) {
    const actual = { ...model, faces: [1, hidden, 2, 2], down: [0, 0, 0, 0] };
    const initial = factory(actual, settings).view();
    const seen = observeBoard(tiles, initial.state, actual.clock, { picture: index => actual.faces[index], role: () => 'none' });
    const publicState = { ...initial.state, pictures: seen.pictures, down: seen.down }, before = structuredClone(publicState);
    assert.equal(publicState.pictures[1], null); assert.equal(publicState.down[1], null);
    const roots = initial.legalTiles.map(index => ({ index }));
    const proof = analyzeSurvival(model, publicState, roots, { nodes: 256, milliseconds: 500 });
    assert.deepEqual(proof.forcedPath, [0]); assert.deepEqual(proof.discardedRoots, [2, 3]);
    assert(proof.necessaryIfSolvable && !proof.knownWin && !proof.knownDead);
    assert(proof.boundary && proof.proof.survivingRouteMayBeUnresolved);
    assert.deepEqual(publicState, before);
    const comparable = { forcedPath: proof.forcedPath, discarded: proof.discardedRoots, roots: proof.rootStatuses };
    if (canonical === null) canonical = comparable; else assert.deepEqual(comparable, canonical);
    replay(actual, proof.forcedPath);
    for (const wrong of [2, 3]) {
      const first = replay(actual, [wrong]);
      for (const second of first.view().legalTiles) assert.equal(replay(actual, [wrong, second]).view().why, 'clock');
      assert(analyzeContinuation(model, publicState, [{ index: wrong }], 256).knownDead);
    }
    if (hidden === 1 || hidden === 101) assert(replay(actual, [0, 1, 2, 3]).view().win);
    if (hidden === 1) {
      const failed = factory(actual, settings), pictures = seen.pictures.slice(), down = seen.down.slice();
      for (const index of [0, 2]) {
        failed.tap(index);
        const packet = observeBoard(tiles, failed.view().state, actual.clock, { picture: target => actual.faces[target], role: () => 'none' });
        packet.pictures.forEach((picture, target) => { if (picture !== null) pictures[target] = picture; });
        packet.down.forEach((orientation, target) => { if (orientation !== null) down[target] = orientation; });
      }
      assert.equal(failed.view().why, 'clock');
      replayedTaps += verifyAttempt(encodeGame(actual), [0, 2], settings, failed.audit());
      const remembered = { ...initial.state, pictures, down };
      const necessary = analyzeSurvival(model, remembered, roots, { nodes: 256, milliseconds: 500 });
      assert.deepEqual(necessary.forcedPath, [0, 1]); assert(!necessary.discardedRoots.includes(0));
      assert(necessary.knownWin && replay(actual, necessary.winningPath).view().win);
      const bounded = analyzeSurvival(model, remembered, roots, { nodes: 1 });
      assert(!bounded.knownDead && !bounded.necessaryIfSolvable); assert.deepEqual(bounded.discardedRoots, []);
      const expired = analyzeSurvival(model, remembered, roots, { deadline: Date.now() - 1 });
      assert(!expired.knownDead && !expired.necessaryIfSolvable); assert.deepEqual(expired.discardedRoots, []);
      const partial = analyzeSurvival(model, remembered, [{ index: 2 }]);
      assert(!partial.completeRootCoverage && !partial.necessaryIfSolvable && !partial.knownDead);
    }
  }
  const cycleGame = { tiles, nb: model.nb, rules: null, clock: { i: 0, n: 1 } };
  const cycle = { alive: [1, 1, 1, 1], pictures: [1, null, 2, 2], down: [1, 0, 1, 0],
    tray: [], moves: 0, openPeek: 0, relieved: false, arriving: [] };
  const reopened = analyzeSurvival(cycleGame, cycle, [{ index: 2 }], { nodes: 256, milliseconds: 500 });
  assert(!reopened.completeRootCoverage && !reopened.necessaryIfSolvable);
  assert(!reopened.knownDead && !reopened.discardedRoots.includes(2), 'Returning to a partial root must reopen all legal actions');
  const traps = require('./fixtures/reference-known-traps.json');
  const { decodeGeometry } = require('./personal_reference_failure_trace.js');
  for (const fixture of traps.cases) {
    const geometry = decodeGeometry(fixture.geometry);
    const proof = analyzeSurvival(geometry, fixture.state, fixture.actions, { nodes: 4096, milliseconds: 500 });
    const projected = { ...geometry, publicExposure: createExposureFrontier(geometry.tiles, fixture.state, 'all') };
    const former = analyzeContinuation(projected, fixture.state, [{ index: fixture.losingRoot }], 4096);
    assert.equal(proof.discardedRoots.includes(fixture.losingRoot), former.knownDead);
    for (const index of proof.discardedRoots) assert(analyzeContinuation(projected, fixture.state, [{ index }], 4096).knownDead);
    assert(!proof.knownDead && !proof.necessaryIfSolvable);
    assert(proof.rootStatuses.filter(root => root.status !== 'rejected').length > 1);
    assert(fixture.actions.every(action => legal(geometry, fixture.state).free.includes(action.index)));
  }
  const flatTiles = [0, 8, 16, 24].map(position => ({ x: position, y: 0, z: 0 }));
  const flat = { tiles: flatTiles, nb: Layouts.neighbors(flatTiles), rules: null, clock: null };
  const flatActual = { ...flat, faces: [1, 1, 2, 2], down: [0, 0, 0, 0] };
  const flatInitial = factory(flatActual, settings).view().state;
  const packet = observeBoard(flatTiles, flatInitial, null, { picture: index => flatActual.faces[index], role: () => 'none' });
  const known = { ...flatInitial, pictures: packet.pictures, down: packet.down }, flatRoots = flatTiles.map((tile, index) => ({ index }));
  const broad = analyzeSurvival(flat, known, flatRoots, { nodes: 10, milliseconds: 500 });
  const deep = analyzeSurvival(flat, known, flatRoots, { nodes: 10, milliseconds: 500, depthFirst: true, rootPriority: [0] });
  assert(!broad.knownWin && broad.boundary && !broad.knownDead);
  assert(deep.knownWin && deep.searchOrder === 'branch_depth_first');
  assert(replay(flatActual, deep.winningPath).view().win);
  assert.throws(() => analyzeSurvival(flat, known, flatRoots, { depthFirst: true, rootPriority: [9] }));
  factory.verifySource();
  console.log('PASS conditional necessary prefixes reject only exhausted alternatives, stop at real new information, preserve a shared opening after one failed continuation, reopen partial-root cycles, keep bounds unresolved, match independent loss proofs and replay ' + replayedTaps + ' production taps across37 concealed worlds');
}

if (require.main === module) test();
module.exports = test;
