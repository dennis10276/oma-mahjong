'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createHumanController, visibleRole, verifyAttempt, playHumanCampaign } = require('./human_reference_campaign.js');
const { publicContextFor } = require('./human_reference_screen.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 10 }, (_, index) => ({ x: index === 0 ? 0 : 2 + (index - 1) * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 3, 4, 5, 2, 3, 4, 5],
    down: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  for (const boardMode of ['standard', 'lab']) for (const usePlacementContract of [false, true]) {
    const controller = createHumanController(tiles, { usePlacementContract }, { boardMode });
    const observe = session => {
      const state = session.view().state;
      const observed = observeBoard(tiles, state, null,
        { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) });
      controller.observe(state, observed); return observed;
    };
    controller.beginAttempt(); const failed = factory(actual, settings);
    assert.equal(observe(failed).roles[0], null);
    for (const index of [1, 0, 2, 3, 4, 5]) {
      controller.decide(); controller.acknowledge(index, true); failed.tap(index); observe(failed);
    }
    assert.equal(failed.view().why, 'tray');
    assert.equal(verifyAttempt(encodeGame(actual), [1, 0, 2, 3, 4, 5], settings, failed.audit()), 6);
    controller.beginAttempt(); const retry = factory(actual, settings);
    assert.equal(observe(retry).roles[0], null);
    assert.equal(controller.known().initialRoles[0], null, 'The placement deduction must not become a fictitious seen initial role');
    assert.equal(controller.known().pictures[0], 1);
    const decision = controller.decide();
    assert.equal(decision.plan.knownWin, boardMode === 'standard' && usePlacementContract);
    if (decision.plan.knownWin) {
      const actions = [];
      while (retry.view().type !== 'productionPhysicalEnd-v1') {
        const next = controller.decide(), index = next.plan.index;
        assert(retry.view().legalTiles.includes(index));
        actions.push(index); controller.acknowledge(index, true); retry.tap(index); observe(retry);
      }
      assert(retry.view().win);
      assert.equal(verifyAttempt(encodeGame(actual), actions, settings, retry.audit()), actions.length);
    }
  }
  const icy = { ...actual, rules: { ice: { 0: 1 }, iceNb: Layouts.iceNeighbors(tiles), keys: [], locks: null } };
  for (const role of ['ice', 'lock', 'key']) {
    const contradictory = { ...actual, rules: { iceNb: Layouts.iceNeighbors(tiles), ice: role === 'ice' ? { 0: 1 } : {},
      keys: role === 'key' ? [0, 1] : role === 'lock' ? [1, 2] : [], locks: new Set(role === 'lock' ? [0] : []) } };
    assert.throws(() => playHumanCampaign(contradictory, { planning: { usePlacementContract: true },
      publicContext: { boardMode: 'standard' }, maximumAttempts: 1 }), /placement contract/);
  }
  assert(playHumanCampaign(icy, { planning: { usePlacementContract: true }, publicContext: { boardMode: 'lab' },
    maximumAttempts: 1 }).verifiedTaps > 0, 'Lab mode must retain actual closed-ice support');
  for (const boardSource of ['recordedOpening', 'versionTable', 'currentClassicDefinitionAspect1.5', 'currentFixedDefinition']) {
    assert.deepEqual(publicContextFor({ boardSource, lv: 1 }), { boardMode: 'standard' });
    assert.deepEqual(publicContextFor({ boardSource, lv: 999, wonOn: 50 }), { boardMode: 'standard' });
  }
  assert.deepEqual(publicContextFor({ boardSource: 'levelLab' }), { boardMode: 'lab' });
  assert.deepEqual(publicContextFor({ boardSource: 'providedDevelopmentBoard' }), {});
  assert.throws(() => createHumanController(tiles, {}, { boardMode: 'standard', level: 1 }));
  assert.throws(() => createHumanController(tiles, {}, { boardMode: 'private' }));
  assert.throws(() => createHumanController(tiles, { usePlacementContract: 1 }));
  const generatedTiles = Array.from({ length: 16 }, (_, index) => ({ x: index % 4 * 2, y: Math.floor(index / 4) * 2, z: 0 }));
  const faces = generatedTiles.map((tile, index) => Math.floor(index / 2)), path = generatedTiles.map((tile, index) => index);
  const avoid = new Set([0, 2, 8, 10]);
  let iceControls = 0, keyControls = 0, lockControls = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const obstacles = Layouts.obstacles(generatedTiles, faces, { level: 80, seed, avoid, path });
    if (!obstacles) continue;
    const ice = Object.keys(obstacles.ice).map(Number), keys = obstacles.keys, locks = obstacles.locks;
    assert([...ice, ...keys, ...locks].every(index => !avoid.has(index)));
    iceControls += ice.length; keyControls += keys.length; lockControls += locks.length;
  }
  assert(iceControls > 0 && keyControls > 0 && lockControls > 0);
  factory.verifySource();
  console.log('PASS observed backs support standard-mode obstacle exclusion without revealing pictures or roles, remembered closed matches gain a physical winning witness, lab mode keeps closed obstacles, and contradictory contracts are rejected before play');
}

if (require.main === module) test();
module.exports = test;
