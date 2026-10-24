'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, selectedPaths = [];
  for (const primitivePeeks of [false, true]) for (const hidden of [2, 5]) for (const invalidated of [false, true]) {
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [0, 0, 1, 1, 3, 3, hidden, hidden],
      down: tiles.map(() => 1), rules: null, clock: null };
    const policy = createHumanController(tiles, { exclusiveRoles: true, usePlacementContract: true,
      hypothesisSampling: true, informationSampling: true, informationActionPaths: true,
      informationPrimitivePeeks: primitivePeeks,
      hypothesisMaximumWorlds: 1, knownPairMacros: true, nodes: 8, taps: 4 }, { boardMode: 'standard' });
    policy.rememberPublic({ pictures: [0, 0, 1, 1, 3, 3, null, null], down: game.down.slice(), initialRoles: tiles.map(() => 'none') });
    policy.beginAttempt();
    const session = factory(game, settings), taps = [];
    const observe = () => {
      const frame = session.view().state;
      policy.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
        .map(field => [field, frame[field]])), observeBoard(tiles, frame, null,
      { picture: index => game.faces[index], role: index => visibleRole(game, frame, index) }));
    };
    observe();
    const first = policy.decide();
    if (primitivePeeks) {
      assert.notEqual(first.plan.goal, 'hypothesisOption');
      assert.equal(first.plan.index, first.plan.hypothesisAudit.primaryIndex);
      assert.equal(first.plan.hypothesisAudit.changed, false);
      assert.equal(policy.hypothesisStats().compoundChoices, 0);
      continue;
    }
    assert.equal(first.plan.path.length, 2); assert.equal(first.plan.goal, 'hypothesisOption');
    if (!invalidated) selectedPaths.push(first.plan.path);
    policy.acknowledge(first.plan.index, true); session.tap(first.plan.index); taps.push(first.plan.index); observe();
    const comparisons = policy.hypothesisStats().contestedDecisions;
    if (invalidated) {
      policy.acknowledge(6, true); session.tap(6); taps.push(6); observe();
      const revised = policy.decide();
      assert.notEqual(revised.plan.goal, 'sampledOptionContinuation');
      assert.equal(policy.hypothesisStats().invalidatedOptions, 1);
      assert.equal(policy.hypothesisStats().retainedOptionTaps, 0);
      assert.equal(policy.known().pictures[6], hidden);
      assert.equal(verifyAttempt(encodeGame(game), taps, settings, session.audit()), 2);
      continue;
    }
    const second = policy.decide();
    assert.equal(second.plan.index, first.plan.path[1]); assert.equal(second.plan.goal, 'sampledOptionContinuation');
    assert.equal(policy.hypothesisStats().contestedDecisions, comparisons);
    assert.equal(policy.hypothesisStats().retainedOptionTaps, 1);
    assert.equal(policy.hypothesisStats().optionDecisions, 1);
    policy.acknowledge(second.plan.index, true); session.tap(second.plan.index); taps.push(second.plan.index); observe();
    assert.equal(session.view().state.alive.reduce((sum, alive) => sum + alive, 0), 6);
    assert.equal(verifyAttempt(encodeGame(game), taps, settings, session.audit()), 2);
    assert.deepEqual(policy.known().pictures.slice(6), [null, null]);
  }
  assert.deepEqual(selectedPaths[0], selectedPaths[1]);
  factory.verifySource();
  console.log('PASS sampled known-peek options execute both real production taps without resampling between them, preserve unknown-picture swap invariance and never import guessed facts into actual memory');
}

if (require.main === module) test();
module.exports = test;
