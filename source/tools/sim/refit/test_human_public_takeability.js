'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, visibleRole, playHumanCampaign } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { createAcceptedTapMemory } = require('./public_accepted_tap_memory.js');

function publicFrame(game, view) {
  const legal = new Set(view.legalTiles ?? []);
  return observeBoard(game.tiles, view.state, game.clock, {
    picture(index) { assert(!view.state.down[index] || view.state.openPeek === index); return game.faces[index]; },
    role: index => visibleRole(game, view.state, index), takeable: index => legal.has(index)
  });
}

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 4, 4], down: [1, 1, 0, 0, 0, 0, 0, 0],
    clock: null, rules: { ice: { 0: 1 }, iceNb: Layouts.iceNeighbors(tiles), locks: new Set([1]), keys: [2, 3] } };
  const factory = createSessionFactory(), session = factory(game, { seed: 1, tapMs: 1000, choiceLimit: 128 });
  const frame = publicFrame(game, session.view());
  assert.deepEqual(frame.takeable, [false, false, true, true, true, true, true, true]);
  assert.equal(frame.pictures[0], null); assert.equal(frame.pictures[1], null);
  assert.equal(frame.roles[0], 'ice'); assert.equal(frame.roles[1], 'lock');
  const controller = createHumanController(tiles, { rememberAcceptedTaps: true });
  controller.beginAttempt(); controller.observe(session.view().state, frame);
  assert(session.view().legalTiles.includes(controller.decide().plan.index));
  const replayed = playHumanCampaign(game, { maximumAttempts: 2, planning: { rememberAcceptedTaps: true } });
  assert.equal(replayed.rejected, 0);
  assert(replayed.verifiedTaps > 0);
  const memory = createAcceptedTapMemory(8);
  memory.observeAvailable(frame.takeable, session.view().state);
  assert(!memory.knowsAvailable(0, session.view().state.alive));
  assert(memory.knowsAvailable(2, session.view().state.alive));
  const smaller = session.view().state.alive.slice(); smaller[4] = 0;
  assert(memory.knowsAvailable(2, smaller));
  assert(!memory.entries().some(entry => entry.index === 0));
  const relieved = createAcceptedTapMemory(8);
  relieved.observeAvailable(frame.takeable, { ...session.view().state, relieved: true });
  assert.deepEqual(relieved.entries(), []);
  const covered = [{ x: 0, y: 0, z: 0 }, { x: 0.28, y: 0.28 / 1.24, z: 1 }];
  const state = { alive: [1, 1], down: [1, 0], openPeek: -1, moves: 0 };
  const observed = observeBoard(covered, state, null, { picture: () => 1, role: () => 'none',
    takeable(index) { assert.equal(index, 1, 'The observer must not request hidden legality of a non-free tile'); return true; } });
  assert.deepEqual(observed.takeable, [null, true]);
  assert.equal(observed.pictures[0], null); assert.equal(observed.roles[0], null);
  factory.verifySource();
  console.log('PASS the one observer exposes current free-tile takeability without probing, shows drawn back overlays but no back pictures, hides non-free legality, retains only conditional non-relieved availability and independently replays actual campaigns');
}
if (require.main === module) test();
module.exports = test;
