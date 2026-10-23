'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function test() {
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), clock: { i: 2, n: 3 }, rules: null };
  Object.defineProperty(game, 'faces', { get() { throw Error('Read private pictures'); } });
  const state = { alive: [1, 1, 1, 1], pictures: [1, 1, 2, null], down: [0, 0, 0, 1],
    moves: 0, tray: [], openPeek: -1, relieved: false, arriving: [] };
  const actions = tiles.map((tile, index) => ({ index }));
  const direct = search(game, state, actions, REFERENCE_PARAMETERS);
  assert(direct.safeClockExit); assert.deepEqual(direct.path, [2]);
  assert.equal(direct.knownProgress, 1); assert.equal(direct.clockRoom, 3);
  const bufferFirst = search(game, { ...state, tray: [7, 8], pictures: [7, 8, 2, null] }, actions, REFERENCE_PARAMETERS);
  assert(bufferFirst.safeClockExit); assert.equal(bufferFirst.clockRoom, 3);
  assert.equal(bufferFirst.path.length, 3); assert.deepEqual([...bufferFirst.path].sort(), [0, 1, 2]);
  console.log('PASS equally safe clock exits prefer prompt deadline removal over optional pairs, but constructing better tray room still takes priority');
}

if (require.main === module) test();
module.exports = test;
