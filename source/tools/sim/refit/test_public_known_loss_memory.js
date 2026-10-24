'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createKnownLossMemory } = require('./public_known_loss_memory.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { legal, advance } = require('./known_tray_plan.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }, { x: 8, y: 0, z: 2 }, { x: 12, y: 0, z: 2 },
    { x: 12, y: 0, z: 1 }, { x: 8, y: 0, z: 1 }];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 1, 2, 3, 4, 3, 4], down: tiles.map(() => 0), rules: null, clock: null };
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, factory = createSessionFactory(), session = factory(actual, settings);
  session.tap(0);
  const beforeTrapFrame = session.view().state;
  const beforeTrap = { ...beforeTrapFrame, pictures: observeBoard(tiles, beforeTrapFrame, null,
    { picture: index => actual.faces[index], role: () => 'none' }).pictures };
  session.tap(1);
  const frame = session.view().state;
  const observed = observeBoard(tiles, frame, null, { picture: index => actual.faces[index], role: () => 'none' });
  const state = { ...frame, pictures: observed.pictures };
  const game = { tiles, nb: actual.nb, rules: null, clock: null };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const actions = legal(game, state).free.map(index => ({ index }));
  const proof = search(game, state, actions, { ...REFERENCE_PARAMETERS, nodes: 64, beam: 8 });
  assert(proof.knownDead && !proof.boundary);
  const memory = createKnownLossMemory(game);
  assert(memory.recordActual(state, proof, actions));
  assert(memory.knowsLoss(state));
  const rememberedGame = { ...game, publicKnownLoss: position => memory.knowsLoss(position) };
  const restricted = search(rememberedGame, beforeTrap, [{ index: 1 }], { ...REFERENCE_PARAMETERS, nodes: 64 });
  assert(restricted.knownDead && restricted.rememberedLossPrunes > 0);
  assert(!memory.recordActual(beforeTrap, restricted, [{ index: 1 }]),
    'A losing requested root must not condemn the earlier position with other real winning actions');
  const capped = search(rememberedGame, beforeTrap, [{ index: 1 }], { ...REFERENCE_PARAMETERS, nodes: 1 });
  assert(capped.rememberedLossPrunes > 0 && capped.boundary && !capped.knownDead);
  assert(memory.knowsLoss({ ...state, moves: state.moves + 10 }));
  assert(!memory.knowsLoss({ ...state, relieved: true }));
  assert(!memory.knowsLoss({ ...state, arriving: [101] }));
  assert(!memory.recordActual(state, proof, actions));
  const incomplete = createKnownLossMemory(game);
  assert(!incomplete.recordActual(state, proof, actions.slice(0, 1)), 'A proof for selected roots cannot become a whole-position fact');
  assert(!incomplete.recordActual(state, { knownDead: false }, actions));
  assert.throws(() => incomplete.recordActual(state, { ...proof, boundary: true }, actions));
  assert.throws(() => incomplete.recordActual(state, { ...proof, unknownTransitions: 1 }, actions));
  assert.throws(() => incomplete.recordActual(advance(game, state, 4).state, proof, actions));
  const external = memory.entries(); external[0].certificate.exhaustedKnownGraph = false;
  assert(memory.entries()[0].certificate.exhaustedKnownGraph);
  assert(!createKnownLossMemory(game).knowsLoss(state));
  session.tap(4); session.tap(5); assert.equal(session.view().why, 'tray');
  assert.equal(verifyAttempt(encodeGame(actual), [0, 1, 4, 5], settings, session.audit()), 4);
  const winningSession = factory(actual, settings), winningActions = [0, 4, 5, 6, 7, 2, 3, 1];
  for (const index of winningActions) winningSession.tap(index);
  assert(winningSession.view().win);
  assert.equal(verifyAttempt(encodeGame(actual), winningActions, settings, winningSession.audit()), winningActions.length);
  assert(!memory.knowsLoss(beforeTrap), 'A remembered losing position must not condemn an earlier position with a real winning route');
  const clockGame = { ...actual, clock: { i: 4, n: 10 } }, clockSession = factory(clockGame, settings);
  for (const index of [0, 1]) clockSession.tap(index);
  const clockState = { ...clockSession.view().state, pictures: observed.pictures };
  const publicClock = { ...game, clock: clockGame.clock };
  const clockProof = search(publicClock, clockState, actions, { ...REFERENCE_PARAMETERS, nodes: 64 });
  const clockMemory = createKnownLossMemory(publicClock);
  assert(clockProof.knownDead && clockMemory.recordActual(clockState, clockProof, actions));
  assert(!clockMemory.knowsLoss({ ...clockState, moves: clockState.moves + 1 }));
  assert.equal(verifyAttempt(encodeGame(clockGame), [0, 1], settings, clockSession.audit()), 2);
  factory.verifySource();
  console.log('PASS remembered loss facts require an actual observed fully exhausted public graph covering every available root, retain clock/arrival/relief distinctions, reject hypothetical and bounded records, and replay the physical witnesses independently');
}

if (require.main === module) test();
module.exports = test;
