'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt, playHumanCampaign } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 2 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [5, 6, 7, 6, 7, 5], down: [0, 1, 0, 0, 1, 0],
    rules: null, clock: { i: 0, n: 6 } };
  const game = { tiles, nb: actual.nb, rules: null, clock: actual.clock };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), pictures: [5, null, 7, 6, null, 5], down: actual.down,
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const roots = [2, 3, 4, 5].map(index => ({ index }));
  const options = { ...REFERENCE_PARAMETERS, taps: 2, nodes: 64, beam: 16, pruneDead: false,
    goalRecovery: true, goalRecoveryMin: 1, riskFirstRecovery: true, alternativeRecoveryRoutes: true };
  const legacy = search(game, state, roots, options);
  assert.equal(legacy.index, 2);
  const recovered = search(game, state, roots, { ...options, clockRecovery: true });
  assert.equal(recovered.index, 4, 'With spare clock moves, inspect before committing an unmatched clock blocker');
  assert(recovered.clockRecoveryActive && !recovered.knownDead && !recovered.knownWin);
  const urgent = { ...game, clock: { i: 0, n: 4 } };
  const comparable = result => [result.index, result.path, result.goal, result.knownWin, result.safeClockExit];
  const urgentPlan = search(urgent, state, roots, { ...options, clockRecovery: true });
  assert(!urgentPlan.clockRecoveryActive);
  assert.deepEqual(comparable(urgentPlan), comparable(search(urgent, state, roots, options)));
  const nonclock = { ...game, clock: null };
  assert.deepEqual(comparable(search(nonclock, state, roots, { ...options, clockRecovery: true })),
    comparable(search(nonclock, state, roots, options)));
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 32 }, session = createSessionFactory()(actual, settings);
  for (const index of [4, 2, 1, 3, 0, 5]) session.tap(index);
  assert(session.view().win);
  assert.equal(verifyAttempt(encodeGame(actual), [4, 2, 1, 3, 0, 5], settings, session.audit()), 6);
  const campaign = playHumanCampaign(actual, { maximumAttempts: 1, planning: { ...options, clockRecovery: true } });
  assert.equal(campaign.wonOn, 1);
  assert.equal(campaign.verifiedTaps, campaign.attempts[0].taps);
  assert.throws(() => search(game, state, roots, { ...options, clockRecovery: 'yes' }));
  console.log('PASS spare-clock recovery ranks public tray debt before digging, retains urgent and nonclock ordering, and independently replays a matching inspection route through the production clock');
}

if (require.main === module) test();
module.exports = test;
