'use strict';
const assert = require('assert/strict');
const { openingPlanningController } = require('./public_opening_planning.js');
const { playHumanCampaign, createHumanController, verifyAttempt } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');
const profile = { ...require('./human_level_measure_profile.json'), openingReusablePlanning: false };
const Layouts = require('../../../www/layouts.js');

function test() {
  const opening = { physicalTaps: 0, moves: 0, tray: [] };
  function select(budget, locks) {
    const constructed = [], events = [];
    const controller = openingPlanningController({ ...profile, openingConditionalPlanning: true, publicActionSalt: 3 }, options => {
      constructed.push(options);
      return { beginAttempt() { events.push('begin'); }, observe() { events.push('observe'); },
        known() { return events.length; }, completeAttempt() { events.push('finish'); } };
    });
    const packet = { clock: budget === null ? null : { i: 0, n: budget }, roles: Array(locks).fill('lock') };
    Object.defineProperty(packet, 'pictures', { get() { throw Error('Selector must not inspect pictures'); } });
    controller.beginAttempt(); controller.observe(opening, packet);
    assert.equal(constructed.at(-1).publicActionSalt, 3);
    assert.equal(constructed.at(-1).openingConditionalPlanning, undefined);
    return { controller, constructed, events };
  }
  for (const [budget, locks, expected] of [[50, 3, true], [51, 3, false], [50, 4, false],
    [44, 3, true], [37, 6, false], [61, 1, false], [null, 0, false]]) {
    const result = select(budget, locks);
    assert.equal(result.controller.openingSelectionStats().enhanced, expected);
    assert.equal(result.constructed.length, expected ? 2 : 1);
    const chosen = result.constructed.at(-1);
    assert.equal(chosen.clockRecoveryMinSlack, expected ? 30 : profile.clockRecoveryMinSlack);
    assert.equal(chosen.survivalEarlyForks, expected ? true : profile.survivalEarlyForks);
    result.controller.observe({ physicalTaps: 10, moves: 10, tray: [1] }, { clock: null, roles: [] });
    result.controller.completeAttempt(); result.controller.beginAttempt();
    result.controller.observe(opening, { clock: { i: 0, n: 100 }, roles: Array(8).fill('lock') });
    assert.equal(result.controller.openingSelectionStats().enhanced, expected);
    assert.equal(result.constructed.length, expected ? 2 : 1);
    assert(result.controller.known() > 0);
  }
  const tiles = [0, 8, 16, 24].map(x => ({ x, y: 0, z: 0 }));
  let replayedTaps = 0;
  for (const budget of [50, 51, null]) {
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2], down: [0, 0, 0, 0], rules: null,
      clock: budget === null ? null : { i: 0, n: budget } };
    const conditional = playHumanCampaign(game, { maximumAttempts: 2,
      planning: { ...profile, openingConditionalPlanning: true }, captureDecisions: true });
    const selected = budget === 50 ? { ...profile, survivalBranches: true, survivalBacktracking: true,
      survivalEarlyForks: true, clockOrphanPreparation: true, clockRecoveryMinSlack: 30 } : profile;
    const direct = playHumanCampaign(game, { maximumAttempts: 2, planning: selected, captureDecisions: true });
    assert.equal(conditional.wonOn, 1);
    assert.deepEqual(conditional.attempts.map(row => row.actions), direct.attempts.map(row => row.actions));
    assert.equal(conditional.openingPlanning.enhanced, budget === 50);
    replayedTaps += conditional.verifiedTaps + direct.verifiedTaps;
  }
  const retryTiles = Array.from({ length: 16 }, (tile, index) => ({ x: index * 8, y: 0, z: 0 }));
  const retryGame = { tiles: retryTiles, nb: Layouts.neighbors(retryTiles), faces: retryTiles.map((tile, index) => index % 8 + 1),
    down: retryTiles.map(() => 1), rules: null, clock: { i: 15, n: 50 } };
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const controller = createHumanController(retryTiles, { ...profile, openingConditionalPlanning: true });
  function observeSession(session) {
    const frame = session.view(), allowed = new Set(frame.legalTiles ?? []);
    const packet = observeBoard(retryTiles, frame.state, retryGame.clock,
      { picture: index => retryGame.faces[index], role: () => 'none', takeable: index => allowed.has(index) });
    const physical = Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
      .map(field => [field, frame.state[field]]));
    controller.observe(physical, packet);
  }
  controller.beginAttempt(); const first = factory(retryGame, settings); observeSession(first);
  const failed = [0, 0, 1, 1, 2, 2, 3, 3];
  for (const index of failed) { controller.decide(); controller.acknowledge(index, true); first.tap(index); observeSession(first); }
  assert.equal(first.view().why, 'tray'); controller.completeAttempt('physicalLoss');
  assert.deepEqual(controller.known().pictures.slice(0, 4), [1, 2, 3, 4]);
  replayedTaps += verifyAttempt(encodeGame(retryGame), failed, settings, first.audit());
  controller.beginAttempt(); const second = factory(retryGame, settings); observeSession(second);
  assert.deepEqual(controller.known().pictures.slice(0, 4), [1, 2, 3, 4]);
  assert(controller.openingSelectionStats().enhanced);
  controller.completeAttempt('unresolvedBudget'); factory.verifySource();
  console.log('PASS public opening selector respects clock50/51 and lock3/4 boundaries, never reads pictures, retains real observed memory after a production loss and across retries/changing symbols, preserves salt and independently replays '+replayedTaps+' production taps against both direct policies');
}
if (require.main === module) test();
module.exports = test;
