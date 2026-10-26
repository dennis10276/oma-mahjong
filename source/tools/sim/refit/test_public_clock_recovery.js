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
  const empty = search(game, state, roots, { ...options, clockRecovery: true, trayRecoveryClockMin: 1 });
  assert(!empty.clockRecoveryActive);
  assert.deepEqual([empty.index, empty.path], [legacy.index, legacy.path]);
  const carried = search(game, { ...state, tray: [9] }, roots, { ...options, clockRecovery: true, trayRecoveryClockMin: 1 });
  assert(carried.clockRecoveryActive);
  const urgent = { ...game, clock: { i: 0, n: 4 } };
  const comparable = result => [result.index, result.path, result.goal, result.knownWin, result.safeClockExit];
  const gated = search(game, state, roots, { ...options, clockRecovery: true, clockRecoveryMinSlack: 50 });
  assert(!gated.clockRecoveryActive); assert.deepEqual(comparable(gated), comparable(legacy));
  const atBoundary = search({ ...game, clock: { i: 0, n: 53 } }, state, roots,
    { ...options, clockRecovery: true, clockRecoveryMinSlack: 50 });
  const belowBoundary = search({ ...game, clock: { i: 0, n: 52 } }, state, roots,
    { ...options, clockRecovery: true, clockRecoveryMinSlack: 50 });
  assert(atBoundary.clockRecoveryActive && atBoundary.clockRecoveryMinSlack === 50);
  assert(!belowBoundary.clockRecoveryActive);
  const jointGate = { ...options, clockRecovery: true, clockRecoveryMinSlack: 50, trayRecoveryClockMin: 1 };
  assert(!search({ ...game, clock: { i: 0, n: 53 } }, state, roots, jointGate).clockRecoveryActive);
  assert(search({ ...game, clock: { i: 0, n: 53 } }, { ...state, tray: [9] }, roots, jointGate).clockRecoveryActive);
  assert(!search({ ...game, clock: { i: 0, n: 52 } }, { ...state, tray: [9] }, roots, jointGate).clockRecoveryActive);
  const tightSettings = { ...jointGate, tightClockRecovery: true, tightClockRecoveryMaxSlack: 5 };
  const carriedState = { ...state, tray: [9] };
  for (const [spare, expected] of [[2, false], [3, true], [5, true], [6, false]]) {
    const report = search({ ...game, clock: { i: 0, n: spare + 3 } }, carriedState, roots, tightSettings);
    assert.equal(report.tightClockRecoveryActive, expected);
    assert.equal(report.clockRecoveryActive, expected);
  }
  assert(!search(game, state, roots, tightSettings).tightClockRecoveryActive);
  assert(!search(game, { ...state, tray: [8, 9] }, roots, tightSettings).tightClockRecoveryActive);
  assert(!search({ ...game, clock: null }, carriedState, roots, tightSettings).tightClockRecoveryActive);
  const ampleAndTight = search({ ...game, clock: { i: 0, n: 53 } }, carriedState, roots, tightSettings);
  assert(ampleAndTight.clockRecoveryActive && !ampleAndTight.tightClockRecoveryActive);
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
  const tightCampaign = playHumanCampaign(actual, { maximumAttempts: 1, planning: tightSettings });
  assert.equal(tightCampaign.wonOn, 1);
  assert.equal(tightCampaign.verifiedTaps, tightCampaign.attempts[0].taps);
  assert.throws(() => search(game, state, roots, { ...options, tightClockRecovery: true }));
  assert.throws(() => search(game, state, roots, { ...tightSettings, tightClockRecoveryMaxSlack: 2 }));
  assert.throws(() => search(game, state, roots, { ...tightSettings, tightClockRecovery: 'yes' }));
  assert.throws(() => search(game, state, roots, { ...options, clockRecovery: 'yes' }));
  assert.throws(() => search(game, state, roots, { ...options, clockRecovery: true, clockRecoveryMinSlack: 2 }));
  console.log('PASS spare-clock recovery ranks public tray debt before digging, respects the configured carried-tile threshold, retains urgent/nonclock ordering and independently replays a production clock route');
}

if (require.main === module) test();
module.exports = test;
