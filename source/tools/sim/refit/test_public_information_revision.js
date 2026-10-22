'use strict';
const assert = require('assert/strict');
const { knowledgeChange } = require('./public_information_revision.js');
const state = { alive: [1, 1, 1, 1, 0], pictures: [1, null, 3, 8, 99] };
assert.deepEqual(knowledgeChange([null, 2, 3, 4, 5], state), { gained: [0], lost: [1], changed: [3] });
assert.deepEqual(knowledgeChange(state.pictures, state), { gained: [], lost: [], changed: [] });
assert.throws(() => knowledgeChange([], state));
const Layouts = require('../../../www/layouts.js');
const { reference } = require('./public_witness_reference.js');
const { advance, legal } = require('./known_tray_plan.js');
const tiles = [{ x: 0, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
Object.defineProperty(game, 'faces', { get() { throw Error('Read private deck'); } });
const opening = { alive: [1, 1, 1, 1], pictures: [1, 1, null, 2], down: [0, 0, 0, 0],
  tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
for (const enabled of [false, true]) {
  let calls = 0;
  const planner = reference({ replanOnInformation: enabled }, () => {
    calls++;
    return { index: calls === 1 ? 0 : 2, path: calls === 1 ? [0, 1] : [2], knownWin: false, safeClockExit: false,
      clockRoom: 0, knownProgress: 1, information: true, boundary: false, knownDead: false, nodes: 1, prunedDeadSuccessors: 0 };
  });
  planner.physicalTrayPlanning(game, opening, legal(game, opening).free.map(index => ({ index })));
  planner.acknowledgeTile(0);
  const after = advance(game, opening, 0).state;
  after.pictures = [1, 1, 2, 2];
  planner.physicalTrayPlanning(game, after, legal(game, after).free.map(index => ({ index })));
  assert.equal(calls, enabled ? 2 : 1);
  assert.equal(planner.report().index, enabled ? 2 : 1);
  if (enabled) assert.equal(planner.stats().informationReplans, 1);
  else assert.equal(Object.hasOwn(planner.stats(), 'informationReplans'), false);
}
console.log('PASS public information revisions distinguish gained, forgotten and contradicted observations while ignoring removed tiles');
