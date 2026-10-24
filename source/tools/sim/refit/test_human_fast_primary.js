'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, fastPrimaryOptions, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { informationPlayout } = require('./public_information_playout.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const stack = Array.from({ length: 6 }, (unused, height) => ({ x: 0, y: 0, z: height }));
  const partners = Array.from({ length: 6 }, (unused, index) => ({ x: 8 + index * 4, y: 0, z: 0 }));
  const tiles = [...stack, ...partners];
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [5, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 5],
    down: tiles.map(() => 0), rules: null, clock: { i: 0, n: 12 } };
  const memory = { pictures: game.faces.slice(), down: game.down.slice(), initialRoles: tiles.map(() => 'none') };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 128 };
  const witnesses = [];
  for (const taps of [4, 16]) {
    const session = factory(game, settings), plans = [];
    const report = informationPlayout({ game, session, candidate: 5, memory, roleAt: visibleRole,
      deadline: Date.now() + 1500, createPolicy(deadline) {
        const policy = createHumanController(tiles, fastPrimaryOptions({ informationPlayoutNodes: 16,
          informationPlayoutTaps: taps, knownPairMacros: true, exclusiveRoles: true, usePlacementContract: true,
          cachePublicAnalysis: true }, deadline), { boardMode: 'standard' });
        return { ...policy, decide() { const selected = policy.decide(); plans.push(selected.plan); return selected; } };
      } });
    assert.equal(report.status, 'cleared');
    assert.equal(verifyAttempt(encodeGame(game), report.path, settings, session.audit()), report.path.length);
    witnesses.push(plans[0]);
  }
  assert(!witnesses[0].knownWin && !witnesses[0].safeClockExit);
  assert(witnesses[0].path.length <= 4);
  assert(witnesses[1].knownWin); assert(witnesses[1].path.length > 4);
  const open = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const choices = [];
  for (const hidden of [2, 5]) for (const recovery of [false, true]) {
    const actual = { tiles: open, nb: Layouts.neighbors(open), faces: [1, 1, hidden, hidden, 3, 3, 4, 4],
      down: [1, 0, 1, 1, 0, 0, 0, 0], rules: null, clock: null };
    const observedMemory = { pictures: [1, 1, null, null, 3, 3, 4, 4], down: actual.down.slice(), initialRoles: open.map(() => 'none') };
    const before = JSON.stringify(observedMemory), selected = [], session = factory(actual, settings);
    const report = informationPlayout({ game: actual, session, candidate: 0, memory: observedMemory, roleAt: visibleRole,
      deadline: Date.now() + 1000, createPolicy(deadline) {
        const policy = createHumanController(open, fastPrimaryOptions({ informationPlayoutNodes: 1,
          informationPlayoutTaps: 4, informationPlayoutRecovery: recovery, knownPairMacros: true,
          exclusiveRoles: true, usePlacementContract: true }, deadline), { boardMode: 'standard' });
        return { ...policy, decide() { const decision = policy.decide(); selected.push(decision.plan.index); return decision; } };
      } });
    assert.equal(report.status, 'cleared'); assert.equal(JSON.stringify(observedMemory), before);
    assert.equal(verifyAttempt(encodeGame(actual), report.path, settings, session.audit()), report.path.length);
    choices.push(selected[0]);
  }
  assert.deepEqual(choices, [2, 1, 2, 1]);
  assert.throws(() => createHumanController(open, { informationPlayoutTaps: 0 }));
  assert.throws(() => createHumanController(open, { informationPlayoutRecovery: 'yes' }));
  factory.verifySource();
  console.log('PASS a longer fast-primary horizon constructs a production clock-clearing witness unavailable to four taps; recovery mode completes a known open pair before new inspection, preserves hidden-swap invariance and actual memory, and every route independently replays');
}

if (require.main === module) test();
module.exports = test;
