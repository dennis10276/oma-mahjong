'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { playHumanCampaign, createHumanController, visibleRole } = require('./human_reference_campaign.js');

function gameOf(faces, down = faces.map(() => 0)) {
  const tiles = faces.map((face, index) => ({ x: index * 4, y: 0, z: 0 }));
  return { tiles, nb: Layouts.neighbors(tiles), faces, down, rules: null, clock: null };
}

function test() {
  const simple = gameOf([1, 1, 2, 2]);
  Object.defineProperty(simple, 'seed', { get() { throw Error('Read actual level seed'); } });
  const won = playHumanCampaign(simple);
  assert.equal(won.wonOn, 1); assert.equal(won.verifiedTaps, won.attempts[0].taps); assert(won.controls > 0);
  const hidden = gameOf([1, 1, 2, 2], [1, 1, 1, 1]);
  const inspected = playHumanCampaign(hidden); assert.equal(inspected.wonOn, 1); assert(inspected.verifiedTaps >= 4);
  const discovery = playHumanCampaign(hidden, { planning: { inspectBeforeCommit: true } });
  assert.equal(discovery.wonOn, 1); assert.equal(discovery.rejected, 0);
  assert.equal(discovery.verifiedTaps, discovery.attempts[0].taps);
  const cap = playHumanCampaign(hidden, { choiceLimit: 1 });
  assert.equal(cap.wonOn, null); assert.equal(cap.attempts.length, 1); assert.equal(cap.status, 'unresolvedBudget');
  const tower = gameOf([1, 1, 2, 2]);
  tower.tiles[1] = { x: 0, y: 0, z: 1 }; tower.nb = Layouts.neighbors(tower.tiles); tower.clock = { i: 0, n: 3 };
  assert.equal(playHumanCampaign(tower).wonOn, 1, 'A covered clock badge supports public route planning');
  const observation = { pictures: [null, null, null, null], roles: [null, null, null, null], down: [1, 1, 1, 1], clock: null };
  const state = { alive: [1, 1, 1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 };
  const first = createHumanController(simple.tiles), second = createHumanController(simple.tiles);
  first.beginAttempt(); second.beginAttempt(); first.observe(state, observation); second.observe(state, structuredClone(observation));
  assert.deepEqual(first.decide(), second.decide(), 'A controller receives no actual concealed-world data');
  const rejected = first.decide().plan.index; first.acknowledge(rejected, false);
  assert.notEqual(first.decide().plan.index, rejected, 'A rejected uncertain tap must not loop or count as a new try');
  assert(first.known().pictures.every(picture => picture === null));
  const overlapped = gameOf([1, 1, 2, 2]);
  overlapped.rules = { iceNb: [[1], [0], [], []], ice: { 0: 1 }, locks: new Set([0]), keys: [2, 3] };
  assert.equal(visibleRole(overlapped, state, 0), 'ice');
  assert.equal(visibleRole(overlapped, { ...state, alive: [1, 0, 1, 1] }, 0), 'lock');
  assert.equal(visibleRole(overlapped, { ...state, alive: [1, 0, 0, 0] }, 0), 'none');
  assert.equal(visibleRole(overlapped, { ...state, relieved: true }, 0), 'none');
  console.log('PASS visibility-gated campaigns replay through original production, remember only observations, honor covered clock badges, keep caps unresolved, and avoid private-seed access or rejected-tap loops');
}

if (require.main === module) test();
module.exports = test;
