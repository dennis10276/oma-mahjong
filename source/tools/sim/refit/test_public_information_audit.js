'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { describeInformation } = require('./public_information_audit.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');

function test() {
  const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), clock: null, rules: null,
    publicFrontier(position) { return { free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [] }; },
    publicExposure(position) { return !position.alive[0] ? [2] : []; } };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: [1, 1, 1, 1], pictures: [1, 1, 2, null], down: [0, 0, 0, 1],
    tray: [], openPeek: -1, moves: 0, relieved: false, arriving: [] };
  const snapshot = structuredClone(state);
  const report = describeInformation(game, state, [0, 1, 3], ['none', 'none', null, null]);
  assert.deepEqual(report.events, [{ afterTaps: 1, index: 0, tray: [1], gained: [{ index: 2,
    rememberedPicture: 2, rememberedDown: 0, observedRole: null, availability: 'guaranteedFree' }] }]);
  assert.deepEqual(report.boundary, { afterTaps: 2, index: 3, reason: 'unseenPicture' });
  assert.deepEqual(state, snapshot);
  const uncertain = { ...game, publicFrontier(position) { return { free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [2] }; } };
  assert.equal(describeInformation(uncertain, state, [0], ['none', 'none', null, null]).events[0].gained[0].availability, 'uncertain');
  const actual = { tiles, nb: game.nb, faces: [1, 1, 2, 2], down: [0, 0, 1, 1], clock: null, rules: null };
  const captured = playHumanCampaign(actual, { captureDecisions: true, captureInformation: true });
  const plain = playHumanCampaign(actual, { captureDecisions: true });
  assert.equal(captured.wonOn, plain.wonOn);
  assert.deepEqual(captured.attempts[0].actions, plain.attempts[0].actions);
  assert(captured.attempts[0].decisions.every(choice => choice.informationAudit));
  assert.throws(() => playHumanCampaign(actual, { captureInformation: true }));
  console.log('PASS public information audits distinguish remembered identities, still-unknown roles and deduced availability, stop before hidden outcomes, preserve state and independently replay captured production campaigns');
}

if (require.main === module) test();
module.exports = test;
