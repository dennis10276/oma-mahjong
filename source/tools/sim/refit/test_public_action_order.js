'use strict';
const assert = require('assert/strict');
const { publicActionOrder } = require('./public_action_order.js');
const Layouts = require('../../../www/layouts.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');

function test() {
  const actions = Array.from({ length: 20 }, (_, index) => ({ index }));
  const snapshot = structuredClone(actions);
  assert.deepEqual(publicActionOrder(actions, 1), snapshot);
  const second = publicActionOrder(actions, 2), third = publicActionOrder(actions, 3);
  assert.notDeepEqual(second, snapshot);
  assert.notDeepEqual(second, third);
  assert.deepEqual(publicActionOrder(actions, 2), second);
  for (const ordered of [second, third]) assert.deepEqual(ordered.map(action => action.index).sort((left, right) => left - right), actions.map(action => action.index));
  assert.deepEqual(actions, snapshot);
  assert.throws(() => publicActionOrder(actions, 0));
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const board = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 4, 4], down: tiles.map(() => 0), rules: null, clock: null };
  const campaigns = [1, 2, 3].map(salt => playHumanCampaign(board, { maximumAttempts: 1, planning: { publicActionSalt: salt } }));
  assert(campaigns.every(campaign => campaign.wonOn === 1));
  assert.notDeepEqual(campaigns[0].attempts[0].actions, campaigns[1].attempts[0].actions,
    'Planner enumeration must preserve the public salt on genuinely tied winning routes');
  assert.notDeepEqual(campaigns[1].attempts[0].actions, campaigns[2].attempts[0].actions);
  console.log('PASS public salts deterministically order the same actions without board data, mutation or private randomness; salt1 preserves existing ordering');
}
if (require.main === module) test();
module.exports = test;
