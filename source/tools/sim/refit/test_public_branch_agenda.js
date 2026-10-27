'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createBranchAgenda } = require('./public_branch_agenda.js');
const { analyzeSurvival } = require('./public_survival_continuation.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');
const { verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = Array.from({ length: 8 }, (tile, index) => ({ x: index * 8, y: 0, z: 0 }));
  const model = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  const actual = { ...model, faces: [1, 2, 3, 4, 1, 2, 3, 4], down: tiles.map(() => 1) };
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const observe = session => {
    const frame = session.view(), packet = observeBoard(tiles, frame.state, null,
      { picture: index => actual.faces[index], role: () => 'none' });
    return { ...frame.state, pictures: packet.pictures, down: packet.down };
  };
  const first = factory(actual, settings), state = observe(first), actions = first.view().legalTiles.map(index => ({ index }));
  const proof = analyzeSurvival(model, state, actions, { nodes: 256 });
  const agenda = createBranchAgenda(8, { maximumCheckpoints: 1 });
  assert.deepEqual(agenda.priorities(state, actions), [0, 1, 2, 3, 4, 5, 6, 7]);
  const initial = agenda.accept(state, actions, proof);
  assert.deepEqual(initial.active, [0, 1, 2]); assert.deepEqual(initial.deferred, [3, 4, 5, 6, 7]);
  assert.deepEqual(initial.rejectedNow, []);
  assert.deepEqual(agenda.priorities(state, actions, 7).slice(0, 3), [0, 1, 2]);
  const failed = [0, 0, 1, 1, 2, 2, 3, 3], loss = factory(actual, settings);
  for (const index of failed) loss.tap(index); assert.equal(loss.view().why, 'tray');
  let replayedTaps = verifyAttempt(encodeGame(actual), failed, settings, loss.audit());
  agenda.recordOutcome(failed, 'physicalLoss');
  assert.equal(agenda.outcomes()[0].rulesOutWholeOpening, false);
  assert(agenda.priorities(state, actions).includes(0));
  assert.deepEqual(agenda.accept(state, actions, proof).active, [0, 1, 2]);
  const winning = [0, 0, 4, 1, 1, 5, 2, 2, 6, 3, 3, 7], winner = factory(actual, settings);
  for (const index of winning) winner.tap(index); assert(winner.view().win);
  replayedTaps += verifyAttempt(encodeGame(actual), winning, settings, winner.audit());
  assert.equal(agenda.accept(state, actions, { ...proof, propagationComplete: false }), null);
  assert.equal(agenda.accept(state, actions, { ...proof, completeRootCoverage: false }), null);
  first.tap(0); const changed = observe(first), changedProof = analyzeSurvival(model, changed, actions, { nodes: 256 });
  agenda.accept(changed, actions, changedProof); assert.equal(agenda.stats().checkpoints, 1); assert.equal(agenda.stats().evictedCheckpoints, 1);
  replayedTaps += verifyAttempt(encodeGame(actual), [0], settings, first.audit());
  const clocked = { ...model, clock: { i: 7, n: 1 } }, knownActual = { ...actual, clock: clocked.clock, down: tiles.map(() => 0) };
  const clockSession = factory(knownActual, settings), knownFrame = clockSession.view();
  const knownPacket = observeBoard(tiles, knownFrame.state, clocked.clock, { picture: index => knownActual.faces[index], role: () => 'none' });
  const known = { ...knownFrame.state, pictures: knownPacket.pictures, down: knownPacket.down };
  const forced = analyzeSurvival(clocked, known, actions, { nodes: 2048, milliseconds: 500 });
  const freshAgenda = createBranchAgenda(8), selected = freshAgenda.accept(known, actions, forced, 0);
  assert.deepEqual(selected.active, [7]); assert.deepEqual(selected.rejectedNow.sort(), [0, 1, 2, 3, 4, 5, 6]);
  clockSession.tap(7); assert(!clockSession.view().lost);
  replayedTaps += verifyAttempt(encodeGame(knownActual), [7], settings, clockSession.audit());
  assert.throws(() => createBranchAgenda(8, { width: 0 }));
  assert.throws(() => createBranchAgenda(8, { maximumCheckpoints: 0 }));
  const retryTiles = Array.from({ length: 16 }, (tile, index) => ({ x: index * 8, y: 0, z: 0 }));
  const retryModel = { tiles: retryTiles, nb: Layouts.neighbors(retryTiles), rules: null, clock: null };
  const retryActual = { ...retryModel, faces: retryTiles.map((tile, index) => index % 8 + 1), down: retryTiles.map(() => 1) };
  const retryObserve = session => {
    const frame = session.view(), packet = observeBoard(retryTiles, frame.state, null,
      { picture: index => retryActual.faces[index], role: () => 'none' });
    return { ...frame.state, pictures: packet.pictures, down: packet.down };
  };
  const retryAgenda = createBranchAgenda(16, { backtracking: true, width: 3 });
  let retryOpening = null, retryActions = null, retryProof = null;
  for (const choice of [0, 1, 2]) {
    retryAgenda.beginAttempt();
    const session = factory(retryActual, settings), opening = retryObserve(session);
    retryOpening = opening; retryActions = session.view().legalTiles.map(index => ({ index }));
    retryProof = analyzeSurvival(retryModel, opening, retryActions, { nodes: 256 });
    retryAgenda.accept(opening, retryActions, retryProof);
    retryAgenda.noteFork(opening, [6, 7], [6], 0);
    for (const index of [6, 6]) { session.tap(index); retryAgenda.acknowledge(index, true); }
    const fork = retryObserve(session), available = session.view().legalTiles.map(index => ({ index }));
    retryAgenda.accept(fork, available, analyzeSurvival(retryModel, fork, available, { nodes: 256 }));
    retryAgenda.noteFork(fork, [0, 1, 2, 3, 4, 5, 7], [0, 1, 2, 3, 4, 5, 7], 2);
    for (const index of [choice, choice, 3, 3, 7, 7]) { session.tap(index); retryAgenda.acknowledge(index, true); }
    assert.equal(session.view().why, 'tray');
    const route = [6, 6, choice, choice, 3, 3, 7, 7];
    replayedTaps += verifyAttempt(encodeGame(retryActual), route, settings, session.audit());
    retryAgenda.recordOutcome(route, 'physicalLoss');
    const request = retryAgenda.stats().pendingRequest;
    assert.equal(request.index, choice < 2 ? choice + 1 : 7);
    assert.equal(request.prefixLength, choice < 2 ? 2 : 0);
    assert.equal(request.rejectsWholeBranch, false);
  }
  assert.equal(retryAgenda.stats().earlierForkSelections, 1);
  assert.equal(retryAgenda.stats().allocatedWorkingSetsPassed, 1);
  assert(retryAgenda.priorities(retryOpening, retryActions).includes(3));
  assert(!retryAgenda.accept(retryOpening, retryActions, retryProof).rejectedNow.length);
  factory.verifySource();
  console.log('PASS bounded three-branch agendas retain their working set and every deferred alternative, apply only current complete exclusions, preserve a winning shared opening after an actual failed play, bound checkpoints and independently replay ' + replayedTaps + ' production taps');
}

if (require.main === module) test();
module.exports = test;
