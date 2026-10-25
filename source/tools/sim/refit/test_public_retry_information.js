'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { retryInformationSearch } = require('./public_retry_information.js');

function test() {
  const tiles = Array.from({ length: 4 }, (value, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const memory = { pictures: [null, 5, 6, 6], down: [1, 0, 0, 0], initialRoles: tiles.map(() => 'none') };
  const state = { alive: tiles.map(() => 1), pictures: memory.pictures.slice(), down: memory.down.slice(),
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 };
  const actions = [0, 1, 2, 3].map(index => ({ index }));
  const primary = { index: 1, path: [1], goal: 'primary', nodes: 0, knownWin: false, knownDead: false, safeClockExit: false };
  let primaryResult = primary, calls = 0;
  const policy = retryInformationSearch(() => { calls++; return primaryResult; }, { nodes: 100, milliseconds: 100, choices: 16 });
  policy.beginAttempt(memory);
  assert.equal(policy.search(game, state, actions), primary, 'First attempts retain the original report object');
  assert.equal(policy.stats().considered, 0); policy.finish('physicalLoss', memory);
  policy.beginAttempt(memory);
  const snapshot = JSON.stringify(memory), discovered = policy.search(game, state, actions);
  assert.equal(discovered.goal, 'retryInformationWitness'); assert.deepEqual(discovered.path, [0]);
  assert.equal(discovered.knownWin, false); assert.equal(discovered.knownDead, false);
  assert.equal(discovered.retryInformationWitness.imaginedPicturesAdded, 0);
  assert.equal(discovered.retryInformationWitness.knownPrefixTaps, 0);
  assert.equal(JSON.stringify(memory), snapshot); assert.deepEqual(primary.path, [1]);
  assert.equal(policy.search(game, { ...state, physicalTaps: 16 }, actions), primary);
  assert.equal(policy.search(game, state, actions, { deadline: Date.now() - 1 }), primary);
  primaryResult = { ...primary, knownWin: true };
  assert.equal(policy.search(game, state, actions), primaryResult, 'Existing constructive wins remain protected');
  primaryResult = { ...primary, safeClockExit: true };
  assert.equal(policy.search(game, state, actions), primaryResult, 'Existing constructive clock exits remain protected');
  primaryResult = primary;
  const learned = { ...memory, pictures: [7, 5, 6, 6] };
  policy.observe(learned);
  assert.equal(policy.search(game, state, actions), primary, 'New actual information ends the stall intervention immediately');
  assert.equal(policy.stats().stallsEndedByInformation, 1);
  policy.finish('physicalLoss', learned); policy.beginAttempt(learned);
  assert.equal(policy.search(game, state, actions), primary, 'A retry that learned information is not a stalled retry');
  policy.finish('unresolvedBudget', learned); policy.beginAttempt(learned);
  assert.equal(policy.search(game, state, actions), primary, 'An unresolved budget is not learned physical failure');
  policy.finish('cleared', learned);
  assert.equal(policy.stats().stalledAttempts, 1); assert.equal(policy.stats().routes, 1);
  assert(calls >= 8);
  console.log('PASS stalled-retry information search preserves first tries and constructive wins, stops after actual new knowledge, retains honest unresolved statuses and never promotes imagined pictures');
}

if (require.main === module) test();
module.exports = test;
