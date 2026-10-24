'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { playHumanCampaign, createHumanController } = require('./human_reference_campaign.js');
const { legal } = require('./known_tray_plan.js');

function test() {
  let controls = 0;
  for (let shift = 0; shift < 12; shift++) for (const hits of [1, 2]) {
    const tiles = [8, 12, 0, 2].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [shift, shift, shift + 12, shift + 12],
      down: [0, 0, 0, 0], clock: null,
      rules: { iceNb: Layouts.iceNeighbors(tiles), ice: { 2: hits, 3: hits }, keys: [], locks: new Set() } };
    const result = playHumanCampaign(game, { maximumAttempts: 1, captureDecisions: true,
      planning: { exclusiveRoles: true } });
    assert.equal(result.wonOn, 1);
    const decisions = result.attempts[0].decisions;
    assert.equal(decisions[0].plan.goal, 'win', 'Known search must include the production obstacle-relief transition');
    assert.equal(decisions[0].plan.path.length, 4);
    assert(decisions.every(decision => !decision.plan.knownDead));
    assert(decisions.some(decision => decision.state.relieved));
    assert.equal(result.verifiedTaps, 4);
    assert.equal(result.controls, 4);
    controls++;
  }
  const tiles = [0, 2].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const state = { alive: [1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 };
  const observed = { pictures: [1, 1], down: [0, 0], roles: ['ice', null], clock: null };
  const controller = createHumanController(tiles, { exclusiveRoles: true });
  controller.beginAttempt(); controller.observe(state, observed);
  const unknown = controller.decide();
  assert(unknown.predicted.uncertain, 'An unresolved role prevents assuming that production has no legal moves');
  assert.equal(unknown.plan.knownDead, false);
  const crowded = createHumanController(tiles, { exclusiveRoles: true });
  crowded.beginAttempt(); crowded.observe({ ...state, tray: [3, 4, 5, 6] }, { ...observed, roles: ['ice', 'ice'] });
  assert.equal(crowded.decide(), null, 'A full tray cannot trigger obstacle relief');
  const hidden = createHumanController(tiles, { exclusiveRoles: true });
  hidden.beginAttempt(); hidden.observe(state, { ...observed, pictures: [null, null], roles: ['ice', 'ice'] });
  const discovery = hidden.decide();
  assert.equal(discovery.predicted.reason, 'unseenPicture');
  assert.deepEqual(hidden.known().pictures, [null, null], 'Proving obstacle relief never supplies hidden identities');
  const restricted = { tiles, nb: Layouts.neighbors(tiles), publicFrontier: () => ({ free: [], uncertain: [] }) };
  assert.deepEqual(legal(restricted, { ...state, pictures: [1, 1], down: [0, 0] }),
    { free: [], uncertain: [], relieved: false }, 'An arbitrary restricted callback is not a complete no-move proof');
  const alreadyRelieved = { ...restricted, publicFrontier: () => ({ free: [0, 1], uncertain: [], relieved: true }) };
  assert.equal(legal(alreadyRelieved, { ...state, pictures: [1, 1], down: [0, 0] }).relieved, true);
  console.log('PASS ' + controls + ' public fully known obstacle-relief wins replay through original production; unknown roles and arbitrary restricted frontiers never invent relief');
}

if (require.main === module) test();
module.exports = test;
