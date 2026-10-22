'use strict';
const assert = require('assert/strict');
const { tileVisibility, observeBoard } = require('./human_board_visibility.js');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 0 }, { x: 5, y: 0, z: 1 }];
  const state = { alive: [1, 1, 1, 1], down: [0, 1, 0, 0], openPeek: -1, moves: 3 };
  const clock = { i: 0, n: 12 }, reads = [];
  const readers = { picture(index) { assert([2, 3].includes(index)); reads.push(index); return 7; },
    role(index) { assert([2, 3].includes(index)); return 'none'; } };
  const observed = observeBoard(tiles, state, clock, readers);
  assert.deepEqual(reads, [2, 3]);
  assert.deepEqual(observed.pictures, [null, null, 7, 7]);
  assert.deepEqual(observed.roles, [null, null, 'none', 'none']);
  assert.deepEqual(observed.down, [null, 1, 0, 0]);
  assert.deepEqual(observed.clock, { i: 0, n: 12, remaining: 9 });
  assert(tileVisibility(tiles, { ...state, openPeek: 1 }, clock).tiles[1].picture);
  assert(!tileVisibility(tiles, { ...state, alive: [0, 1, 1, 1] }, clock).clock);
  assert(tileVisibility(tiles, { ...state, alive: [1, 0, 1, 1] }, clock).tiles[0].picture);
  const geometry = { tiles, nb: Layouts.neighbors(tiles), clock: null,
    publicFrontier(position) { return { free: position.alive.flatMap((alive, index) => alive ? [index] : []), uncertain: [0, 1] }; } };
  for (const field of ['faces', 'seed', 'deck', 'rules']) Object.defineProperty(geometry, field, { get() { throw Error('Private ' + field); } });
  const planned = search(geometry, { ...state, pictures: [7, 7, 7, 7], tray: [], relieved: false, arriving: [] },
    tiles.map((tile, index) => ({ index })), { ...REFERENCE_PARAMETERS, pruneDead: false, trayRecovery: false });
  assert(!planned.knownDead); assert(!planned.knownWin);
  assert(planned.unknownTransitions > 0, 'Remembered pictures cannot bypass unknown mechanical roles');
  console.log('PASS one game-state visibility gate permits covered clock badges and exposed edges, hides covered/closed pictures and roles, and stops hypothetical routes at unknown roles');
}

if (require.main === module) test();
module.exports = test;
