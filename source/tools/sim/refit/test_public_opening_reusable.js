'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const Layouts = require('../../../www/layouts.js');
const { openingPlanningController } = require('./public_opening_planning.js');
const { playHumanCampaign, createHumanController } = require('./human_reference_campaign.js');
const { openingConditionalPlanning, openingReusablePlanning, ...baseline } = require('./human_level_measure_profile.json');

function test() {
  // Frozen configuration is a test oracle, never a runtime profile override.
  const archived33 = require('./fixtures/reusable33-profile.json');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(archived33)).digest('hex'),
    'b15d7bab0a7e4fd7fd47ff658d7cab6c1d5c078f1f487b70d37f6f7e5598c506');
  const state = { physicalTaps: 0, moves: 0, tray: [] };
  for (const [budget, locks, family] of [[30, 4, 'reusable33'], [29, 4, 'retained23'],
    [30, 3, 'survival39'], [37, 6, 'reusable33'], [18, 7, 'retained23'], [44, 3, 'survival39'], [61, 1, 'retained23']]) {
    const created = [];
    const policy = openingPlanningController({ ...baseline, openingConditionalPlanning: true, openingReusablePlanning: true, publicActionSalt: 2 }, options => {
      created.push(options); return { beginAttempt() {}, observe() {}, completeAttempt() {}, known() { return options; } };
    });
    policy.beginAttempt();
    const packet = { clock: { i: 0, n: budget }, roles: Array(locks).fill('lock') };
    Object.defineProperty(packet, 'pictures', { get() { throw Error('Opening reusable selection cannot inspect pictures'); } });
    policy.observe(state, packet);
    assert.equal(policy.openingSelectionStats().family, family);
    const selected = policy.known(); assert.equal(selected.publicActionSalt, 2);
    assert.equal(selected.openingConditionalPlanning, undefined); assert.equal(selected.openingReusablePlanning, undefined);
    assert.equal(!!selected.reusablePublicPlanning, family === 'reusable33');
    assert.equal(!!selected.reusableContinueAfterInformation, family === 'reusable33');
    assert.equal(!!selected.reusablePrepareCrowded, family === 'reusable33');
    assert.equal(!!selected.survivalBranches, family === 'survival39');
    if (family === 'reusable33') {
      const { publicActionSalt, ...resolved } = selected;
      assert.deepEqual(resolved, archived33, 'All reusable settings must match archived33, including its node budget');
    } else assert.equal(selected.retryInformationNodes, baseline.retryInformationNodes);
    policy.observe({ physicalTaps: 4, moves: 4, tray: [1] }, { clock: null, roles: [] });
    policy.completeAttempt(); policy.beginAttempt(); policy.observe(state, { clock: { i: 0, n: 2 }, roles: [] });
    assert.equal(policy.openingSelectionStats().family, family);
    assert.equal(created.length, family === 'retained23' ? 1 : 2);
  }
  const custom = openingPlanningController({ ...baseline, openingConditionalPlanning: true,
    openingReusablePlanning: true, retryInformationMs: 80, publicActionSalt: 3 }, options => ({
    beginAttempt() {}, observe() {}, known() { return options; }
  }));
  custom.beginAttempt(); custom.observe(state, { clock: { i: 0, n: 30 }, roles: Array(4).fill('lock') });
  assert.equal(custom.known().retryInformationMs, 80, 'Preserve caller strength instead of loading the frozen fixture');
  assert.equal(custom.known().publicActionSalt, 3);
  assert.equal(custom.known().retryInformationNodes, 32768);
  const tiles = Array.from({ length: 12 }, (tile, index) => ({ x: index * 8, y: 0, z: 0 }));
  let taps = 0;
  for (const budget of [29, 30]) {
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [100, 100, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
      down: tiles.map(() => 0), rules: { ice: {}, iceNb: Layouts.iceNeighbors(tiles), keys: [0, 1], locks: new Set([2, 3, 4, 5]) }, clock: { i: 10, n: budget } };
    const conditional = playHumanCampaign(game, { maximumAttempts: 2, planning: { ...baseline,
      openingConditionalPlanning: true, openingReusablePlanning: true } });
    const direct = playHumanCampaign(game, { maximumAttempts: 2, planning: budget === 30
      ? { ...baseline, reusablePublicPlanning: true, reusableContinueAfterInformation: true, reusablePrepareCrowded: true, retryInformationNodes: 32768 } : baseline });
    assert.equal(conditional.wonOn, 1); assert.equal(direct.wonOn, 1);
    assert.deepEqual(conditional.attempts.map(row => row.actions), direct.attempts.map(row => row.actions));
    assert.equal(conditional.openingPlanning.family, budget === 30 ? 'reusable33' : 'retained23');
    taps += conditional.verifiedTaps + direct.verifiedTaps;
  }
  assert.throws(() => createHumanController(tiles, { openingReusablePlanning: true }));
  assert.throws(() => createHumanController(tiles, { openingConditionalPlanning: true, openingReusablePlanning: 'yes' }));
  console.log('PASS public heavy-lock reusable planning separates clock30/29 and locks4/3, preserves adopted40 families and retry latching, rejects invalid options and independently replays '+taps+' key/lock/clock production taps against both direct policies');
}
if (require.main === module) test();
module.exports = test;
