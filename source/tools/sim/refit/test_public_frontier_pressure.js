'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { frontierPressure } = require('./public_frontier_pressure.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function test() {
  const state = { alive: [1, 1, 1, 1, 1], pictures: [7, null, 8, null, 8], tray: [7] };
  const frontier = new Set([0, 1, 2, 3]);
  assert.deepEqual(frontierPressure(state, frontier, 0, { free: [], uncertain: [] }),
    { overflow: 1, projected: 4, unresolvedBlockers: 2 });
  assert.equal(frontierPressure({ ...state, pictures: [7, 8, 8, null, 8] }, frontier, 0, { free: [], uncertain: [] }).overflow, 0);
  assert.equal(frontierPressure(state, frontier, 0, { free: [4], uncertain: [] }).overflow, 0);
  assert.equal(frontierPressure(state, frontier, 0, { free: [4], uncertain: [4] }).overflow, 1);
  assert.equal(frontierPressure({ ...state, pictures: [7, 8, 8, null, 8] }, frontier, 0,
    { free: [4], uncertain: [] }).projected, 2, 'A spare outside mate must not split an already complete required pair');
  assert.equal(frontierPressure({ ...state, tray: [7, 8] }, frontier, 0,
    { free: [4], uncertain: [] }).overflow, 0, 'A required blocker can resolve an existing carry without prematurely spending its outside mate');
  assert.equal(frontierPressure(state, frontier, 0, { free: [0], uncertain: [] }).overflow, 0);
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }, { x: 12, y: 0, z: 1 }, { x: 12, y: 0, z: 2 }, { x: 12, y: 0, z: 3 }];
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const position = { alive: tiles.map(() => 1), pictures: [25, null, 13, 25, null, null, 32],
    down: [0, 1, 0, 0, 1, 1, 1], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const actions = [0, 2, 6].map(index => ({ index }));
  const options = { ...REFERENCE_PARAMETERS, goalRecovery: true, goalRecoveryMin: 1,
    alternativeRecoveryRoutes: true, progressiveReopens: true, nodes: 128, beam: 32, taps: 4, pruneDead: false };
  assert.equal(search(game, position, actions, options).index, 0);
  const careful = search(game, position, actions, { ...options, riskFirstRecovery: true });
  assert.notEqual(careful.index, 0, 'A known mate behind three potentially unmatched blockers must not automatically beat a roomier information route');
  assert(careful.information); assert(!careful.knownDead); assert(!careful.knownWin);
  assert.deepEqual(careful.goalAudit.recoveryRankWidths, [11]);
  assert.throws(() => search(game, position, actions, { ...options, riskFirstRecovery: 'yes' }));
  console.log('PASS public frontier-pressure ordering counts unknown blockers without inventing pictures, cancels observed pairs, requires guaranteed spare matches and treats overflow as risk rather than a death proof');
}

if (require.main === module) test();
module.exports = test;
